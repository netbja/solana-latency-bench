import type { FinalizedMatch } from "./types";

export class FreshnessSampler {
  private byProvider = new Map<string, number[]>();
  private cache = new Map<number, number | null>();

  constructor(
    private getBlockTime: (slot: number) => Promise<number | null>,
    private opts: { correctionMs?: number } = {},
  ) {}

  async record(m: FinalizedMatch): Promise<void> {
    if (m.slot == null) return;
    let bt = this.cache.get(m.slot);
    if (bt === undefined) { bt = await this.getBlockTime(m.slot); this.cache.set(m.slot, bt); }
    if (bt == null) return;
    const blockWallMs = bt * 1000 + (this.opts.correctionMs ?? 500);
    // firstWall is the winner's arrival; each provider's arrival = firstWall + delta(ms)
    for (const [p, d] of m.deltas) {
      const arrivalMs = m.firstWall + Number(d) / 1e6;
      const arr = this.byProvider.get(p) ?? [];
      arr.push(arrivalMs - blockWallMs);
      this.byProvider.set(p, arr);
    }
  }

  medians(): Map<string, number> {
    const out = new Map<string, number>();
    for (const [p, arr] of this.byProvider) {
      if (arr.length === 0) continue;
      const s = [...arr].sort((a, b) => a - b);
      out.set(p, s[Math.floor((s.length - 1) / 2)]);
    }
    return out;
  }
}
