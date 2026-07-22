import { expect, test } from "vitest";
import { resolveProgram } from "../src/programs";

test("resolves known aliases case-insensitively", () => {
  expect(resolveProgram("pump.fun")).toBe("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
  expect(resolveProgram("PumpSwap")).toBe("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
});

test("passes through raw pubkeys / unknowns unchanged", () => {
  expect(resolveProgram("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")).toBe("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
  expect(resolveProgram("P")).toBe("P");
});
