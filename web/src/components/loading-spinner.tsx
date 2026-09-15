export default function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="block size-5 animate-spin rounded-full border-2 border-[var(--app-line)] border-t-[var(--app-brand)] motion-reduce:animate-none"
    />
  );
}
