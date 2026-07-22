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
  // --absolute off (no provider has freshnessMs): conditional column stays absent -> byte-identical.
  expect(lines[0]).not.toContain("freshnessMs");
});

test("toCsv includes freshnessMs column + value when a provider carries it, empty field otherwise", () => {
  const withFreshness: Report = {
    ...R,
    providers: [
      { ...R.providers[0] },                      // "slow": no freshnessMs
      { ...R.providers[1], freshnessMs: 500 },    // "fast": freshnessMs = 500
    ],
  };
  const csv = toCsv(withFreshness);
  const lines = csv.trim().split("\n");
  expect(lines[0]).toContain("freshnessMs");
  const fastRow = lines.find((l) => l.startsWith("fast,"))!;
  expect(fastRow.split(",").pop()).toBe("500");
  const slowRow = lines.find((l) => l.startsWith("slow,"))!;
  expect(slowRow.endsWith(",")).toBe(true);
});

test("formatConsole shows the absolute-freshness disclaimer and value when present", () => {
  const withFreshness: Report = {
    ...R,
    providers: [
      { ...R.providers[0] },
      { ...R.providers[1], freshnessMs: 500 },
    ],
  };
  const out = formatConsole(withFreshness);
  expect(out).toContain("absolute freshness");
  expect(out).toContain("500");
});

test("toJson round-trips", () => {
  expect(JSON.parse(toJson(R)).totalMatches).toBe(100);
});

test("formatConsole sorts by winRate desc (fastest first)", () => {
  const out = formatConsole(R);
  expect(out.indexOf("fast")).toBeLessThan(out.indexOf("slow"));
  expect(out).toContain("program=P");
});
