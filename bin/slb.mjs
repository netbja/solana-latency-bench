#!/usr/bin/env node
// Thin launcher so `slb` / `solana-latency-bench` run the TypeScript CLI via tsx
// without the `npm run bench --` dance. Node shebang is universal; we locate tsx
// from the package's own node_modules (present after install/link) and fall back
// to a tsx on PATH, forwarding argv + stdio.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const localTsx = fileURLToPath(new URL("../node_modules/.bin/tsx", import.meta.url));
const tsxBin = existsSync(localTsx) ? localTsx : "tsx";

const res = spawnSync(tsxBin, [cli, ...process.argv.slice(2)], { stdio: "inherit" });
if (res.error) {
  console.error(
    `solana-latency-bench: could not launch tsx (${tsxBin}). ` +
      `Run \`npm install\` in the repo first.`,
  );
  process.exit(1);
}
process.exit(res.status ?? 0);
