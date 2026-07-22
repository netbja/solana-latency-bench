import { expect, test } from "vitest";
import { runBench } from "../src/runner";
import type { BenchConfig, LatencySource, Sample, ConnStatus } from "../src/types";

// Fake source: emits scripted samples immediately on start(), within the fair window.
class FakeSource implements LatencySource {
  private sampleCbs: ((s: Sample) => void)[] = [];
  private statusCbs: ((s: ConnStatus) => void)[] = [];
  constructor(readonly name: string, readonly kind: "ws-logs" | "grpc", private script: Array<{ key: string; tArr: bigint }>) {}
  onSample(cb: (s: Sample) => void) { this.sampleCbs.push(cb); }
  onStatus(cb: (s: ConnStatus) => void) { this.statusCbs.push(cb); }
  async start() {
    const tWall = Date.now();
    for (const cb of this.statusCbs) cb({ name: this.name, event: "up", tWall });
    for (const s of this.script) for (const cb of this.sampleCbs) cb({ key: s.key, kind: "sig", tArr: s.tArr, tWall });
  }
  async stop() {}
}

const cfg: BenchConfig = {
  program: "P",
  windows: { warmupSec: 0, cooldownSec: 0, finalizeMs: 1 },
  endpoints: [
    { name: "A", kind: "ws-logs", url: "x" },
    { name: "B", kind: "grpc", url: "y" },
  ],
};

test("ranks injected sources without any network", async () => {
  const A = new FakeSource("A", "ws-logs", [{ key: "s1", tArr: 100n }]);                 // wins s1, misses s2
  const B = new FakeSource("B", "grpc", [{ key: "s1", tArr: 250n }, { key: "s2", tArr: 10n }]); // loses s1, wins s2
  const report = await runBench(cfg, { durationSec: 1 }, [A, B]);
  const a = report.providers.find((p) => p.name === "A")!;
  const b = report.providers.find((p) => p.name === "B")!;
  expect(report.totalMatches).toBe(2);
  expect(a.wins).toBe(1);
  expect(a.missed).toBe(1);              // A was up, absent on s2
  expect(b.wins).toBe(1);
  expect(b.samples).toBe(2);             // B appeared on both matches
});
