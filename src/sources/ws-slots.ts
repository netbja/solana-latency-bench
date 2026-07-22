import type { Sample, EndpointConfig } from "../types";
import { WsSource } from "./ws-source";

export function extractSlotSample(msg: any, tArr: bigint, tWall: number): Sample | null {
  const slot = msg?.params?.result?.slot;
  if (typeof slot !== "number") return null;
  return { key: String(slot), kind: "slot", tArr, tWall, slot };
}

export function makeWsSlots(cfg: EndpointConfig): WsSource {
  return new WsSource({
    name: cfg.name,
    kind: "ws-slots",
    url: cfg.url,
    subscribeMsg: { jsonrpc: "2.0", id: 1, method: "slotSubscribe" },
    extract: extractSlotSample,
  });
}
