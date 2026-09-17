const ipv4Pattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function isNumericIpRedirect(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, "");
    return ipv4Pattern.test(hostname) || hostname.includes(":");
  } catch {
    return false;
  }
}

export function assertUsableOAuthRedirect(redirectTo: string, expoGo: boolean): string {
  if (expoGo && isNumericIpRedirect(redirectTo)) {
    throw new Error("Google sign-in needs the Expo tunnel. Restart with ‘pnpm start:phone’, scan the new QR code, and try again.");
  }
  return redirectTo;
}
