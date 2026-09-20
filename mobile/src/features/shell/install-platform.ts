export type InstallPlatform = "ios" | "android" | "desktop";

export function detectInstallPlatform(
    userAgent: string,
    platform = "",
    touchPoints = 0,
): InstallPlatform {
    if (/android/i.test(userAgent)) return "android";
    if (
        /iPad|iPhone|iPod/i.test(userAgent) ||
        (platform === "MacIntel" && touchPoints > 1)
    )
        return "ios";
    return "desktop";
}
