import type { FinalizedMatch, ConnStatus, Kind, Report, ProviderStats } from "./types";
import { namespaceOf } from "./types";

export function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedMs.length);
  const idx = Math.min(sortedMs.length - 1, Math.max(0, rank - 1));
  return sortedMs[idx];
}

export class StatsEngine {
  private deltasMs = new Map<string, number[]>();
  private wins = new Map<string, number>();
  private missed = new Map<string, number>();
  private downtime = new Map<string, number>();
  private reconnects = new Map<string, number>();
  private pingMisses = new Map<string, number>();
  private status = new Map<string, ConnStatus[]>();
  private racesByNs: Record<"sig" | "slot", number> = { sig: 0, slot: 0 };

  constructor(private providers: { name: string; kind: Kind }[]) {
    for (const p of providers) {
      this.deltasMs.set(p.name, []);
      this.wins.set(p.name, 0);
      this.missed.set(p.name, 0);
      this.downtime.set(p.name, 0);
      this.reconnects.set(p.name, 0);
      this.pingMisses.set(p.name, 0);
      this.status.set(p.name, []);
    }
  }

  addStatus(s: ConnStatus): void {
    this.status.get(s.name)?.push(s);
    if (s.event === "reconnect") this.reconnects.set(s.name, (this.reconnects.get(s.name) ?? 0) + 1);
    if (s.event === "ping-miss") this.pingMisses.set(s.name, (this.pingMisses.get(s.name) ?? 0) + 1);
  }

  private wasUp(provider: string, wall: number): boolean {
    let up = false;
    for (const e of this.status.get(provider) ?? []) {
      if (e.tWall > wall) break;
      if (e.event === "up") up = true;
      else if (e.event === "down" || e.event === "reconnect") up = false;
    }
    return up;
  }

  addMatch(m: FinalizedMatch): void {
    this.racesByNs[m.kind]++;
    for (const [p, d] of m.deltas) {
      this.deltasMs.get(p)?.push(Number(d) / 1e6);
      if (d === 0n) this.wins.set(p, (this.wins.get(p) ?? 0) + 1);
    }
    for (const p of m.missing) {
      if (this.wasUp(p, m.firstWall)) this.missed.set(p, (this.missed.get(p) ?? 0) + 1);
      else this.downtime.set(p, (this.downtime.get(p) ?? 0) + 1);
    }
  }

  report(meta: { program: string; windowStartWall: number; windowEndWall: number }): Report {
    const durationSec = Math.max(0, (meta.windowEndWall - meta.windowStartWall) / 1000);
    const totalMatches = this.racesByNs.sig + this.racesByNs.slot;
    const providers: ProviderStats[] = this.providers.map((p) => {
      const races = this.racesByNs[namespaceOf(p.kind)];
      const ds = [...(this.deltasMs.get(p.name) ?? [])].sort((a, b) => a - b);
      const wins = this.wins.get(p.name) ?? 0;
      const missed = this.missed.get(p.name) ?? 0;
      return {
        name: p.name,
        kind: p.kind,
        samples: ds.length,
        wins,
        winRate: races ? wins / races : 0,
        p50Ms: percentile(ds, 50),
        p95Ms: percentile(ds, 95),
        p99Ms: percentile(ds, 99),
        maxMs: ds.length ? ds[ds.length - 1] : 0,
        missed,
        missedRate: races ? missed / races : 0,
        excludedDowntime: this.downtime.get(p.name) ?? 0,
        reconnects: this.reconnects.get(p.name) ?? 0,
        pingMisses: this.pingMisses.get(p.name) ?? 0,
      };
    });
    return {
      program: meta.program,
      windowStartWall: meta.windowStartWall,
      windowEndWall: meta.windowEndWall,
      durationSec,
      totalMatches,
      matchesPerSec: durationSec ? totalMatches / durationSec : 0,
      providers,
    };
  }
}
