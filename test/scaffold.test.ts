import { expect, test } from "vitest";
import { namespaceOf } from "../src/types";

test("namespaceOf maps transports to signal namespaces", () => {
  expect(namespaceOf("ws-logs")).toBe("sig");
  expect(namespaceOf("grpc")).toBe("sig");
  expect(namespaceOf("ws-slots")).toBe("slot");
});
