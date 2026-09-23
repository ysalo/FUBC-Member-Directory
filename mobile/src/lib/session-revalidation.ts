export function isTransientSessionError(cause: unknown): boolean {
  if (!cause || typeof cause !== "object") return false;
  const error = cause as { status?: number; code?: string; message?: string };
  if (error.status !== undefined && error.status !== 0) return error.status === 408 || error.status === 429 || error.status >= 500;
  if (error.code) return ["PGRST000", "PGRST001", "PGRST002", "57014"].includes(error.code);
  return /fetch|network|offline|timeout|timed out|load failed/i.test(error.message ?? "");
}

/** Keeps an authorized screen mounted during refresh of the same auth identity. */
export function createSessionRevalidator<Account>(options: {
  isReady: () => boolean;
  load: () => Promise<Account>;
  loading: () => void;
  signedOut: () => void;
  ready: (account: Account) => void;
  error: (cause: unknown) => void;
}) {
  let generation = 0;
  let identity: string | null = null;
  return {
    get revision() { return generation; },
    invalidate() { generation++; },
    async resolve(nextIdentity: string | null) {
      const current = ++generation;
      const preserveReady = nextIdentity !== null && nextIdentity === identity && options.isReady();
      identity = nextIdentity;
      if (!nextIdentity) { options.signedOut(); return; }
      if (!preserveReady) options.loading();
      try {
        let account: Account;
        try {
          account = await options.load();
        } catch (cause) {
          if (current !== generation) return;
          if (!isTransientSessionError(cause)) throw cause;
          await new Promise((resolve) => setTimeout(resolve, 750));
          if (current !== generation) return;
          account = await options.load();
        }
        if (current === generation) options.ready(account);
      } catch (cause) {
        if (current === generation) options.error(cause);
      }
    },
  };
}
