import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config";
import { runBench } from "./runner";
import { formatConsole, toCsv, toJson } from "./report";
import { resolveProgram, programAliases } from "./programs";

const HELP = `solana-latency-bench
  --config <path>     config file (default endpoints.jsonc)
  --program <alias|pubkey>  override program (aliases: ${programAliases().join(", ")})
  --duration <sec>    run length (default 60)
  --warmup <sec>      override warmup
  --cooldown <sec>    override cooldown
  --finalize <ms>     override finalize timeout
  --out <path-prefix> output prefix (default out/report) -> <prefix>.json/.csv
  --absolute          also report approximate absolute freshness vs block_time (needs config.rpcUrl)
  --help`;

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: "string", default: "endpoints.jsonc" },
      program: { type: "string" },
      duration: { type: "string", default: "60" },
      warmup: { type: "string" },
      cooldown: { type: "string" },
      finalize: { type: "string" },
      out: { type: "string", default: "out/report" },
      absolute: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) { console.log(HELP); return; }

  const cfg = loadConfig(values.config!);
  cfg.program = resolveProgram(values.program ?? cfg.program); // alias or raw pubkey (config value may also be an alias)
  if (values.warmup) cfg.windows.warmupSec = Number(values.warmup);
  if (values.cooldown) cfg.windows.cooldownSec = Number(values.cooldown);
  if (values.finalize) cfg.windows.finalizeMs = Number(values.finalize);

  const durationSec = Number(values.duration);
  console.error(`running ${durationSec}s over ${cfg.endpoints.length} endpoints on ${cfg.program} ...`);
  const report = await runBench(cfg, { durationSec, absolute: values.absolute });

  console.log(formatConsole(report));
  const prefix = values.out!;
  mkdirSync(dirname(prefix), { recursive: true });
  writeFileSync(`${prefix}.json`, toJson(report));
  writeFileSync(`${prefix}.csv`, toCsv(report));
  console.error(`wrote ${prefix}.json and ${prefix}.csv`);
}

main().catch((e) => { console.error(e); process.exit(1); });
