export type Hex = `0x${string}`;

export type ProposedAction = {
  chainId: number;
  kind: "transfer" | "contract-call";
  to: Hex;
  functionName?: string;
  args?: readonly unknown[];
  value?: bigint; // native value moved
  spendWei?: bigint; // total economic outflow to bound (>= value); defaults to value
};

export type Policy = {
  maxSpendWei?: bigint;
  contractAllowlist?: readonly Hex[];
  minResultingHealthFactor?: number;
  maxSlippageBps?: number;
  rateLimit?: { maxActions: number; windowSec: number };
};

export type SimulationResult = {
  ok: boolean;
  gasEstimate?: bigint;
  revertReason?: string;
  resultingState?: { healthFactor?: number; slippageBps?: number; [k: string]: unknown };
};

export type EvalContext = { now: number; recentActionTs?: readonly number[] };

export type RuleId =
  | "simulation"
  | "max-spend"
  | "contract-allowlist"
  | "min-resulting-health-factor"
  | "max-slippage"
  | "rate-limit";

export type RuleFailure = { rule: RuleId; reason: string };

export type GuardDecision = {
  verdict: "allow" | "deny";
  failures: RuleFailure[];
  simulation: SimulationResult;
};
