export function normalizeAccountId(value: string | string[] | undefined) {
  const accountId = (Array.isArray(value) ? value[0] : value)?.trim();
  return accountId || null;
}

export function accountIdFromPathname(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).at(-1);
  if (!segment || segment === "account") return null;
  try {
    return normalizeAccountId(decodeURIComponent(segment));
  } catch {
    return normalizeAccountId(segment);
  }
}

export function managedAccountHref(accountId: string) {
  const normalized = accountId.trim();
  const encoded = encodeURIComponent(normalized);
  return `/manage/account/${encoded}` as const;
}
