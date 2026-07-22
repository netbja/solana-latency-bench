import { expect, test } from "vitest";
import { Matcher } from "../src/matcher";
import type { Sample } from "../src/types";

const S = (key: string, tArr: bigint, tWall: number, kind: "sig" | "slot" = "sig"): Sample => ({ key, kind, tArr, tWall });

function newMatcher() {
  return new Matcher({
    providers: [
      { name: "A", kind: "ws-logs" },
      { name: "B", kind: "grpc" },
      { name: "C", kind: "ws-slots" },
    ],
    windowStartWall: 1000,
    windowEndWall: 2000,
    finalizeNs: 1_000_000_000n, // 1s
  });
}

test("first-write-wins per provider; winner delta 0; loser positive", () => {
  const mtx = newMatcher();
  mtx.add(S("sig1", 100n, 1500n), "A");
  mtx.add(S("sig1", 300n, 1500n), "B");
  mtx.add(S("sig1", 999n, 1500n), "A"); // ignored (A already recorded)
  const [f] = mtx.flush();
  expect(f.deltas.get("A")).toBe(0n);
  expect(f.deltas.get("B")).toBe(200n);
  expect(f.missing).toEqual([]); // C is slot-namespace, not expected on a sig match
});

test("missing lists only same-namespace providers", () => {
  const mtx = newMatcher();
  mtx.add(S("sig9", 100n, 1500n), "A");
  const [f] = mtx.flush();
  expect(f.missing).toEqual(["B"]); // B is sig; C (slot) excluded
});

test("rejects keys whose first sighting is outside the fair window", () => {
  const mtx = newMatcher();
  mtx.add(S("early", 10n, 500n), "A");  // before windowStart
  mtx.add(S("late", 10n, 2500n), "A");  // after windowEnd
  mtx.add(S("early", 20n, 1500n), "B"); // same key stays rejected
  expect(mtx.flush()).toEqual([]);
});

test("finalizeOlderThan emits + evicts by age; younger records stay", () => {
  const mtx = newMatcher();
  mtx.add(S("old", 0n, 1500n), "A");
  mtx.add(S("young", 5_000_000_000n, 1500n), "A");
  const out = mtx.finalizeOlderThan(2_000_000_000n); // old age 2s > 1s; young age negative
  expect(out.map((f) => f.key)).toEqual(["old"]);
  // old evicted, young remains
  expect(mtx.flush().map((f) => f.key)).toEqual(["young"]);
});

test("later smaller tArr lowers firstArr; deltas recomputed at finalize", () => {
  const mtx = newMatcher();
  mtx.add(S("s", 500n, 1500n), "A");
  mtx.add(S("s", 100n, 1500n), "B"); // B actually earliest
  const [f] = mtx.flush();
  expect(f.deltas.get("B")).toBe(0n);
  expect(f.deltas.get("A")).toBe(400n);
});
