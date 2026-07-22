export type Kind = "ws-logs" | "ws-slots" | "grpc";
export type SignalKind = "sig" | "slot";

export interface Sample {
  key: string;        // signature (sig) or slot number as string (slot)
  kind: SignalKind;
  tArr: bigint;       // hrtime.bigint() ns — stamped before parse
  tWall: number;      // Date.now() ms
  slot?: number;
}

export interface ConnStatus {
  name: string;
  event: "up" | "down" | "reconnect" | "ping-miss";
  tWall: number;
}

export interface FinalizedMatch {
  key: string;
  kind: SignalKind;
  firstWall: number;
  slot?: number;
  deltas: Map<string, bigint>;  // provider -> ns vs firstArr (0n = winner)
  missing: string[];            // providers (same namespace) with no arrival
}

export interface EndpointConfig {
  name: string;
  kind: Kind;
  url: string;
  xToken?: string;              // grpc auth token
}

export interface BenchConfig {
  program: string;
  windows: { warmupSec: number; cooldownSec: number; finalizeMs: number };
  endpoints: EndpointConfig[];
  rpcUrl?: string;  // JSON-RPC http endpoint for getBlockTime, only needed with --absolute
}

export interface LatencySource {
  readonly name: string;
  readonly kind: Kind;
  start(): Promise<void>;
  stop(): Promise<void>;
  onSample(cb: (s: Sample) => void): void;
  onStatus(cb: (s: ConnStatus) => void): void;
}

export interface ProviderStats {
  name: string;
  kind: Kind;
  samples: number;      // appearances (present in match)
  wins: number;         // delta === 0n
  winRate: number;      // wins / races-in-namespace
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  missed: number;       // missing while up
  missedRate: number;   // missed / races-in-namespace
  excludedDowntime: number;  // missing while down/reconnect
  reconnects: number;
  pingMisses: number;
  freshnessMs?: number;  // approximate absolute latency (median), only when --absolute
}

export interface Report {
  program: string;
  windowStartWall: number;
  windowEndWall: number;
  durationSec: number;
  totalMatches: number;
  matchesPerSec: number;
  providers: ProviderStats[];
}

export const SIG_KINDS: Kind[] = ["ws-logs", "grpc"];
export function namespaceOf(kind: Kind): SignalKind {
  return kind === "ws-slots" ? "slot" : "sig";
}
