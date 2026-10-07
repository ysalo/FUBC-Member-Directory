import type {
  ManagementPage,
  ManagementPageRequest,
} from "./management-read-model";

export type ManagementListState<T> = {
  scope: string;
  items: T[];
  total: number;
  nextOffset: number;
  loading: "initial" | "refresh" | "append" | null;
  error: string | null;
  failedOperation: "initial" | "refresh" | "append" | null;
};
/** Owns pagination generations so late responses cannot cross a filter or session. */
export class ManagementPager<T extends { id: string }> {
  state: ManagementListState<T> = {
    scope: "",
    items: [],
    total: 0,
    nextOffset: 0,
    loading: null,
    error: null,
    failedOperation: null,
  };
  private generation = 0;
  private loader!: (
    request: ManagementPageRequest,
  ) => Promise<ManagementPage<T>>;
  private request: ManagementPageRequest = {};
  private listener: (state: ManagementListState<T>) => void = () => {};
  subscribe(listener: (state: ManagementListState<T>) => void) {
    this.listener = listener;
    return () => {
      this.listener = () => {};
    };
  }
  configure(
    scope: string,
    loader: (request: ManagementPageRequest) => Promise<ManagementPage<T>>,
    request: ManagementPageRequest,
  ) {
    this.loader = loader;
    this.request = request;
    if (scope !== this.state.scope) {
      this.cancel();
      this.state = {
        scope,
        items: [],
        total: 0,
        nextOffset: 0,
        loading: null,
        error: null,
        failedOperation: null,
      };
    }
  }
  cancel() {
    this.generation++;
    this.state = { ...this.state, loading: null };
  }
  private publish(next: ManagementListState<T>) {
    this.state = next;
    this.listener(next);
  }
  refresh() {
    return this.load(this.state.items.length ? "refresh" : "initial");
  }
  append() {
    if (
      this.state.failedOperation === "append" ||
      this.state.loading ||
      this.state.nextOffset >= this.state.total
    )
      return Promise.resolve();
    return this.load("append");
  }
  retry() {
    if (this.state.failedOperation === "append") {
      this.state = { ...this.state, failedOperation: null };
      return this.append();
    }
    return this.refresh();
  }
  private async load(operation: "initial" | "refresh" | "append") {
    const generation = ++this.generation,
      scope = this.state.scope;
    const offset = operation === "append" ? this.state.nextOffset : 0;
    this.publish({
      ...this.state,
      loading: operation,
      error: null,
      failedOperation: null,
    });
    try {
      const page = await this.loader({ ...this.request, offset });
      if (generation !== this.generation || scope !== this.state.scope) return;
      if (!page.items.length && page.total > offset)
        throw new Error(
          "The results changed while loading. Try again or refresh the list.",
        );
      const previous = operation === "append" ? this.state.items : [];
      const seen = new Set(previous.map((item) => item.id));
      const items = [
        ...previous,
        ...page.items.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }),
      ];
      this.publish({
        ...this.state,
        items,
        total: page.total,
        nextOffset: page.offset + page.items.length,
        loading: null,
      });
    } catch (cause) {
      if (generation !== this.generation || scope !== this.state.scope) return;
      this.publish({
        ...this.state,
        loading: null,
        failedOperation: operation,
        error:
          cause instanceof Error
            ? cause.message
            : "The list could not be loaded. Please try again.",
      });
    }
  }
}
