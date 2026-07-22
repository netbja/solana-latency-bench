import WebSocket from "ws";
import type { Sample, ConnStatus, Kind, LatencySource } from "../types";

export interface WsSourceCfg {
  name: string;
  kind: Kind;
  url: string;
  subscribeMsg: object;
  extract: (msg: any, tArr: bigint, tWall: number) => Sample | null;
  heartbeatMs?: number;
  reconnectMs?: number;
}

export class WsSource implements LatencySource {
  readonly name: string;
  readonly kind: Kind;
  private ws?: WebSocket;
  private sampleCbs: ((s: Sample) => void)[] = [];
  private statusCbs: ((s: ConnStatus) => void)[] = [];
  private stopped = false;
  private pongOk = true;
  private hb?: ReturnType<typeof setInterval>;

  constructor(private cfg: WsSourceCfg) {
    this.name = cfg.name;
    this.kind = cfg.kind;
  }

  onSample(cb: (s: Sample) => void): void { this.sampleCbs.push(cb); }
  onStatus(cb: (s: ConnStatus) => void): void { this.statusCbs.push(cb); }

  private emitStatus(event: ConnStatus["event"]): void {
    const s: ConnStatus = { name: this.name, event, tWall: Date.now() };
    for (const cb of this.statusCbs) cb(s);
  }

  async start(): Promise<void> { this.connect(); }

  private connect(): void {
    const ws = new WebSocket(this.cfg.url);
    this.ws = ws;
    ws.on("open", () => {
      ws.send(JSON.stringify(this.cfg.subscribeMsg));
      this.pongOk = true;
      this.emitStatus("up");
      this.startHeartbeat();
    });
    ws.on("message", (data: WebSocket.RawData) => {
      const tArr = process.hrtime.bigint(); // FIRST — before parse
      const tWall = Date.now();
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      const s = this.cfg.extract(msg, tArr, tWall);
      if (s) for (const cb of this.sampleCbs) cb(s);
    });
    ws.on("pong", () => { this.pongOk = true; });
    ws.on("close", () => this.onDrop());
    ws.on("error", () => { /* 'close' follows */ });
  }

  private startHeartbeat(): void {
    const ms = this.cfg.heartbeatMs ?? 10_000;
    if (this.hb) clearInterval(this.hb);
    this.hb = setInterval(() => {
      if (!this.pongOk) { this.emitStatus("ping-miss"); this.ws?.terminate(); return; }
      this.pongOk = false;
      try { this.ws?.ping(); } catch { /* terminating */ }
    }, ms);
  }

  private onDrop(): void {
    if (this.hb) clearInterval(this.hb);
    if (this.stopped) return;
    this.emitStatus("down");
    setTimeout(() => {
      if (this.stopped) return;
      this.emitStatus("reconnect");
      this.connect();
    }, this.cfg.reconnectMs ?? 1000);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.hb) clearInterval(this.hb);
    this.ws?.close();
  }
}
