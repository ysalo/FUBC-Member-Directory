export type AsyncState<T> = { status: "loading" } | { status: "error"; error: string } | { status: "empty"; data: T } | { status: "content"; data: T };
export type MutationState = { status: "idle" } | { status: "pending" } | { status: "success" } | { status: "error" | "conflict"; error: string };
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Something went wrong. Please try again.";
}
export function mutationError(error: unknown): MutationState {
  const message = errorMessage(error);
  return { status: /conflict|stale|revision/i.test(message) ? "conflict" : "error", error: message };
}

export function withTimeout<T>(operation: Promise<T>, milliseconds = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The request took too long. Check your connection and try again.")), milliseconds);
    operation.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
