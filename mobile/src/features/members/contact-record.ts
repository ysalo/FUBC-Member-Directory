import type { CreateContactRecord } from "expo-contacts";
import type { MemberProfile } from "./member-repository";

/** Export only the contact fields exposed by the member profile. */
export function memberContactRecord(profile: MemberProfile, displayName: string): CreateContactRecord {
  const givenName = profile.first_name?.trim();
  const familyName = profile.last_name?.trim();
  const phone = profile.phone?.trim();
  const email = profile.leadershipMinistry ? profile.email?.trim() : undefined;
  const address = profile.address?.trim();
  return {
    ...(givenName && familyName
      ? { givenName, familyName, ...(profile.patronymic?.trim() ? { middleName: profile.patronymic.trim() } : {}) }
      : { givenName: displayName.trim() }),
    ...(phone ? { phones: [{ label: "mobile", number: phone }] } : {}),
    ...(email ? { emails: [{ label: "work", address: email }] } : {}),
    ...(address ? { addresses: [{ label: "home", street: address }] } : {}),
  };
}
