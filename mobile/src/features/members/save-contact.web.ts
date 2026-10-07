import { contactFileName, memberVCard } from "./contact-vcard";
import type { MemberProfile } from "./member-repository";

export async function saveMemberContact(profile: MemberProfile, name: string) {
  const file = new File([memberVCard(profile, name)], contactFileName(name), { type: "text/vcard" });
  // Generate synchronously so the share call retains the button's user gesture.
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      // Browsers may reject a file type even after canShare; offer a download.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Allow mobile browsers to consume the file before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
