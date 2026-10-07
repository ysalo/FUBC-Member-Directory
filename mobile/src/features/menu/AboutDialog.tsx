import type { PropsWithChildren } from "react";
export type AboutDialogProps = PropsWithChildren<{ open: boolean; label: string; onClose: () => void }>;

// Native About opens in the Menu stack; the browser uses AboutDialog.web.
export function AboutDialog(_props: AboutDialogProps) {
  return null;
}
