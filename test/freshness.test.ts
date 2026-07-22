import { expect, test } from "vitest";
import { FreshnessSampler } from "../src/freshness";
import type { FinalizedMatch } from "../src/types";

test("freshness = firstWall - (blockTime*1000 + 500), median per provider", async () => {
  // blockTime(slot=10) = 1_000 (seconds) -> block wall ms = 1_000_000; +500 correction => 1_000_500
  const getBlockTime = async (_slot: number) => 1000;
  const fs = new FreshnessSampler(getBlockTime);
  const m: FinalizedMatch = {
    key: "s", kind: "sig", firstWall: 1_001_000, slot: 10,
    deltas: new Map([["A", 0n], ["B", 3_000_000n]]), missing: [],
  };
  await fs.record(m);
  const meds = fs.medians();
  // A arrived at firstWall (1_001_000); freshness = 1_001_000 - 1_000_500 = 500ms
  expect(meds.get("A")).toBeCloseTo(500);
  // B arrived 3ms later -> 503ms
  expect(meds.get("B")).toBeCloseTo(503);
});

test("skips matches with no slot or unknown blockTime", async () => {
  const fs = new FreshnessSampler(async () => null);
  await fs.record({ key: "s", kind: "sig", firstWall: 1, slot: 10, deltas: new Map([["A", 0n]]), missing: [] });
  expect(fs.medians().size).toBe(0);
});
