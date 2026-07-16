import type { Hex } from "@vigil/guard-core";

export type TransferParams = {
  chainId: number;
  recipientAddress: Hex;
  amount: string;
  tokenAddress?: Hex;
  tokenConfig?: string;
  gasLimitMultiplier?: string;
};

export type ContractCallParams = {
  chainId: number;
  contractAddress: Hex;
  functionName: string;
  functionArgs?: readonly unknown[];
  abi?: unknown;
  value?: string;
  gasLimitMultiplier?: string;
};

export type ExecuteResult = {
  executionId: string;
  status: "completed" | "failed";
};

export type ExecutionStatus = {
  executionId: string;
  status: "pending" | "running" | "completed" | "failed";
  transactionHash?: Hex;
  transactionLink?: string;
  gasUsedWei?: string;
  error?: string | null;
};

export type KeeperHubClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  maxRetries?: number;
  baseRetryDelayMs?: number;
};
