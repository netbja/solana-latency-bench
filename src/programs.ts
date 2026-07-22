// Common program aliases so app-level tests can switch target by name.
// Verify a pubkey before relying on it — these are the widely-used mainnet defaults.
const ALIASES: Record<string, string> = {
  "pump.fun": "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  pumpfun: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  pumpswap: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
  "raydium-amm": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "raydium-clmm": "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
};

export function resolveProgram(input: string): string {
  return ALIASES[input.toLowerCase()] ?? input;
}

export function programAliases(): string[] {
  return Object.keys(ALIASES);
}
