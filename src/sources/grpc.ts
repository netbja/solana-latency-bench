import bs58 from "bs58";
import Client, { CommitmentLevel, type SubscribeRequest } from "@triton-one/yellowstone-grpc";
import type { Sample, ConnStatus, EndpointConfig, LatencySource } from "../types";

export function extractGrpcSample(update: any, tArr: bigint, tWall: number): Sample | null {
  const tx = update?.transaction;
  const sig = tx?.transaction?.signature;
  if (!sig) return null;
  const key = bs58.encode(Buffer.from(sig));
  const slotRaw = tx?.slot;
  const slot = slotRaw != null ? Number(slotRaw) : undefined;
  return { key, kind: "sig", tArr, tWall, slot };
}

export class GrpcSource implements LatencySource {
  readonly name: string;
  readonly kind = "grpc" as const;
  private sampleCbs: ((s: Sample) => void)[] = [];
  private statusCbs: ((s: ConnStatus) => void)[] = [];
  private stopped = false;
  private reconnecting = false;
  private stream?: { end?: () => void };

  constructor(private cfg: EndpointConfig, private program: string) {
    this.name = cfg.name;
  }

  onSample(cb: (s: Sample) => void): void { this.sampleCbs.push(cb); }
  onStatus(cb: (s: ConnStatus) => void): void { this.statusCbs.push(cb); }
  private emitStatus(event: ConnStatus["event"]): void {
    const s: ConnStatus = { name: this.name, event, tWall: Date.now() };
    for (const cb of this.statusCbs) cb(s);
  }

  async start(): Promise<void> {
    const client = new Client(this.cfg.url, this.cfg.xToken, undefined);
    const stream = await client.subscribe();
    this.stream = stream as any;
    stream.on("data", (update: any) => {
      const tArr = process.hrtime.bigint(); // FIRST — before decode
      const tWall = Date.now();
      const s = extractGrpcSample(update, tArr, tWall);
      if (s) for (const cb of this.sampleCbs) cb(s);
    });
    stream.on("error", () => this.onStreamClosed());
    stream.on("end", () => this.onStreamClosed());

    const req: SubscribeRequest = {
      accounts: {}, slots: {}, transactionsStatus: {}, blocks: {}, blocksMeta: {}, entry: {}, accountsDataSlice: [],
      transactions: {
        pump: { vote: false, failed: false, accountInclude: [this.program], accountExclude: [], accountRequired: [] },
      },
      commitment: CommitmentLevel.PROCESSED,
    } as SubscribeRequest;

    await new Promise<void>((resolve, reject) => stream.write(req, (err: any) => (err ? reject(err) : resolve())));
    this.emitStatus("up");
  }

  private onStreamClosed(): void {
    // error and end commonly fire back-to-back for the same disconnect;
    // reconnect() below is idempotent so this stays safe even if called twice.
    if (this.stopped) return;
    this.emitStatus("down");
    this.reconnect();
  }

  private reconnect(): void {
    if (this.stopped || this.reconnecting) return;
    this.reconnecting = true;
    setTimeout(() => {
      if (this.stopped) { this.reconnecting = false; return; }
      this.reconnecting = false; // clear before start() so a future disconnect can reconnect
      this.emitStatus("reconnect");
      this.start().catch(() => { /* next error triggers another reconnect */ });
    }, 1000);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    try { this.stream?.end?.(); } catch { /* already closed */ }
  }
}
