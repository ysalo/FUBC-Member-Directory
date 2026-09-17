import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";

async function existingTypeScriptUrl(pathname) {
  const candidates = [pathname, `${pathname}.ts`, `${pathname}.tsx`];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return pathToFileURL(candidate).href;
    } catch {
      // Try the next supported TypeScript extension.
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = await existingTypeScriptUrl(`${process.cwd()}/src/${specifier.slice(2)}`);
    if (resolved) return { shortCircuit: true, url: resolved };
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(specifier, context.parentURL);
    const resolved = await existingTypeScriptUrl(decodeURIComponent(candidate.pathname).replace(/^\/(?:([A-Za-z]):\/)/, "$1:/"));
    if (resolved) return { shortCircuit: true, url: resolved };
  }
  return nextResolve(specifier, context);
}
