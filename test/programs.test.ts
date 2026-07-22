import { expect, test } from "vitest";
import { resolveProgram, resolveProgramChecked } from "../src/programs";

test("resolves known aliases case-insensitively", () => {
  expect(resolveProgram("pump.fun")).toBe("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
  expect(resolveProgram("PumpSwap")).toBe("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
});

test("passes through raw pubkeys / unknowns unchanged", () => {
  expect(resolveProgram("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")).toBe("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
  expect(resolveProgram("P")).toBe("P");
});

test("resolveProgramChecked resolves aliases and passes through valid pubkeys", () => {
  expect(resolveProgramChecked("pump.fun")).toBe("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
  expect(resolveProgramChecked("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")).toBe("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
});

test("resolveProgramChecked throws on a too-short non-alias", () => {
  expect(() => resolveProgramChecked("xyz")).toThrow(/alias or a base58 pubkey/);
});
