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

// Shared by cli.ts and config.ts so both entry points reject a too-short
// non-alias program the same way instead of silently running on it.
export function resolveProgramChecked(input: string): string {
  const resolved = resolveProgram(input);
  if (resolved.length < 32) {
    throw new Error(`program must be a known alias or a base58 pubkey (>=32 chars): "${input}"`);
  }
  return resolved;
}

export function programAliases(): string[] {
  return Object.keys(ALIASES);
}
