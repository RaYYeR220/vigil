import type { ProposedAction, RiskEvent, SimulationResult } from "@vigil/guard-core";
import { describe, expect, it, vi } from "vitest";
import { type GuardDeps, type GuardSpec, runGuardCycle } from "../src/guardianLoop.js";

const event: RiskEvent = {
  type: "liquidation",
  chainId: 8453,
  subject: "0xuser",
  observedValue: 1.2,
  threshold: 1.5,
  severity: "critical",
  ts: 1,
};

const callAction: ProposedAction = {
  chainId: 8453,
  kind: "contract-call",
  to: "0xpool",
  functionName: "repay",
  args: ["0xdebt", 100n],
  spendWei: 0n,
};

type Deps = {
  deps: GuardDeps;
  append: ReturnType<typeof vi.fn>;
  execCall: ReturnType<typeof vi.fn>;
};

function makeDeps(
  opts: {
    sim?: SimulationResult;
    exec?: { executionId: string; status: "completed" | "failed" };
    txHash?: `0x${string}`;
  } = {},
): Deps {
  const append = vi.fn();
  const sim = opts.sim ?? { ok: true };
  const exec = opts.exec ?? { executionId: "ex1", status: "completed" as const };
  const execCall = vi.fn(async () => exec);
  const deps: GuardDeps = {
    keeperhub: {
      simulateContractCall: async () => sim,
      simulateTransfer: async () => sim,
      executeContractCall: execCall,
      executeTransfer: vi.fn(async () => exec),
    },
    audit: { append },
    reconcile: async () => opts.txHash,
    now: () => 42,
  };
  return { deps, append, execCall };
}

const spec = (over: Partial<GuardSpec> = {}): GuardSpec => ({
  id: "g1",
  detector: { poll: async () => event },
  policy: {},
  plan: () => callAction,
  ...over,
});

describe("runGuardCycle", () => {
  it("is idle when the detector finds nothing", async () => {
    const { deps, append, execCall } = makeDeps();
    const [r] = await runGuardCycle([spec({ detector: { poll: async () => null } })], deps);
    expect(r?.status).toBe("idle");
    expect(execCall).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it("blocks and audits when the simulation would revert", async () => {
    const { deps, append, execCall } = makeDeps({ sim: { ok: false, revertReason: "boom" } });
    const [r] = await runGuardCycle([spec()], deps);
    expect(r?.status).toBe("blocked");
    expect(execCall).not.toHaveBeenCalled();
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0]?.[0]).toMatchObject({ decision: { verdict: "deny" } });
    expect(append.mock.calls[0]?.[0]).not.toHaveProperty("receipt");
  });

  it("blocks when the policy denies, without executing", async () => {
    const { deps, execCall } = makeDeps();
    const [r] = await runGuardCycle([spec({ policy: { contractAllowlist: ["0xother"] } })], deps);
    expect(r?.status).toBe("blocked");
    expect(r?.failures?.some((f) => f.rule === "contract-allowlist")).toBe(true);
    expect(execCall).not.toHaveBeenCalled();
  });

  it("executes and audits with a receipt when the guard allows", async () => {
    const { deps, append, execCall } = makeDeps({ txHash: "0xhash" });
    const [r] = await runGuardCycle([spec()], deps);
    expect(r?.status).toBe("executed");
    expect(r?.txHash).toBe("0xhash");
    expect(r?.executionId).toBe("ex1");
    expect(execCall).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0]?.[0]?.receipt).toMatchObject({
      txHash: "0xhash",
      status: "confirmed",
      route: "public",
    });
  });

  it("records an error and keeps going when one detector throws", async () => {
    const { deps } = makeDeps();
    const results = await runGuardCycle(
      [
        spec({
          id: "bad",
          detector: {
            poll: async () => {
              throw new Error("rpc down");
            },
          },
        }),
        spec({ id: "good" }),
      ],
      deps,
    );
    expect(results.find((r) => r.id === "bad")?.status).toBe("error");
    expect(results.find((r) => r.id === "good")?.status).toBe("executed");
  });

  it("handles a mixed batch of guards", async () => {
    const { deps } = makeDeps({ txHash: "0xhash" });
    const results = await runGuardCycle(
      [
        spec({ id: "idle", detector: { poll: async () => null } }),
        spec({ id: "blocked", policy: { contractAllowlist: ["0xother"] } }),
        spec({ id: "exec" }),
      ],
      deps,
    );
    expect(results.map((r) => r.status)).toEqual(["idle", "blocked", "executed"]);
  });
});
