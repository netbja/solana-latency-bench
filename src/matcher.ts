import type { Sample, FinalizedMatch, Kind, SignalKind } from "./types";
import { SIG_KINDS } from "./types";

interface Rec {
  key: string;
  kind: SignalKind;
  firstArr: bigint;
  firstWall: number;
  slot?: number;
  arrivals: Map<string, bigint>;
}

export class Matcher {
  private records = new Map<string, Rec>(); // internal key `${kind}:${key}`
  private rejected = new Set<string>();
  private sigProviders: string[];
  private slotProviders: string[];

  constructor(
    private opts: {
      providers: { name: string; kind: Kind }[];
      windowStartWall: number;
      windowEndWall: number;
      finalizeNs: bigint;
    },
  ) {
    this.sigProviders = opts.providers.filter((p) => SIG_KINDS.includes(p.kind)).map((p) => p.name);
    this.slotProviders = opts.providers.filter((p) => p.kind === "ws-slots").map((p) => p.name);
  }

  add(sample: Sample, provider: string): void {
    const ik = `${sample.kind}:${sample.key}`;
    if (this.rejected.has(ik)) return;
    let rec = this.records.get(ik);
    if (!rec) {
      if (sample.tWall < this.opts.windowStartWall || sample.tWall > this.opts.windowEndWall) {
        this.rejected.add(ik);
        return;
      }
      rec = { key: sample.key, kind: sample.kind, firstArr: sample.tArr, firstWall: sample.tWall, slot: sample.slot, arrivals: new Map() };
      this.records.set(ik, rec);
    }
    if (!rec.arrivals.has(provider)) {
      rec.arrivals.set(provider, sample.tArr);
      if (sample.tArr < rec.firstArr) rec.firstArr = sample.tArr;
    }
  }

  private finalize(rec: Rec): FinalizedMatch {
    const expected = rec.kind === "sig" ? this.sigProviders : this.slotProviders;
    const deltas = new Map<string, bigint>();
    for (const [p, t] of rec.arrivals) deltas.set(p, t - rec.firstArr);
    const missing = expected.filter((p) => !rec.arrivals.has(p));
    return { key: rec.key, kind: rec.kind, firstWall: rec.firstWall, slot: rec.slot, deltas, missing };
  }

  finalizeOlderThan(nowArr: bigint): FinalizedMatch[] {
    const out: FinalizedMatch[] = [];
    for (const [ik, rec] of this.records) {
      if (nowArr - rec.firstArr > this.opts.finalizeNs) {
        out.push(this.finalize(rec));
        this.records.delete(ik);
      }
    }
    return out;
  }

  flush(): FinalizedMatch[] {
    const out: FinalizedMatch[] = [];
    for (const rec of this.records.values()) out.push(this.finalize(rec));
    this.records.clear();
    return out;
  }
}
