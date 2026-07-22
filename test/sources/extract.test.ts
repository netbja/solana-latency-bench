import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { extractLogsSample } from "../../src/sources/ws-logs";
import { extractSlotSample } from "../../src/sources/ws-slots";
import { extractGrpcSample } from "../../src/sources/grpc";

const logs = JSON.parse(readFileSync("test/fixtures/logs-notification.json", "utf8"));
const slot = JSON.parse(readFileSync("test/fixtures/slot-notification.json", "utf8"));

test("extractLogsSample pulls signature + slot", () => {
  const s = extractLogsSample(logs, 7n, 1234)!;
  expect(s.kind).toBe("sig");
  expect(s.key).toBe(logs.params.result.value.signature);
  expect(s.slot).toBe(312345678);
  expect(s.tArr).toBe(7n);
  expect(s.tWall).toBe(1234);
});

test("extractLogsSample returns null on non-notification frames", () => {
  expect(extractLogsSample({ jsonrpc: "2.0", id: 1, result: 24040 }, 1n, 1)).toBeNull();
});

test("extractSlotSample uses slot number as key", () => {
  const s = extractSlotSample(slot, 3n, 9)!;
  expect(s.kind).toBe("slot");
  expect(s.key).toBe("312345678");
  expect(s.slot).toBe(312345678);
});

test("extractGrpcSample base58-encodes signature bytes + reads slot", () => {
  const upd = JSON.parse(readFileSync("test/fixtures/grpc-tx-update.json", "utf8"));
  // JSON stored bytes as array; simulate the runtime Uint8Array the lib delivers:
  upd.transaction.transaction.signature = Uint8Array.from(upd.transaction.transaction.signature);
  const s = extractGrpcSample(upd, 5n, 11)!;
  expect(s.kind).toBe("sig");
  expect(s.key).toBe("2VfUX");   // bs58.encode([1,2,3,4])
  expect(s.slot).toBe(312345678);
});

test("extractGrpcSample returns null on non-transaction updates", () => {
  expect(extractGrpcSample({ slot: { slot: "1" } }, 1n, 1)).toBeNull();
});
