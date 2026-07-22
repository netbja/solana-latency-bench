import type { BenchConfig, EndpointConfig, LatencySource, Report } from "./types";
import { Matcher } from "./matcher";
import { StatsEngine } from "./stats";
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

export async function runBench(
  cfg: BenchConfig,
  opts: { durationSec: number },
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

  for (const src of srcs) {
    src.onSample((s) => matcher.add(s, src.name));
    src.onStatus((st) => stats.addStatus(st));
  }
  await Promise.all(srcs.map((s) => s.start()));

  const timer = setInterval(() => {
    for (const m of matcher.finalizeOlderThan(process.hrtime.bigint())) stats.addMatch(m);
  }, 1000);

  await sleep(opts.durationSec * 1000);
  clearInterval(timer);
  await Promise.all(srcs.map((s) => s.stop()));
  for (const m of matcher.flush()) stats.addMatch(m);

  return stats.report({ program: cfg.program, windowStartWall, windowEndWall });
}
