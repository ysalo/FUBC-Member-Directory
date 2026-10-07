import type { PropsWithChildren } from "react";
import { Modal } from "react-native";
export type AboutDialogProps = PropsWithChildren<{open: boolean; label: string; onClose: () => void}>;
export function AboutDialog({open, onClose, children}: AboutDialogProps) {
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={open}>{children}</Modal>;
}
