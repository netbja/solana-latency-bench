import { expect, test } from "vitest";
import { percentile, StatsEngine } from "../src/stats";
import type { FinalizedMatch, ConnStatus } from "../src/types";

test("percentile nearest-rank", () => {
  const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  expect(percentile(s, 50)).toBe(5);
  expect(percentile(s, 95)).toBe(10);
  expect(percentile([], 50)).toBe(0);
});

function m(kind: "sig" | "slot", deltas: [string, bigint][], missing: string[], firstWall = 1000): FinalizedMatch {
  return { key: "k" + Math.random(), kind, firstWall, deltas: new Map(deltas), missing };
}

test("win-rate, delta percentiles, missed vs downtime", () => {
  const eng = new StatsEngine([
    { name: "A", kind: "ws-logs" },
    { name: "B", kind: "ws-logs" },
  ]);
  // A up from t0; B goes down at t1500..
  eng.addStatus({ name: "A", event: "up", tWall: 0 } as ConnStatus);
  eng.addStatus({ name: "B", event: "up", tWall: 0 } as ConnStatus);
  eng.addStatus({ name: "B", event: "down", tWall: 1400 } as ConnStatus);

  eng.addMatch(m("sig", [["A", 0n], ["B", 2_000_000n]], [], 1000)); // A wins, B +2ms
  eng.addMatch(m("sig", [["B", 0n]], ["A"], 1100));                 // B wins, A missing (A up -> missed)
  eng.addMatch(m("sig", [["A", 0n]], ["B"], 1500));                 // A wins, B missing (B down -> downtime)

  const r = eng.report({ program: "P", windowStartWall: 0, windowEndWall: 3000 });
  const A = r.providers.find((p) => p.name === "A")!;
  const B = r.providers.find((p) => p.name === "B")!;
  expect(r.totalMatches).toBe(3);
  expect(A.wins).toBe(2);
  expect(A.winRate).toBeCloseTo(2 / 3);
  expect(A.missed).toBe(1);           // race 2, A was up
  expect(A.excludedDowntime).toBe(0);
  expect(B.wins).toBe(1);
  expect(B.missed).toBe(0);
  expect(B.excludedDowntime).toBe(1); // race 3, B was down
  expect(B.p95Ms).toBeCloseTo(2);     // its only appearance deltas: [2ms, 0ms] -> p95 = 2
});

test("ws-slots provider only races in slot namespace", () => {
  const eng = new StatsEngine([
    { name: "S1", kind: "ws-slots" },
    { name: "L1", kind: "ws-logs" },
  ]);
  eng.addStatus({ name: "S1", event: "up", tWall: 0 } as ConnStatus);
  eng.addStatus({ name: "L1", event: "up", tWall: 0 } as ConnStatus);
  eng.addMatch(m("slot", [["S1", 0n]], [], 100));   // slot race
  eng.addMatch(m("sig", [["L1", 0n]], [], 100));    // sig race
  const r = eng.report({ program: "P", windowStartWall: 0, windowEndWall: 1000 });
  const S1 = r.providers.find((p) => p.name === "S1")!;
  expect(S1.winRate).toBe(1);   // 1 win / 1 slot race, not / 2 total
});
