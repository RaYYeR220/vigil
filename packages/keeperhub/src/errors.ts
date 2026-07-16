/** Base class for every error surfaced by the KeeperHub client. */
export class KeeperHubError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.status = status;
  }
}

/** 401/403 — bad or missing API key. Never retried. */
export class KeeperHubAuthError extends KeeperHubError {}

/** 429 or 5xx that survived all retries. */
export class KeeperHubServerError extends KeeperHubError {}

/** A 4xx the caller has to fix (validation, not found, non-simulated 400, ...). */
export class KeeperHubRequestError extends KeeperHubError {}

/** The underlying fetch rejected — DNS, connection reset, abort, etc. */
export class KeeperHubTransportError extends KeeperHubError {}
