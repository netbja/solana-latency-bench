import type { Report } from "./types";

export function toJson(r: Report): string {
  return JSON.stringify(r, null, 2);
}

const CSV_HEAD = [
  "name", "kind", "samples", "wins", "winRate",
  "p50Ms", "p95Ms", "p99Ms", "maxMs",
  "missed", "missedRate", "excludedDowntime", "reconnects", "pingMisses",
];

export function toCsv(r: Report): string {
  // --absolute off (the default) leaves the CSV byte-identical to before: the freshnessMs
  // column only appears when at least one provider actually carries the metric.
  const hasFreshness = r.providers.some((p) => p.freshnessMs !== undefined);
  const head = hasFreshness ? [...CSV_HEAD, "freshnessMs"] : CSV_HEAD;
  const rows = r.providers.map((p) => {
    const cols = [
      p.name, p.kind, p.samples, p.wins, p.winRate.toFixed(4),
      p.p50Ms.toFixed(3), p.p95Ms.toFixed(3), p.p99Ms.toFixed(3), p.maxMs.toFixed(3),
      p.missed, p.missedRate.toFixed(4), p.excludedDowntime, p.reconnects, p.pingMisses,
    ];
    if (hasFreshness) cols.push(p.freshnessMs !== undefined ? p.freshnessMs.toFixed(0) : "");
    return cols.join(",");
  });
  return [head.join(","), ...rows].join("\n");
}

export function formatConsole(r: Report): string {
  const lines: string[] = [];
  lines.push(`program=${r.program}  matches=${r.totalMatches}  ${r.matchesPerSec.toFixed(2)}/s  window=${r.durationSec.toFixed(0)}s`);
  lines.push(["provider", "kind", "win%", "p50", "p95", "p99", "max", "miss%", "downt", "reconn"].join("\t"));
  const sorted = [...r.providers].sort((a, b) => b.winRate - a.winRate);
  for (const p of sorted) {
    lines.push([
      p.name, p.kind, (p.winRate * 100).toFixed(1),
      p.p50Ms.toFixed(1), p.p95Ms.toFixed(1), p.p99Ms.toFixed(1), p.maxMs.toFixed(1),
      (p.missedRate * 100).toFixed(1), p.excludedDowntime, p.reconnects,
    ].join("\t"));
  }
  if (r.providers.some((p) => p.freshnessMs !== undefined)) {
    lines.push("");
    lines.push("absolute freshness (median ms, APPROX ±500ms–1s, block_time is second-resolution):");
    for (const p of r.providers) {
      if (p.freshnessMs !== undefined) lines.push(`  ${p.name}\t${p.freshnessMs.toFixed(0)}`);
    }
  }
  return lines.join("\n");
}
