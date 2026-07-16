import { AuditLog } from "@vigil/audit";
import { KeeperHubClient } from "@vigil/keeperhub";
import { type GuardDeps, type GuardSpec, runGuardCycle } from "./guardianLoop.js";

/**
 * Thin runtime entry. Operators wire their guard set through a bootstrap module;
 * this default runner just constructs shared infrastructure and ticks the cycle.
 */
const apiKey = process.env.KH_API_KEY ?? "";
const intervalMs = Number(process.env.INTERVAL_MS ?? "60000");

const kh = new KeeperHubClient({ apiKey });
const audit = new AuditLog();

const deps: GuardDeps = {
  keeperhub: kh as unknown as GuardDeps["keeperhub"],
  audit,
  reconcile: async () => undefined,
  now: () => Math.floor(Date.now() / 1000),
};

const guards: GuardSpec[] = [];

async function tick(): Promise<void> {
  const results = await runGuardCycle(guards, deps);
  for (const r of results) {
    process.stdout.write(`${JSON.stringify(r)}\n`);
  }
}

void tick();
setInterval(() => {
  void tick();
}, intervalMs);
