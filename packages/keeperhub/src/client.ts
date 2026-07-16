import type { SimulationResult } from "@vigil/guard-core";
import {
  KeeperHubAuthError,
  KeeperHubRequestError,
  KeeperHubServerError,
  KeeperHubTransportError,
} from "./errors.js";
import type {
  ContractCallParams,
  ExecuteResult,
  KeeperHubClientOptions,
  TransferParams,
} from "./types.js";

const TRANSFER_PATH = "/api/execute/transfer";
const CONTRACT_CALL_PATH = "/api/execute/contract-call";

type Parsed = { status: number; data: unknown; text: string };

export class KeeperHubClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;

  constructor(options: KeeperHubClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://app.keeperhub.com";
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxRetries = options.maxRetries ?? 3;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 200;
  }

  async simulateTransfer(p: TransferParams): Promise<SimulationResult> {
    const parsed = await this.send(TRANSFER_PATH, this.postInit(this.transferBody(p, true)));
    return this.asSimulation(parsed);
  }

  async simulateContractCall(p: ContractCallParams): Promise<SimulationResult> {
    const parsed = await this.send(
      CONTRACT_CALL_PATH,
      this.postInit(this.contractCallBody(p, true)),
    );
    return this.asSimulation(parsed);
  }

  async executeTransfer(
    p: TransferParams,
    opts?: { idempotencyKey?: string },
  ): Promise<ExecuteResult> {
    const init = this.postInit(this.transferBody(p), opts?.idempotencyKey);
    return this.asExecuteResult(await this.send(TRANSFER_PATH, init));
  }

  async executeContractCall(
    p: ContractCallParams,
    opts?: { idempotencyKey?: string },
  ): Promise<ExecuteResult> {
    const init = this.postInit(this.contractCallBody(p), opts?.idempotencyKey);
    return this.asExecuteResult(await this.send(CONTRACT_CALL_PATH, init));
  }

  async readContract(p: ContractCallParams): Promise<{ result: unknown }> {
    const parsed = await this.send(CONTRACT_CALL_PATH, this.postInit(this.contractCallBody(p)));
    this.assertOk(parsed);
    return { result: asRecord(parsed.data).result };
  }

  private asExecuteResult(parsed: Parsed): ExecuteResult {
    this.assertOk(parsed);
    const o = asRecord(parsed.data);
    return {
      executionId: typeof o.executionId === "string" ? o.executionId : "",
      status: o.status === "failed" ? "failed" : "completed",
    };
  }

  private assertOk(parsed: Parsed): void {
    if (parsed.status < 200 || parsed.status >= 300) {
      throw new KeeperHubRequestError(
        messageOf(parsed) || `request failed (${parsed.status})`,
        parsed.status,
      );
    }
  }

  private asSimulation(parsed: Parsed): SimulationResult {
    const ok2xx = parsed.status >= 200 && parsed.status < 300;
    const simulated400 = parsed.status === 400 && isSimulated(parsed.data);
    if (ok2xx || simulated400) return toSimulationResult(parsed.data);
    throw new KeeperHubRequestError(
      messageOf(parsed) || `request failed (${parsed.status})`,
      parsed.status,
    );
  }

  private async send(path: string, init: RequestInit): Promise<Parsed> {
    const url = `${this.baseUrl}${path}`;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchFn(url, init);
      } catch (err) {
        throw new KeeperHubTransportError(`network error calling ${path}`, undefined, {
          cause: err,
        });
      }

      const parsed = await readBody(res);
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        await this.sleepFn(this.retryDelay(res.headers, attempt));
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new KeeperHubAuthError(
          messageOf(parsed) || `unauthorized (${res.status})`,
          res.status,
        );
      }
      if (retryable) {
        throw new KeeperHubServerError(
          messageOf(parsed) || `server error (${res.status})`,
          res.status,
        );
      }
      return parsed;
    }
  }

  private retryDelay(headers: Headers, attempt: number): number {
    const retryAfter = headers.get("retry-after");
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    }
    return this.baseRetryDelayMs * 2 ** attempt;
  }

  private postInit(body: unknown, idempotencyKey?: string): RequestInit {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (idempotencyKey !== undefined) headers["Idempotency-Key"] = idempotencyKey;
    return { method: "POST", headers, body: JSON.stringify(body) };
  }

  private transferBody(p: TransferParams, simulate?: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      chainId: p.chainId,
      recipientAddress: p.recipientAddress,
      amount: p.amount,
    };
    if (p.tokenAddress !== undefined) body.tokenAddress = p.tokenAddress;
    if (p.tokenConfig !== undefined) body.tokenConfig = p.tokenConfig;
    if (p.gasLimitMultiplier !== undefined) body.gasLimitMultiplier = p.gasLimitMultiplier;
    if (simulate !== undefined) body.simulate = simulate;
    return body;
  }

  private contractCallBody(p: ContractCallParams, simulate?: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      chainId: p.chainId,
      contractAddress: p.contractAddress,
      functionName: p.functionName,
    };
    if (p.functionArgs !== undefined) body.functionArgs = JSON.stringify(p.functionArgs);
    if (p.abi !== undefined) body.abi = JSON.stringify(p.abi);
    if (p.value !== undefined) body.value = p.value;
    if (p.gasLimitMultiplier !== undefined) body.gasLimitMultiplier = p.gasLimitMultiplier;
    if (simulate !== undefined) body.simulate = simulate;
    return body;
  }
}

function asRecord(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

function isSimulated(data: unknown): boolean {
  return asRecord(data).status === "simulated";
}

function toSimulationResult(data: unknown): SimulationResult {
  const o = asRecord(data);
  const result: SimulationResult = { ok: o.success === true && o.wouldRevert !== true };
  const gas = o.gasEstimate;
  if ((typeof gas === "string" && gas !== "") || (typeof gas === "number" && gas !== 0)) {
    result.gasEstimate = BigInt(gas);
  }
  if (typeof o.revertReason === "string") result.revertReason = o.revertReason;
  return result;
}

function messageOf(parsed: Parsed): string {
  const o = asRecord(parsed.data);
  for (const key of ["revertReason", "message", "error"]) {
    const v = o[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return parsed.text.trim();
}

async function readBody(res: Response): Promise<Parsed> {
  const text = await res.text();
  let data: unknown;
  try {
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  return { status: res.status, data, text };
}
