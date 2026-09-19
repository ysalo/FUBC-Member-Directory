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
        const account = await options.load();
        if (current === generation) options.ready(account);
      } catch (cause) {
        if (current === generation) options.error(cause);
      }
    },
  };
}
