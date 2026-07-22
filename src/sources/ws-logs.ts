import type { Sample, EndpointConfig } from "../types";
import { WsSource } from "./ws-source";

export function extractLogsSample(msg: any, tArr: bigint, tWall: number): Sample | null {
  const v = msg?.params?.result?.value;
  if (!v || typeof v.signature !== "string") return null;
  const slot = msg?.params?.result?.context?.slot;
  return { key: v.signature, kind: "sig", tArr, tWall, slot: typeof slot === "number" ? slot : undefined };
}

export function makeWsLogs(cfg: EndpointConfig, program: string): WsSource {
  return new WsSource({
    name: cfg.name,
    kind: "ws-logs",
    url: cfg.url,
    subscribeMsg: {
      jsonrpc: "2.0",
      id: 1,
      method: "logsSubscribe",
      params: [{ mentions: [program] }, { commitment: "processed" }],
    },
    extract: extractLogsSample,
  });
}
