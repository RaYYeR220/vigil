import { describe, expect, it } from "vitest";
import { KeeperHubClient } from "../src/client.js";
import { jsonResponse, recordingFetch } from "./support.js";

describe("KeeperHubClient request building", () => {
  it("targets the transfer endpoint with bearer auth and JSON headers", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(200, { success: true, wouldRevert: false }),
    );
    const client = new KeeperHubClient({ apiKey: "secret", fetchFn });
    await client.simulateTransfer({ chainId: 8453, recipientAddress: "0xrecip", amount: "1.5" });

    expect(calls[0].url).toBe("https://app.keeperhub.com/api/execute/transfer");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].headers.get("authorization")).toBe("Bearer secret");
    expect(calls[0].headers.get("accept")).toBe("application/json");
    expect(calls[0].headers.get("content-type")).toBe("application/json");
  });

  it("honors a custom baseUrl", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(200, { success: true, wouldRevert: false }),
    );
    const client = new KeeperHubClient({
      apiKey: "k",
      baseUrl: "https://staging.keeperhub.test",
      fetchFn,
    });
    await client.simulateTransfer({ chainId: 1, recipientAddress: "0xr", amount: "1" });
    expect(calls[0].url).toBe("https://staging.keeperhub.test/api/execute/transfer");
  });

  it("sends simulate as a strict boolean true on simulate calls", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(200, { success: true, wouldRevert: false }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await client.simulateTransfer({ chainId: 1, recipientAddress: "0xr", amount: "1" });
    expect(calls[0].body.simulate).toBe(true);
    expect(typeof calls[0].body.simulate).toBe("boolean");
  });

  it("serializes contract-call functionArgs into a JSON string on the wire", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(200, { success: true, wouldRevert: false }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await client.simulateContractCall({
      chainId: 8453,
      contractAddress: "0xcontract",
      functionName: "transfer",
      functionArgs: ["0xabc", "1000"],
    });
    expect(calls[0].body.functionArgs).toBe('["0xabc","1000"]');
    expect(typeof calls[0].body.functionArgs).toBe("string");
  });

  it("serializes an abi object into a JSON string on the wire", async () => {
    const abi = [{ name: "transfer", type: "function", inputs: [] }];
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(200, { success: true, wouldRevert: false }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await client.simulateContractCall({
      chainId: 1,
      contractAddress: "0xc",
      functionName: "transfer",
      functionArgs: [],
      abi,
    });
    expect(calls[0].body.abi).toBe(JSON.stringify(abi));
    expect(typeof calls[0].body.abi).toBe("string");
  });
});

describe("KeeperHubClient simulation mapping", () => {
  it("maps a 200 success into ok:true with a bigint gas estimate", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(200, {
        success: true,
        status: "simulated",
        wouldRevert: false,
        gasEstimate: "21000",
      }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const sim = await client.simulateTransfer({ chainId: 1, recipientAddress: "0xr", amount: "1" });
    expect(sim.ok).toBe(true);
    expect(sim.gasEstimate).toBe(21000n);
    expect(sim.revertReason).toBeUndefined();
  });

  it("leaves gasEstimate undefined when the response omits it", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(200, { success: true, status: "simulated", wouldRevert: false }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const sim = await client.simulateTransfer({ chainId: 1, recipientAddress: "0xr", amount: "1" });
    expect(sim.gasEstimate).toBeUndefined();
  });

  it("treats a 400 with status:simulated as a normal would-revert result", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(400, {
        success: false,
        status: "simulated",
        wouldRevert: true,
        revertReason: "ERC20: transfer amount exceeds balance",
      }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const sim = await client.simulateContractCall({
      chainId: 1,
      contractAddress: "0xc",
      functionName: "transfer",
      functionArgs: ["0xabc", "1"],
    });
    expect(sim.ok).toBe(false);
    expect(sim.revertReason).toBe("ERC20: transfer amount exceeds balance");
  });

  it("maps success:false with wouldRevert:false to ok:false", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(200, { success: false, status: "simulated", wouldRevert: false }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const sim = await client.simulateTransfer({ chainId: 1, recipientAddress: "0xr", amount: "1" });
    expect(sim.ok).toBe(false);
  });
});
