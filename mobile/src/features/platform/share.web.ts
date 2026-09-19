import { shareBrowserContact } from "./browser-share";

export function shareContactMessage(message: string, title: string, _dialogTitle: string) {
  return shareBrowserContact(message, title, navigator);
}
