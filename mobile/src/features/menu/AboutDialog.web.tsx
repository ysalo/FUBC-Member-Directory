import { useEffect, useRef } from "react";
import type { AboutDialogProps } from "./AboutDialog";
export function AboutDialog({open, label, onClose, children}: AboutDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    return () => element.close();
  }, [open]);
  return <dialog ref={dialog} aria-label={label} className="menu-about-dialog" onCancel={event => {event.preventDefault(); onClose();}} onClick={event => {if (event.target === dialog.current) {const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();}}}>
    {open ? children : null}
  </dialog>;
}
