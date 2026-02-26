export type CliOk = {
  ok: true;
  command: string;
  data: Record<string, unknown>;
};

export type CliErr = {
  ok: false;
  command: string;
  error: { message: string; code?: string };
};

export function okJson(command: string, data: Record<string, unknown> = {}): CliOk {
  return { ok: true, command, data };
}

export function errJson(command: string, message: string, code?: string): CliErr {
  return { ok: false, command, error: { message, code } };
}

export function printJson(payload: CliOk | CliErr): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

