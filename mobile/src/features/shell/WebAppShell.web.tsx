import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Link, usePathname } from "expo-router";
import { type ComponentProps, type PropsWithChildren, useEffect, useState } from "react";

import { useTextSize } from "@/features/accessibility/TextSizeProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { useActiveVisitationCount } from "@/features/visitation/use-active-visitation-count";
import { usePendingAccountCount } from "@/features/manage/use-pending-account-count";
import { dismissAllWebAlerts } from "@/features/platform/alert.web";
import { canCreateVisit, canManageDirectory } from "@/lib/permissions";

const destinations = [
  { key: "directory", href: "/", icon: "list-outline" },
  { key: "groups", href: "/groups", icon: "people-circle-outline" },
  { key: "visitation", href: "/visitation", icon: "home-outline" },
  { key: "schedule", href: "/schedule", icon: "calendar-outline" },
  { key: "manage", href: "/manage", icon: "settings-outline" },
  { key: "menu", href: "/menu", icon: "menu-outline" },
] as const;

// Router supplies both native onPress and browser onClick; only DOM props reach the anchor.
function NavigationAnchor({ onPress: _onPress, ...props }: ComponentProps<"a"> & { onPress?: unknown }) {
  return <a {...props} />;
}

export function WebAppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { copy, locale } = useLocalization();
  const { scale } = useTextSize();
  const session = useSession();
  const activeVisitationCount = useActiveVisitationCount();
  const pendingAccountCount = usePendingAccountCount();
  const accountId = session.status === "ready" ? session.account.id : null;
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => () => dismissAllWebAlerts(), [pathname, accountId]);
  const account = session.status === "ready" ? session.account : null;
  const accountInitials = account?.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FU";
  const accountRole = account ? (locale === "uk" ? ({ admin: "Адміністратор", editor: "Адміністратор учасників", member: "Учасник" } as const)[account.role] : ({ admin: "Administrator", editor: "Member Administrator", member: "Member" } as const)[account.role]) : "";

  return <div className="web-app-shell" style={{ fontSize: `${16 * scale}px` }}>
    <a className="web-skip-link" href="#app-content">{locale === "uk" ? "До вмісту" : "Skip to content"}</a>
    <nav className="web-navigation" aria-label={locale === "uk" ? "Головна навігація" : "Main navigation"}>
      <div className="web-navigation-brand">
        <span className="web-navigation-logo" role="img" aria-label="FUBC" />
        <span className="web-navigation-brand-label">{locale === "uk" ? "Довідник членів церкви" : "Member Directory"}</span>
      </div>
      <div className="web-navigation-links">{destinations.filter((item) =>
        (item.key !== "manage" || canManageDirectory(account)) &&
        (item.key !== "visitation" || canCreateVisit(account))).map((item) => {
        const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/members/") : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const label = copy.tabs[item.key];
        return <Link key={item.key} href={item.href as never} asChild><NavigationAnchor className="web-navigation-link" title={label} aria-current={active ? "page" : undefined}>
          <span className="web-navigation-icon">
            <span aria-hidden="true"><Ionicons name={item.icon} size={24} color="currentColor" /></span>
            {item.key === "visitation" && activeVisitationCount > 0 ? <span className="web-navigation-badge" aria-label={`${activeVisitationCount} active visitations`}>{activeVisitationCount > 99 ? "99+" : activeVisitationCount}</span> : null}
            {item.key === "manage" && pendingAccountCount > 0 ? <span className="web-navigation-badge" aria-label={`${copy.pendingAccounts}: ${pendingAccountCount}`}>{pendingAccountCount > 99 ? "99+" : pendingAccountCount}</span> : null}
          </span>
          <span className="web-navigation-link-label">{label}</span>
        </NavigationAnchor></Link>;
      })}</div>
      {account ? <Link href="/menu" asChild><NavigationAnchor className="web-navigation-account">
        <span className="web-navigation-avatar" aria-hidden="true">{accountInitials}</span>
        <span className="web-navigation-account-copy"><strong>{account.displayName}</strong><small>{accountRole}</small></span>
        <span className="web-navigation-account-arrow" aria-hidden><Ionicons name="chevron-forward" size={18} /></span>
      </NavigationAnchor></Link> : null}
    </nav>
    <main id="app-content" className="web-app-content" tabIndex={-1}>
      {!online && <div className="web-network-status" role="status">{locale === "uk" ? "Немає з’єднання. Підключіться до інтернету та повторіть дію." : "You’re offline. Reconnect to the internet, then try your action again."}</div>}
      <div className="web-route-content">{children}</div>
    </main>
  </div>;
}
