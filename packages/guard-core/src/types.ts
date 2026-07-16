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

export type RiskEvent = {
  type: "liquidation" | "depeg" | "treasury-floor";
  chainId: number;
  subject: string;
  observedValue: number;
  threshold: number;
  severity: "warn" | "critical";
  ts: number;
};

export type ExecutionReceipt = {
  executionId: string;
  txHash?: Hex;
  gasUsed?: bigint;
  status: "submitted" | "confirmed" | "failed";
  retries: number;
  route: "private" | "public";
  ts: number;
};

export type AuditRecord = {
  seq: number;
  prevHash: string;
  hash: string;
  event: RiskEvent;
  action: ProposedAction;
  decision: Omit<GuardDecision, never>;
  receipt?: ExecutionReceipt;
  ts: number;
};
