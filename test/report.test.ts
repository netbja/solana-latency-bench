import { expect, test } from "vitest";
import { formatConsole, toCsv, toJson } from "../src/report";
import type { Report } from "../src/types";

const R: Report = {
  program: "P",
  windowStartWall: 0,
  windowEndWall: 60000,
  durationSec: 60,
  totalMatches: 100,
  matchesPerSec: 1.6667,
  providers: [
    { name: "slow", kind: "ws-logs", samples: 90, wins: 20, winRate: 0.2, p50Ms: 12, p95Ms: 40, p99Ms: 55, maxMs: 80, missed: 10, missedRate: 0.1, excludedDowntime: 0, reconnects: 1, pingMisses: 0 },
    { name: "fast", kind: "grpc", samples: 100, wins: 80, winRate: 0.8, p50Ms: 0, p95Ms: 3, p99Ms: 6, maxMs: 9, missed: 0, missedRate: 0, excludedDowntime: 0, reconnects: 0, pingMisses: 0 },
  ],
};

test("toCsv: header + one row per provider", () => {
  const csv = toCsv(R);
  const lines = csv.trim().split("\n");
  expect(lines[0]).toContain("name,kind,samples,wins,winRate");
  expect(lines).toHaveLength(3);
  expect(lines[1]).toContain("slow");
});

test("toJson round-trips", () => {
  expect(JSON.parse(toJson(R)).totalMatches).toBe(100);
});

test("formatConsole sorts by winRate desc (fastest first)", () => {
  const out = formatConsole(R);
  expect(out.indexOf("fast")).toBeLessThan(out.indexOf("slow"));
  expect(out).toContain("program=P");
});
