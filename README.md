# Vigil

**An autonomous on-chain risk guardian that never executes an unsafe action.**

Agents are good at deciding what to do. They are bad at doing it safely: a wrong
number, a stale price, a reverting call, an unbounded spend. Vigil is the layer
between an agent's intent and the chain. It watches on-chain risk, and when it
needs to act it puts every action through a **policy + simulation interlock**
before a single transaction is signed — then records the whole decision in a
tamper-evident trail. Execution rides on **KeeperHub** (reliable, gas-sponsored,
MEV-aware); Vigil owns the *judgement*.

**▶ [Watch the 2-minute demo](https://youtu.be/E-enUzuQLGo)**

```
 DETECT            DECIDE           GUARD  (the interlock)        EXECUTE            OBSERVE
 read on-chain  →  propose a     →  ┌ policy gate  ────────┐  →  KeeperHub       →  hash-chained
 state (Aave      protective       │ max-spend, allowlist, │     simulate +          audit trail
 health, oracle   action           │ min-health, slippage, │     private route,      (trigger → sim
 price, balance)                   │ rate-limit            │     retry, sponsor      → tx → outcome)
                                   └ simulation gate ──────┘     → real tx           replayable
                                     deny closes the gate
```

If any rule fails, or the KeeperHub dry-run would revert, the action is **denied
and logged — never sent**. Only an action that clears every rule *and* simulates
clean is executed.

## Architecture

A small pnpm/TypeScript monorepo of focused, independently-tested units.

| Package | Responsibility |
|---|---|
| `packages/guard-core` | The interlock. Pure, deterministic `evaluate(action, policy, simulation, ctx)` → allow/deny + reasons. No I/O. Property-tested: *no policy-violating action is ever allowed.* |
| `packages/detect` | Read layer. Aave health-factor, price-feed (Chainlink/Chronicle) and treasury-balance detectors; emits a typed `RiskEvent` on threshold cross. All reads injected → testable offline. |
| `packages/planner` | Maps a `RiskEvent` to a concrete protective `ProposedAction` (repay, add collateral, swap out, top up). |
| `packages/keeperhub` | KeeperHub client: `simulate*`, `execute*`, `getExecutionStatus` (the authoritative source of the transaction hash), typed errors, idempotency, retry/back-off. |
| `packages/audit` | SHA-256 hash-chained, tamper-evident execution log. `append` / `verify` / `export`. |
| `apps/agent` | The guardian loop — `runGuardCycle` wires detect → plan → simulate → guard → execute → reconcile → audit, isolating each guard so one failure never stops the rest. |
| `apps/dashboard` | The **Guardian Console** — a tamper-evident observability UI that renders the audit trail as a hash-linked chain: every detect → gate → simulate → execute decision, with the allow/deny verdict and the on-chain transaction front and centre. |

## KeeperHub integration

Vigil uses KeeperHub for depth, not just a single call:

- **Simulation-before-submit** — every action is dry-run through KeeperHub; a
  would-revert closes the guard.
- **Execution** — `execute_transfer` / `execute_contract_call`, gas-**sponsored**
  via a smart-account (a real tx lands with zero native balance on the wallet).
- **Status reconciliation** — `GET /api/execute/{id}/status` for the on-chain
  transaction hash, which the audit trail records and independently verifies.
- **Marketplace, guard-as-a-service** — Vigil's guard is published to the
  KeeperHub marketplace as a typed, discoverable per-workflow tool, **priced
  per call and settled in USDC over x402** — other agents can route their own
  position checks through it.
- **ERC-8004 identity** — the guardian is registered as a Trustless Agent on the
  ERC-8004 Identity Registry (Base mainnet), its registration file stored fully
  on-chain, executed through KeeperHub — so it's discoverable across the agent
  economy.

## Proof

- **Runs green with zero setup:** `pnpm test` → **100+ tests** across the six
  packages, including the guard's property invariants.
- **Lands real, verified transactions — on mainnet.** A full guarded cycle,
  end-to-end (detect → guard → simulate → execute → reconcile → audit, audit
  chain verified), landing a real gas-sponsored transaction on **Base mainnet**:
  [`0xf470488d…88ddc55`](https://basescan.org/tx/0xf470488dff89f952d6eba5e556413af5eea9654ba030c127257160bd088ddc55)
  — status `success`. (Same flow on Base Sepolia:
  [`0x2ef7e417…24bcde`](https://sepolia.basescan.org/tx/0x2ef7e4172128ef55b8e0284642b44c03e3bafea53aae6a217a2155092924bcde).)
- **Registered on-chain as a Trustless Agent.** Vigil holds ERC-8004 agent
  **#59164** on Base mainnet (registration file fully on-chain), minted through
  KeeperHub:
  [`0x43189a93…adc25a6`](https://basescan.org/tx/0x43189a9360e7a6083e0f30092fdfe0b55217ee7ec81d8b49da0bc1429adc25a6).

## Run it

```bash
pnpm install
pnpm test          # the whole suite, no keys required
pnpm typecheck
```

Drive the live guardian loop against Base Sepolia (needs a KeeperHub org API key
and a funded, KeeperHub-connected wallet):

```bash
KH_API_KEY=kh_... WALLET=0x... pnpm exec tsx apps/agent/examples/treasuryGuardSmoke.ts
```

It reads a real balance, runs the full cycle, lands a sponsored protective
transfer, reconciles the hash, and prints the verified BaseScan link plus the
tamper-evident audit trail.

Open the **Guardian Console** (the observability UI):

```bash
pnpm --filter @vigil/dashboard gen     # regenerate the demo audit chain
pnpm --filter @vigil/dashboard serve   # serve it at http://localhost:4319
```

## Status & limits

- Chains: Base (mainnet + Sepolia). Private-mempool routing is Ethereum-only on
  KeeperHub, so MEV-protected routing is demonstrated there.
- Detectors read live on-chain state; the health-factor and depeg guards are
  wired against Aave v3 and Chainlink/Chronicle feeds.
- The marketplace guard is listed and x402-priced; caller-input plumbing for the
  hosted call path is still being finalised.

## License

MIT.
