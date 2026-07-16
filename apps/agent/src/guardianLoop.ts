import { evaluate } from "@vigil/guard-core";
import type {
  ExecutionReceipt,
  GuardDecision,
  Hex,
  Policy,
  ProposedAction,
  RiskEvent,
  RuleFailure,
  SimulationResult,
} from "@vigil/guard-core";

type CallParams = {
  chainId: number;
  contractAddress: Hex;
  functionName: string;
  functionArgs?: readonly unknown[] | undefined;
  value?: string | undefined;
};
type TransferParams = { chainId: number; recipientAddress: Hex; amount: string };
type ExecResult = { executionId: string; status: "completed" | "failed" };

/** The subset of the KeeperHub client the loop needs — injected so it can be faked in tests. */
export type SimClient = {
  simulateContractCall: (p: CallParams) => Promise<SimulationResult>;
  simulateTransfer: (p: TransferParams) => Promise<SimulationResult>;
  executeContractCall: (p: CallParams, opts?: { idempotencyKey?: string }) => Promise<ExecResult>;
  executeTransfer: (p: TransferParams, opts?: { idempotencyKey?: string }) => Promise<ExecResult>;
};

export type GuardDeps = {
  keeperhub: SimClient;
  audit: {
    append: (r: {
      event: RiskEvent;
      action: ProposedAction;
      decision: GuardDecision;
      receipt?: ExecutionReceipt;
      ts: number;
    }) => unknown;
  };
  reconcile: (
    chainId: number,
    exec: { executionId: string; status: string },
  ) => Promise<Hex | undefined>;
  now: () => number;
};

export type GuardSpec = {
  id: string;
  detector: { poll: () => Promise<RiskEvent | null> };
  policy: Policy;
  plan: (e: RiskEvent) => ProposedAction;
  recentActionTs?: number[];
};

export type CycleResult = {
  id: string;
  status: "idle" | "blocked" | "executed" | "error";
  failures?: RuleFailure[] | undefined;
  txHash?: Hex | undefined;
  executionId?: string | undefined;
  error?: string | undefined;
};

/**
 * Actions carry native value in wei (bigint), but KeeperHub's transfer amount and
 * payable-call value are decimal ether strings — convert without floating point.
 */
export function weiToEther(wei: bigint): string {
  const negative = wei < 0n;
  const digits = (negative ? -wei : wei).toString().padStart(19, "0");
  const whole = digits.slice(0, -18);
  const fraction = digits.slice(-18).replace(/0+$/, "");
  const value = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${value}` : value;
}

function toCall(a: ProposedAction): CallParams {
  return {
    chainId: a.chainId,
    contractAddress: a.to,
    functionName: a.functionName ?? "",
    functionArgs: a.args,
    value: a.value !== undefined ? weiToEther(a.value) : undefined,
  };
}

function toTransfer(a: ProposedAction): TransferParams {
  return { chainId: a.chainId, recipientAddress: a.to, amount: weiToEther(a.value ?? 0n) };
}

/**
 * One pass over every guard: detect -> plan -> simulate -> gate -> (execute) -> audit.
 * Each guard is isolated in a try/catch so one failure never aborts the others.
 */
export async function runGuardCycle(guards: GuardSpec[], deps: GuardDeps): Promise<CycleResult[]> {
  const results: CycleResult[] = [];
  for (const g of guards) {
    try {
      const event = await g.detector.poll();
      if (!event) {
        results.push({ id: g.id, status: "idle" });
        continue;
      }

      const action = g.plan(event);
      const sim: SimulationResult =
        action.kind === "transfer"
          ? await deps.keeperhub.simulateTransfer(toTransfer(action))
          : await deps.keeperhub.simulateContractCall(toCall(action));

      const ctx = {
        now: deps.now(),
        ...(g.recentActionTs !== undefined ? { recentActionTs: g.recentActionTs } : {}),
      };
      const decision = evaluate(action, g.policy, sim, ctx);

      if (decision.verdict === "deny") {
        deps.audit.append({ event, action, decision, ts: deps.now() });
        results.push({ id: g.id, status: "blocked", failures: decision.failures });
        continue;
      }

      const exec: ExecResult =
        action.kind === "transfer"
          ? await deps.keeperhub.executeTransfer(toTransfer(action))
          : await deps.keeperhub.executeContractCall(toCall(action));

      const txHash = await deps.reconcile(event.chainId, exec);
      const receipt: ExecutionReceipt = {
        executionId: exec.executionId,
        status: exec.status === "completed" ? "confirmed" : "failed",
        retries: 0,
        route: "public",
        ts: deps.now(),
        ...(txHash !== undefined ? { txHash } : {}),
      };
      deps.audit.append({ event, action, decision, receipt, ts: deps.now() });
      results.push({
        id: g.id,
        status: "executed",
        executionId: exec.executionId,
        ...(txHash !== undefined ? { txHash } : {}),
      });
    } catch (e) {
      results.push({ id: g.id, status: "error", error: String(e) });
    }
  }
  return results;
}
