import { useEffect, useRef } from "react";
import { Modal } from "react-native";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import type { AboutDialogProps } from "./AboutDialog";

export function AboutDialog({ open, label, onClose, children }: AboutDialogProps) {
  const desktop = useDesktopLayout();
  const supportsDialog = typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal === "function";
  const useDialog = desktop && supportsDialog;
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!useDialog || !open || !element) return;
    element.showModal();
    return () => element.close();
  }, [open, useDialog]);

  if (!useDialog) {
    return <Modal accessibilityLabel={label} animationType="slide" visible={open} onRequestClose={onClose}>
      {children}
    </Modal>;
  }

  return <dialog ref={dialog} aria-label={label} className="menu-about-dialog"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    {open ? children : null}
  </dialog>;
}
