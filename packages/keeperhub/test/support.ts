export type RecordedCall = {
  url: string;
  init: RequestInit;
  headers: Headers;
  body: Record<string, unknown>;
};

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function textResponse(status: number, text: string): Response {
  return new Response(text, { status, headers: { "content-type": "text/plain" } });
}

type Handler = (call: RecordedCall, index: number) => Response | Promise<Response>;

/** A fetch stub that records every call and delegates the response to `handler`. */
export function recordingFetch(handler: Handler): { fetchFn: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let body: Record<string, unknown> = {};
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body) as Record<string, unknown>;
      } catch {
        body = { __raw: init.body };
      }
    }
    const call: RecordedCall = {
      url: String(input),
      init: init ?? {},
      headers: new Headers(init?.headers),
      body,
    };
    calls.push(call);
    return handler(call, calls.length - 1);
  }) as typeof fetch;
  return { fetchFn, calls };
}

/** Fetch stub that returns the given responses in order, one per call. */
export function sequenceFetch(...responses: Response[]): {
  fetchFn: typeof fetch;
  calls: RecordedCall[];
} {
  return recordingFetch((_call, index) => {
    const res = responses[index];
    if (!res) throw new Error(`no stubbed response for call #${index}`);
    return res;
  });
}

/** A sleep stub that records the requested delays instead of waiting. */
export function recordingSleep(): { sleepFn: (ms: number) => Promise<void>; delays: number[] } {
  const delays: number[] = [];
  return {
    sleepFn: (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    },
    delays,
  };
}
