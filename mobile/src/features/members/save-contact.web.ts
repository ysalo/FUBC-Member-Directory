import { contactFileName, memberVCard } from "./contact-vcard";
import type { MemberProfile } from "./member-repository";

export async function saveMemberContact(profile: MemberProfile, name: string) {
  const file = new File([memberVCard(profile, name)], contactFileName(name), { type: "text/vcard" });
  // Sharing a vCard on iPhone opens a share sheet without contact-save controls.
  // Download it so the user can open/import the file instead.
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
