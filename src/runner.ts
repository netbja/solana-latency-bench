import type { BenchConfig, EndpointConfig, FinalizedMatch, LatencySource, Report } from "./types";
import { Matcher } from "./matcher";
import { StatsEngine } from "./stats";
import { FreshnessSampler } from "./freshness";
import { makeWsLogs } from "./sources/ws-logs";
import { makeWsSlots } from "./sources/ws-slots";
import { GrpcSource } from "./sources/grpc";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function buildSource(e: EndpointConfig, program: string): LatencySource {
  switch (e.kind) {
    case "ws-logs": return makeWsLogs(e, program);
    case "ws-slots": return makeWsSlots(e);
    case "grpc": return new GrpcSource(e, program);
  }
}

async function defaultGetBlockTime(rpcUrl: string, slot: number): Promise<number | null> {
  const res = await fetch(rpcUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBlockTime", params: [slot] }),
  });
  const j = await res.json();
  return typeof j?.result === "number" ? j.result : null;
}

export async function runBench(
  cfg: BenchConfig,
  opts: { durationSec: number; absolute?: boolean; getBlockTime?: (slot: number) => Promise<number | null> },
  sources?: LatencySource[],
): Promise<Report> {
  const providers = cfg.endpoints.map((e) => ({ name: e.name, kind: e.kind }));
  const startWall = Date.now();
  const windowStartWall = startWall + cfg.windows.warmupSec * 1000;
  const windowEndWall = startWall + (opts.durationSec - cfg.windows.cooldownSec) * 1000;
  const matcher = new Matcher({
    providers, windowStartWall, windowEndWall,
    finalizeNs: BigInt(Math.round(cfg.windows.finalizeMs)) * 1_000_000n,
  });
  const stats = new StatsEngine(providers);
  const srcs = sources ?? cfg.endpoints.map((e) => buildSource(e, cfg.program));

  // Secondary/approximate metric (spec §6), OFF unless --absolute. Fail fast (before running)
  // rather than silently degrading mid-bench if config is missing what the sampler needs.
  let sampler: FreshnessSampler | undefined;
  if (opts.absolute) {
    let getBlockTime = opts.getBlockTime;
    if (!getBlockTime) {
      if (!cfg.rpcUrl) {
        throw new Error("--absolute requires config.rpcUrl (JSON-RPC endpoint for getBlockTime), or an injected getBlockTime");
      }
      const rpcUrl = cfg.rpcUrl;
      getBlockTime = (slot: number) => defaultGetBlockTime(rpcUrl, slot);
    }
    sampler = new FreshnessSampler(getBlockTime);
  }
  const finalizedForFreshness: FinalizedMatch[] = [];

  for (const src of srcs) {
    src.onSample((s) => matcher.add(s, src.name));
    src.onStatus((st) => stats.addStatus(st));
  }
  // allSettled: one endpoint failing to start (e.g. an unreachable gRPC target) must not
  // abort the whole run (design §5) — it is reported with 0 samples instead.
  await Promise.allSettled(srcs.map((s) => s.start()));

  const timer = setInterval(() => {
    for (const m of matcher.finalizeOlderThan(process.hrtime.bigint())) {
      stats.addMatch(m);
      // Buffered here (not sampled inline) so this synchronous 1s tick never awaits; retained only when --absolute is on.
      if (sampler) finalizedForFreshness.push(m);
    }
  }, 1000);

  await sleep(opts.durationSec * 1000);
  clearInterval(timer);
  await Promise.all(srcs.map((s) => s.stop()));
  for (const m of matcher.flush()) {
    stats.addMatch(m);
    if (sampler) finalizedForFreshness.push(m);
  }

  const report = stats.report({ program: cfg.program, windowStartWall, windowEndWall });

  if (sampler) {
    // Awaited outside the setInterval callback (see finalizedForFreshness) to keep the
    // 1s finalize tick synchronous; getBlockTime calls happen here in one batch instead.
    for (const m of finalizedForFreshness) await sampler.record(m);
    const meds = sampler.medians();
    for (const p of report.providers) p.freshnessMs = meds.get(p.name);
  }

  return report;
}
