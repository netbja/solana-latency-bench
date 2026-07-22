# solana-latency-bench

Compare Solana streaming providers (WS `logsSubscribe`/`slotSubscribe`, gRPC/Yellowstone) by how fast
each delivers the same transaction. Relative ranking — no block-time bias.

## Run

```bash
npm install
npm link                                    # once — exposes the `slb` command
cp endpoints.jsonc endpoints.local.jsonc    # edit; add real endpoints
export HELIUS_API_KEY=...                    # secrets via env

slb --config endpoints.local.jsonc --duration 120

# switch the app under test by alias (or pass a raw program pubkey):
slb --config endpoints.local.jsonc --program pumpswap --duration 120
```

Outputs a console table plus `out/report.json` / `out/report.csv`.

Without linking, the same works via `npm run bench -- <args>` (the `--` forwards args past npm) or
`npx tsx src/cli.ts <args>`. `slb` and `solana-latency-bench` are aliases for the same command.

`--program` accepts an **alias** (`pump.fun`, `pumpswap`, `raydium-amm`, `raydium-clmm`) or any raw
program pubkey. The config `program` field accepts aliases too. This makes it easy to benchmark
provider latency for different on-chain apps.

## Reading the report

- **win%** — share of races (in its namespace) this provider delivered first. Headline metric.
- **p50/p95/p99/max** — delta (ms) behind the fastest, across the txs it delivered.
- **miss%** — delivered by someone else but not this provider (while it was up). Reliability signal.
- **downt** — absent because it was reconnecting (not counted as missed).
- **reconn** — reconnections during the run.

## Notes

- Needs **≥ 2 endpoints** to compare. `ws-logs` and `grpc` are compared to each other (signature
  namespace); `ws-slots` is ranked separately (slot namespace).
- gRPC needs a **paid Geyser** endpoint (`xToken` auth). Helius Free supports `ws-logs`/`ws-slots`.
- Free peers to try against Helius Free: the public `wss://api.mainnet-beta.solana.com` (rate-limited),
  or a second free provider key. Two free `ws-logs` endpoints already give a useful comparison.
- Live runs are validated manually (real endpoints); the pure Matcher/StatsEngine carry the test suite.

## License

MIT — see [LICENSE](LICENSE).
