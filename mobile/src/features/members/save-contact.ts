import { Contact } from "expo-contacts";
import { memberContactRecord } from "./contact-record";
import type { MemberProfile } from "./member-repository";

export async function saveMemberContact(profile: MemberProfile, name: string) {
  await Contact.presentCreateForm(memberContactRecord(profile, name));
}
