import { expect, test } from "vitest";
import { parseConfig } from "../src/config";

const RAW = `{
  // pump.fun
  "program": "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "windows": { "warmupSec": 5, "cooldownSec": 3, "finalizeMs": 4000 },
  "endpoints": [
    { "name": "a", "kind": "ws-logs", "url": "wss://host/?api-key=\${KEY}" },
    { "name": "g", "kind": "grpc", "url": "https://geyser:443", "xToken": "\${TOK}" }
  ]
}`;

test("parses jsonc with comments and interpolates env (url keeps its //)", () => {
  const cfg = parseConfig(RAW, { KEY: "secret", TOK: "t123" } as any);
  expect(cfg.program.length).toBeGreaterThan(31);
  expect(cfg.endpoints[0].url).toBe("wss://host/?api-key=secret");
  expect(cfg.endpoints[1].xToken).toBe("t123");
});

test("throws on missing env var", () => {
  expect(() => parseConfig(RAW, {} as any)).toThrow(/KEY/);
});

test("rejects unknown transport kind", () => {
  const bad = `{ "program":"6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P","windows":{"warmupSec":0,"cooldownSec":0,"finalizeMs":1},"endpoints":[{"name":"x","kind":"telepathy","url":"u"}]}`;
  expect(() => parseConfig(bad, {} as any)).toThrow();
});

test("rejects duplicate endpoint names", () => {
  const dup = `{ "program":"6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P","windows":{"warmupSec":0,"cooldownSec":0,"finalizeMs":1},"endpoints":[{"name":"x","kind":"ws-logs","url":"u"},{"name":"x","kind":"ws-slots","url":"u2"}]}`;
  expect(() => parseConfig(dup, {} as any)).toThrow(/duplicate/);
});
