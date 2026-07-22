import { z } from "zod";
import { parse as parseJsonc, ParseError } from "jsonc-parser";
import { readFileSync } from "node:fs";
import type { BenchConfig } from "./types";

const endpointSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["ws-logs", "ws-slots", "grpc"]),
  url: z.string().min(1),
  xToken: z.string().optional(),
});

const configSchema = z
  .object({
    program: z.string().min(32),
    windows: z.object({
      warmupSec: z.number().nonnegative(),
      cooldownSec: z.number().nonnegative(),
      finalizeMs: z.number().positive(),
    }),
    endpoints: z.array(endpointSchema).min(1),
  })
  .superRefine((cfg, ctx) => {
    const seen = new Set<string>();
    for (const e of cfg.endpoints) {
      if (seen.has(e.name)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate endpoint name: ${e.name}` });
      }
      seen.add(e.name);
    }
  });

function interpolate(s: string, env: NodeJS.ProcessEnv): string {
  return s.replace(/\$\{([A-Z0-9_]+)\}/g, (_m, name: string) => {
    const v = env[name];
    if (v === undefined || v === "") throw new Error(`missing env var: ${name}`);
    return v;
  });
}

export function parseConfig(raw: string, env: NodeJS.ProcessEnv): BenchConfig {
  const errors: ParseError[] = [];
  const data = parseJsonc(raw, errors, { allowTrailingComma: true });
  if (errors.length) throw new Error(`invalid JSONC config: ${JSON.stringify(errors)}`);
  const parsed = configSchema.parse(data);
  return {
    program: parsed.program,
    windows: parsed.windows,
    endpoints: parsed.endpoints.map((e) => ({
      name: e.name,
      kind: e.kind,
      url: interpolate(e.url, env),
      xToken: e.xToken ? interpolate(e.xToken, env) : undefined,
    })),
  };
}

export function loadConfig(path: string, env: NodeJS.ProcessEnv = process.env): BenchConfig {
  return parseConfig(readFileSync(path, "utf8"), env);
}
