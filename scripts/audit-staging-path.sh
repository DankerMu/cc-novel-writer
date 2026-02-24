#!/usr/bin/env bash
#
# Enforce staging-only writes for chapter pipeline subagents.
# - Track active subagent via SubagentStart/SubagentStop hooks
# - Deny Write/Edit/MultiEdit outside staging/** for selected agent types
# - Append violations to logs/audit.jsonl (JSONL, append-only)
#
# IMPORTANT: This script is invoked by Claude Code hooks and must be fast.

set -euo pipefail

hook_tsv="$(
  jq -r '[
      (.hook_event_name // ""),
      (.session_id // ""),
      (.cwd // ""),
      (.permission_mode // ""),
      (.tool_name // ""),
      (.tool_use_id // ""),
      (.transcript_path // ""),
      (.tool_input.file_path // ""),
      (.agent_type // ""),
      (.agent_id // "")
    ] | join("\u001f")' 2>/dev/null || true
)"

if [ -z "${hook_tsv:-}" ]; then
  exit 0
fi

IFS=$'\x1f' read -r hook_event_name session_id cwd permission_mode tool_name tool_use_id transcript_path tool_file_path agent_type agent_id <<<"$hook_tsv"

project_dir="${cwd:-$(pwd)}"
checkpoint_path="${project_dir}/.checkpoint.json"

# Only enforce inside a novel project directory.
if [ ! -f "$checkpoint_path" ]; then
  exit 0
fi

logs_dir="${project_dir}/logs"
marker_file="${logs_dir}/.subagent-active.${session_id}.json"
audit_log="${logs_dir}/audit.jsonl"

case "$hook_event_name" in
  SubagentStart)
    mkdir -p "$logs_dir"
    jq -n \
      --arg session_id "$session_id" \
      --arg agent_type "$agent_type" \
      --arg agent_id "$agent_id" \
      --arg started_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{session_id:$session_id, agent_type:$agent_type, agent_id:$agent_id, started_at:$started_at}' >"$marker_file"
    exit 0
    ;;
  SubagentStop)
    rm -f "$marker_file" >/dev/null 2>&1 || true
    exit 0
    ;;
esac

# Tool enforcement is done via PreToolUse so we can actually block writes.
if [ "$hook_event_name" != "PreToolUse" ]; then
  exit 0
fi

case "$tool_name" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Only enforce for selected chapter pipeline subagents.
if [ ! -f "$marker_file" ]; then
  exit 0
fi

active_agent_type="$(jq -r '.agent_type // ""' "$marker_file" 2>/dev/null || true)"
case "$active_agent_type" in
  chapter-writer|summarizer|style-refiner) ;;
  *) exit 0 ;;
esac

if [ -z "${tool_file_path:-}" ]; then
  exit 0
fi

# Normalize to a project-relative path when possible.
rel_path="$tool_file_path"
case "$tool_file_path" in
  "$project_dir"/*)
    rel_path="${tool_file_path#"$project_dir"/}"
    ;;
esac

# Strip leading "./" for relative paths.
while [ "${rel_path#./}" != "$rel_path" ]; do
  rel_path="${rel_path#./}"
done

allowed="false"
case "$rel_path" in
  staging/*) allowed="true" ;;
esac

if [ "$allowed" = "true" ]; then
  exit 0
fi

mkdir -p "$logs_dir"
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
reason="Subagent '${active_agent_type}' writes must be under staging/** (got: ${rel_path})"

# Append audit event (JSONL).
jq -n \
  --arg timestamp "$timestamp" \
  --arg tool_name "$tool_name" \
  --arg path "$rel_path" \
  --arg reason "$reason" \
  --arg session_id "$session_id" \
  --arg agent_type "$active_agent_type" \
  '{timestamp:$timestamp, tool_name:$tool_name, path:$path, allowed:false, reason:$reason, session_id:$session_id, agent_type:$agent_type}' >>"$audit_log"

# Block the tool execution.
jq -n \
  --arg systemMessage "Blocked write outside staging/** (agent: ${active_agent_type}). See logs/audit.jsonl for details." \
  --arg stopReason "$reason" \
  '{
    systemMessage: $systemMessage,
    continue: false,
    stopReason: $stopReason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $stopReason
    }
  }'

exit 0
