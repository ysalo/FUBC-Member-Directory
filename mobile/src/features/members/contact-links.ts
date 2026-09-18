export type ContactLinkPlatform = "android" | "ios" | "web";

export function emailUrl(email: string) {
  return `mailto:${encodeURIComponent(email.trim())}`;
}

export function mapUrls(address: string, platform: ContactLinkPlatform = process.env.EXPO_OS as ContactLinkPlatform) {
  const query = encodeURIComponent(address.trim());
  const fallback = `https://www.google.com/maps/search/?api=1&query=${query}`;

  if (platform === "ios") return { primary: `maps:?q=${query}`, fallback };
  if (platform === "android") return { primary: `geo:0,0?q=${query}`, fallback };
  return { primary: fallback };
}

export function contactShareMessage(
  contact: { address?: string; email?: string; name: string; phone?: string },
  labels: { address: string; email: string; phone: string },
) {
  return [
    contact.name.trim(),
    contact.phone?.trim() ? `${labels.phone}: ${contact.phone.trim()}` : null,
    contact.email?.trim() ? `${labels.email}: ${contact.email.trim()}` : null,
    contact.address?.trim() ? `${labels.address}: ${contact.address.trim()}` : null,
  ].filter((line): line is string => Boolean(line)).join("\n");
}
