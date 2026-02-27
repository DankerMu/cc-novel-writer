import { NovelCliError } from "./errors.js";
import { isPlainObject } from "./type-guards.js";

export type NovelAskKind = "single_choice" | "multi_choice" | "free_text";

export type NovelAskOption = {
  label: string;
  description: string;
};

export type NovelAskFreeTextQuestion = {
  id: string;
  header: string;
  question: string;
  kind: "free_text";
  required: boolean;
};

export type NovelAskSingleChoiceQuestion = {
  id: string;
  header: string;
  question: string;
  kind: "single_choice";
  required: boolean;
  options: NovelAskOption[];
  allow_other?: boolean;
  default?: string;
};

export type NovelAskMultiChoiceQuestion = {
  id: string;
  header: string;
  question: string;
  kind: "multi_choice";
  required: boolean;
  options: NovelAskOption[];
  allow_other?: boolean;
  default?: string[];
};

export type NovelAskQuestion = NovelAskFreeTextQuestion | NovelAskSingleChoiceQuestion | NovelAskMultiChoiceQuestion;

export type NovelAskQuestionSpec = {
  version: number;
  topic: string;
  questions: NovelAskQuestion[];
};

export type NovelAskAnswerValue = string | string[];

export type NovelAskAnswerSpec = {
  version: number;
  topic: string;
  answers: Record<string, NovelAskAnswerValue>;
  answered_at: string;
  answered_by: string;
};

const SNAKE_CASE_ID = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const RFC3339_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function isSnakeCaseId(id: string): boolean {
  return SNAKE_CASE_ID.test(id);
}

function fail(context: string, message: string): never {
  throw new NovelCliError(`Invalid ${context}: ${message}`, 2);
}

function assertNoUnknownKeys(obj: Record<string, unknown>, allowed: ReadonlySet<string>, context: string): void {
  for (const key of Object.keys(obj)) {
    if (key.startsWith("_")) continue;
    if (!allowed.has(key)) fail(context, `Unknown field '${key}'.`);
  }
}

function requirePlainObject(value: unknown, context: string): Record<string, unknown> {
  if (!isPlainObject(value)) fail(context, "Expected an object.");
  return value;
}

function requireNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== "string") fail(context, "Expected a string.");
  if (value.trim().length === 0) fail(context, "Expected a non-empty string.");
  return value;
}

function requireBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") fail(context, "Expected a boolean.");
  return value;
}

function requireInt(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(context, "Expected an integer.");
  return value;
}

function requireNonEmptyArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) fail(context, "Expected an array.");
  if (value.length === 0) fail(context, "Expected a non-empty array.");
  return value;
}

function requireIsoDateString(value: unknown, context: string): string {
  const s = requireNonEmptyString(value, context);
  if (!RFC3339_DATE_TIME.test(s)) fail(context, "Expected an ISO-8601 / RFC3339 date-time string (with timezone).");
  if (!Number.isFinite(Date.parse(s))) fail(context, "Expected a valid ISO-8601 / RFC3339 date-time string.");
  return s;
}

function validateOptions(raw: unknown, context: string): NovelAskOption[] {
  const optionsRaw = requireNonEmptyArray(raw, context);
  const labels = new Set<string>();
  const options: NovelAskOption[] = [];

  for (let i = 0; i < optionsRaw.length; i++) {
    const optCtx = `${context}[${i}]`;
    const optObj = requirePlainObject(optionsRaw[i], optCtx);
    assertNoUnknownKeys(optObj, new Set(["label", "description"]), optCtx);
    const label = requireNonEmptyString(optObj.label, `${optCtx}.label`);
    const description = requireNonEmptyString(optObj.description, `${optCtx}.description`);
    if (labels.has(label)) fail(`${optCtx}.label`, `Duplicate option label '${label}'.`);
    labels.add(label);
    options.push({ label, description });
  }

  return options;
}

function validateSingleChoiceDefault(raw: unknown, optionLabels: Set<string>, context: string): string | undefined {
  if (raw === undefined) return undefined;
  const d = requireNonEmptyString(raw, context);
  if (!optionLabels.has(d)) fail(context, `Default must be one of the option labels.`);
  return d;
}

function validateMultiChoiceDefault(raw: unknown, optionLabels: Set<string>, context: string): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) fail(context, "Default must be an array of strings.");
  if (raw.length === 0) fail(context, "Default must be a non-empty array of strings.");

  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const itemCtx = `${context}[${i}]`;
    const v = requireNonEmptyString(raw[i], itemCtx);
    if (!optionLabels.has(v)) fail(itemCtx, "Default entry must be one of the option labels.");
    if (seen.has(v)) fail(itemCtx, `Duplicate default entry '${v}'.`);
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function parseNovelAskQuestionSpec(raw: unknown): NovelAskQuestionSpec {
  const ctx = "NOVEL_ASK";
  const obj = requirePlainObject(raw, ctx);
  assertNoUnknownKeys(obj, new Set(["version", "topic", "questions"]), ctx);

  const version = requireInt(obj.version, `${ctx}.version`);
  if (version < 1) fail(`${ctx}.version`, "Expected an integer >= 1.");
  const topic = requireNonEmptyString(obj.topic, `${ctx}.topic`);
  const questionsRaw = requireNonEmptyArray(obj.questions, `${ctx}.questions`);

  const questions: NovelAskQuestion[] = [];
  const questionIds = new Set<string>();

  for (let i = 0; i < questionsRaw.length; i++) {
    const qCtx = `${ctx}.questions[${i}]`;
    const qObj = requirePlainObject(questionsRaw[i], qCtx);

    const id = requireNonEmptyString(qObj.id, `${qCtx}.id`);
    if (!isSnakeCaseId(id)) fail(`${qCtx}.id`, "Question id must be stable snake_case.");
    if (questionIds.has(id)) fail(`${qCtx}.id`, `Duplicate question id '${id}'.`);
    questionIds.add(id);

    const header = requireNonEmptyString(qObj.header, `${qCtx}.header`);
    const question = requireNonEmptyString(qObj.question, `${qCtx}.question`);
    const kind = qObj.kind;
    if (kind !== "single_choice" && kind !== "multi_choice" && kind !== "free_text") {
      fail(`${qCtx}.kind`, `Expected one of: single_choice, multi_choice, free_text.`);
    }
    const required = requireBoolean(qObj.required, `${qCtx}.required`);

    if (kind === "free_text") {
      assertNoUnknownKeys(qObj, new Set(["id", "header", "question", "kind", "required"]), qCtx);
      questions.push({ id, header, question, kind, required });
      continue;
    }

    const options = validateOptions(qObj.options, `${qCtx}.options`);
    const optionLabels = new Set(options.map((o) => o.label));

    const allowOtherRaw = qObj.allow_other;
    const allow_other = allowOtherRaw === undefined ? undefined : requireBoolean(allowOtherRaw, `${qCtx}.allow_other`);

    if (kind === "single_choice") {
      assertNoUnknownKeys(qObj, new Set(["id", "header", "question", "kind", "required", "options", "allow_other", "default"]), qCtx);
      const def = validateSingleChoiceDefault(qObj.default, optionLabels, `${qCtx}.default`);
      questions.push({
        id,
        header,
        question,
        kind,
        required,
        options,
        ...(allow_other === undefined ? {} : { allow_other }),
        ...(def === undefined ? {} : { default: def })
      });
      continue;
    }

    assertNoUnknownKeys(qObj, new Set(["id", "header", "question", "kind", "required", "options", "allow_other", "default"]), qCtx);
    const def = validateMultiChoiceDefault(qObj.default, optionLabels, `${qCtx}.default`);
    questions.push({
      id,
      header,
      question,
      kind,
      required,
      options,
      ...(allow_other === undefined ? {} : { allow_other }),
      ...(def === undefined ? {} : { default: def })
    });
  }

  return { version, topic, questions };
}

export function parseNovelAskAnswerSpec(raw: unknown): NovelAskAnswerSpec {
  const ctx = "AnswerSpec";
  const obj = requirePlainObject(raw, ctx);
  assertNoUnknownKeys(obj, new Set(["version", "topic", "answers", "answered_at", "answered_by"]), ctx);

  const version = requireInt(obj.version, `${ctx}.version`);
  if (version < 1) fail(`${ctx}.version`, "Expected an integer >= 1.");
  const topic = requireNonEmptyString(obj.topic, `${ctx}.topic`);
  const answered_at = requireIsoDateString(obj.answered_at, `${ctx}.answered_at`);
  const answered_by = requireNonEmptyString(obj.answered_by, `${ctx}.answered_by`);

  const answersObj = requirePlainObject(obj.answers, `${ctx}.answers`);
  const answers: Record<string, NovelAskAnswerValue> = {};

  for (const [questionId, value] of Object.entries(answersObj)) {
    const entryCtx = `${ctx}.answers.${questionId}`;
    if (!isSnakeCaseId(questionId)) fail(entryCtx, "Answer key must be stable snake_case.");

    if (typeof value === "string") {
      if (value.trim().length === 0) fail(entryCtx, "Expected a non-empty string.");
      answers[questionId] = value;
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) fail(entryCtx, "Expected a non-empty string array.");
      const seen = new Set<string>();
      const out: string[] = [];
      for (let i = 0; i < value.length; i++) {
        const itemCtx = `${entryCtx}[${i}]`;
        const v = requireNonEmptyString(value[i], itemCtx);
        if (seen.has(v)) fail(itemCtx, `Duplicate answer entry '${v}'.`);
        seen.add(v);
        out.push(v);
      }
      answers[questionId] = out;
      continue;
    }

    fail(entryCtx, "Expected a string or string array.");
  }

  return { version, topic, answers, answered_at, answered_by };
}

export function validateNovelAskAnswerAgainstQuestionSpec(questionSpec: NovelAskQuestionSpec, answerSpec: NovelAskAnswerSpec): void {
  const qs = questionSpec;
  const ans = answerSpec;

  if (ans.version !== qs.version) {
    fail("AnswerSpec.version", `Must match NOVEL_ASK.version (${qs.version}).`);
  }
  if (ans.topic !== qs.topic) {
    fail("AnswerSpec.topic", `Must match NOVEL_ASK.topic (${JSON.stringify(qs.topic)}).`);
  }

  const questionById = new Map<string, NovelAskQuestion>();
  for (const q of qs.questions) questionById.set(q.id, q);

  for (const answerId of Object.keys(ans.answers)) {
    if (!questionById.has(answerId)) fail(`AnswerSpec.answers.${answerId}`, "No matching question id in NOVEL_ASK.");
  }

  for (const q of qs.questions) {
    const value = ans.answers[q.id];
    if (value === undefined) {
      if (q.required) fail(`AnswerSpec.answers.${q.id}`, "Missing required answer.");
      continue;
    }

    if (q.kind === "free_text") {
      if (typeof value !== "string") fail(`AnswerSpec.answers.${q.id}`, "Expected a string for free_text.");
      if (value.trim().length === 0) fail(`AnswerSpec.answers.${q.id}`, "Expected a non-empty string for free_text.");
      continue;
    }

    const optionLabels = new Set(q.options.map((o) => o.label));
    const allowOther = q.allow_other === true;

    if (q.kind === "single_choice") {
      if (typeof value !== "string") fail(`AnswerSpec.answers.${q.id}`, "Expected a string for single_choice.");
      if (value.trim().length === 0) fail(`AnswerSpec.answers.${q.id}`, "Expected a non-empty string for single_choice.");
      if (!allowOther && !optionLabels.has(value)) fail(`AnswerSpec.answers.${q.id}`, "Answer must be one of the option labels.");
      continue;
    }

    if (!Array.isArray(value)) fail(`AnswerSpec.answers.${q.id}`, "Expected a string array for multi_choice.");
    if (value.length === 0) fail(`AnswerSpec.answers.${q.id}`, "Expected a non-empty string array for multi_choice.");

    const seen = new Set<string>();
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const itemCtx = `AnswerSpec.answers.${q.id}[${i}]`;
      if (typeof item !== "string") fail(itemCtx, "Expected a string.");
      if (item.trim().length === 0) fail(itemCtx, "Expected a non-empty string.");
      if (seen.has(item)) fail(itemCtx, `Duplicate answer entry '${item}'.`);
      seen.add(item);
      if (!allowOther && !optionLabels.has(item)) fail(itemCtx, "Answer entry must be one of the option labels.");
    }
  }
}
