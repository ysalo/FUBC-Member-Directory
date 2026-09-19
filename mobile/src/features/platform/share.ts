import { Share } from "react-native";

export async function shareContactMessage(message: string, title: string, dialogTitle: string): Promise<"shared" | "copied" | "dismissed"> {
  const result = await Share.share({ message, title }, { dialogTitle, subject: title });
  return result.action === Share.dismissedAction ? "dismissed" : "shared";
}
