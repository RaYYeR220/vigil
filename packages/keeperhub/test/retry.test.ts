import { describe, expect, it } from "vitest";
import { KeeperHubClient } from "../src/client.js";
import {
  KeeperHubAuthError,
  KeeperHubServerError,
  KeeperHubTransportError,
} from "../src/errors.js";
import {
  jsonResponse,
  recordingFetch,
  recordingSleep,
  sequenceFetch,
  textResponse,
} from "./support.js";

const transfer = { chainId: 1, recipientAddress: "0xr" as const, amount: "1" };
const call = { chainId: 1, contractAddress: "0xc" as const, functionName: "f", functionArgs: [] };

describe("KeeperHubClient retry policy", () => {
  it("retries after a 429 and then succeeds", async () => {
    const { fetchFn, calls } = sequenceFetch(
      jsonResponse(429, { message: "slow down" }, { "retry-after": "1" }),
      jsonResponse(202, { executionId: "ex-1", status: "completed" }),
    );
    const { sleepFn, delays } = recordingSleep();
    const client = new KeeperHubClient({ apiKey: "k", fetchFn, sleepFn });
    const result = await client.executeTransfer(transfer);
    expect(result.executionId).toBe("ex-1");
    expect(calls.length).toBe(2);
    expect(delays.length).toBe(1);
  });

  it("honors Retry-After seconds when retrying a 429", async () => {
    const { fetchFn } = sequenceFetch(
      jsonResponse(429, {}, { "retry-after": "2" }),
      jsonResponse(200, { success: true, wouldRevert: false }),
    );
    const { sleepFn, delays } = recordingSleep();
    const client = new KeeperHubClient({ apiKey: "k", fetchFn, sleepFn });
    await client.simulateTransfer(transfer);
    expect(delays[0]).toBe(2000);
  });

  it("retries a 503 with exponential backoff then succeeds", async () => {
    const { fetchFn } = sequenceFetch(
      jsonResponse(503, { message: "unavailable" }),
      jsonResponse(503, { message: "unavailable" }),
      jsonResponse(200, { success: true, wouldRevert: false }),
    );
    const { sleepFn, delays } = recordingSleep();
    const client = new KeeperHubClient({
      apiKey: "k",
      fetchFn,
      sleepFn,
      baseRetryDelayMs: 100,
    });
    const sim = await client.simulateContractCall(call);
    expect(sim.ok).toBe(true);
    expect(delays).toEqual([100, 200]);
  });

  it("throws a server error after exhausting retries on a persistent 500", async () => {
    const { fetchFn, calls } = recordingFetch(() => jsonResponse(500, { message: "boom" }));
    const { sleepFn } = recordingSleep();
    const client = new KeeperHubClient({ apiKey: "k", fetchFn, sleepFn, maxRetries: 3 });
    await expect(client.executeTransfer(transfer)).rejects.toBeInstanceOf(KeeperHubServerError);
    expect(calls.length).toBe(4);
  });
});

describe("KeeperHubClient error surface", () => {
  it("throws an auth error on 401 without retrying", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(401, { message: "invalid api key" }),
    );
    const { sleepFn } = recordingSleep();
    const client = new KeeperHubClient({ apiKey: "bad", fetchFn, sleepFn });
    await expect(client.simulateTransfer(transfer)).rejects.toBeInstanceOf(KeeperHubAuthError);
    expect(calls.length).toBe(1);
  });

  it("throws an auth error on 403 without retrying", async () => {
    const { fetchFn, calls } = recordingFetch(() => jsonResponse(403, { error: "forbidden" }));
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await expect(client.readContract(call)).rejects.toBeInstanceOf(KeeperHubAuthError);
    expect(calls.length).toBe(1);
  });

  it("throws a request error carrying the body message on a non-simulated 400", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(400, { message: "amount must be positive" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await expect(client.executeTransfer({ ...transfer, amount: "-1" })).rejects.toThrow(
      "amount must be positive",
    );
  });

  it("wraps a transport failure and does not retry it", async () => {
    let count = 0;
    const fetchFn = (() => {
      count += 1;
      return Promise.reject(new Error("ECONNRESET"));
    }) as typeof fetch;
    const { sleepFn } = recordingSleep();
    const client = new KeeperHubClient({ apiKey: "k", fetchFn, sleepFn });
    await expect(client.simulateTransfer(transfer)).rejects.toBeInstanceOf(KeeperHubTransportError);
    expect(count).toBe(1);
  });

  it("surfaces a non-JSON error body in the thrown message", async () => {
    const { fetchFn } = recordingFetch(() => textResponse(400, "Bad Request: malformed payload"));
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await expect(client.executeTransfer(transfer)).rejects.toThrow(
      "Bad Request: malformed payload",
    );
  });
});
