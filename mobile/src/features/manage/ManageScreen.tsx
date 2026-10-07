import { useCallback, useRef, useState } from "react";
import { useFocusEffect, type Href } from "expo-router";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { canManageAccounts, canManageDirectory } from "@/lib/permissions";
import { isBackendConfigured } from "@/lib/supabase";
import { errorMessage, withTimeout } from "@/lib/async-state";
import { managementRepository } from "./management-repository";
import type { ManagementSummary } from "./management-read-model";
import { useManagementList } from "./use-management-list";
import { ManagementFeedback, ManagementLink, ui } from "./ManagementListParts";
import { managedAccountRoute } from "./route-params";

const labels = {
  en: {
    title: "Manage",
    subtitle: "Keep member records and access up to date.",
    members: "Members",
    membersDetail: "Find, edit and review member records",
    accounts: "Account access",
    accountsDetail: "Approve sign-ins and manage access",
    groups: "Groups",
    groupsDetail: "Members and responsible deacons",
    add: "Add member",
    waiting: "Waiting for approval",
    caughtUp: "No accounts are waiting for approval.",
    allAccounts: "Review all pending accounts",
    tools: "Other tools",
    ministries: "Ministries",
    schedule: "Deacon schedule",
    import: "Import members",
    audit: "Audit history",
    noAccess: "You do not have permission to manage directory records.",
  },
  uk: {
    title: "Керування",
    subtitle: "Підтримуйте записи учасників і доступ в актуальному стані.",
    members: "Учасники",
    membersDetail: "Пошук, редагування та перегляд записів",
    accounts: "Доступ до облікових записів",
    accountsDetail: "Схвалення входів і керування доступом",
    groups: "Групи",
    groupsDetail: "Учасники та відповідальні диякони",
    add: "Додати учасника",
    waiting: "Очікують схвалення",
    caughtUp: "Немає облікових записів, що очікують схвалення.",
    allAccounts: "Переглянути всі запити на схвалення",
    tools: "Інші інструменти",
    ministries: "Служіння",
    schedule: "Розклад дияконів",
    import: "Імпорт учасників",
    audit: "Історія змін",
    noAccess: "У вас немає дозволу керувати записами довідника.",
  },
} as const;

export function ManageScreen() {
  const desktop = useDesktopLayout();
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const session = useSession();
  const actor = session.status === "ready" ? session.account : null;
  const allowed = !isBackendConfigured || canManageDirectory(actor),
    accountsAllowed = !isBackendConfigured || canManageAccounts(actor);
  const identity = actor
    ? `${actor.id}:${actor.status}:${actor.role}`
    : session.status;
  const [summary, setSummary] = useState<{
    identity: string;
    value: ManagementSummary;
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const ticket = useRef(0);
  const load = useCallback(() => {
    const generation = ++ticket.current;
    setFailure(null);
    if (allowed)
      void withTimeout(managementRepository.loadSummary())
        .then((value) => {
          if (generation === ticket.current) setSummary({ identity, value });
        })
        .catch((cause) => {
          if (generation === ticket.current) setFailure(errorMessage(cause));
        });
  }, [allowed, identity]);
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        ticket.current++;
      };
    }, [load]),
  );
  const pending = useManagementList(
    "hub-pending",
    (request) => managementRepository.loadAccountsPage(request),
    { limit: 5, filters: { status: "pending" } },
    accountsAllowed && allowed,
  );
  const counts = summary?.identity === identity ? summary.value : null;
  const tasks: {
    href: Href;
    title: string;
    detail: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    count?: number | null;
  }[] = [
    {
      href: "/manage/members",
      title: copy.members,
      detail: copy.membersDetail,
      icon: "people-outline",
      count: counts?.members,
    },
    ...(accountsAllowed
      ? [
          {
            href: "/manage/accounts" as Href,
            title: copy.accounts,
            detail: copy.accountsDetail,
            icon: "key-outline" as const,
          },
        ]
      : []),
    {
      href: "/manage/groups",
      title: copy.groups,
      detail: copy.groupsDetail,
      icon: "grid-outline",
      count: counts?.groups,
    },
  ];
  return (
    <SafeAreaView
      edges={["top"]}
      style={[ui.root, { backgroundColor: palette.background }]}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, ui.width]}
      >
        <View style={ui.heading}>
          <Text
            accessibilityRole="header"
            style={[ui.title, { color: palette.text }]}
          >
            {copy.title}
          </Text>
          {allowed ? (
            <ManagementLink href="/manage/member/new">
              <Text
                style={{
                  color: palette.accent,
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                {copy.add}
              </Text>
            </ManagementLink>
          ) : null}
        </View>
        <Text style={[ui.detail, { color: palette.secondaryText }]}>
          {allowed ? copy.subtitle : copy.noAccess}
        </Text>
        {allowed ? (
          <>
            <View style={[styles.tasks, { borderColor: palette.line }]}>
              {tasks.map((task) => (
                <ManagementLink href={task.href} key={task.title}>
                  <View
                    style={[styles.task, { borderBottomColor: palette.line }]}
                  >
                    <Ionicons
                      accessibilityElementsHidden
                      color={palette.accent}
                      name={task.icon}
                      size={25}
                    />
                    <View style={ui.rowCopy}>
                      <Text style={[ui.sectionTitle, { color: palette.text }]}>
                        {task.title}
                      </Text>
                      <Text
                        style={[ui.detail, { color: palette.secondaryText }]}
                      >
                        {task.detail}
                      </Text>
                    </View>
                    {task.count != null ? (
                      <Text
                        style={{ color: palette.secondaryText, fontSize: 17 }}
                      >
                        {task.count}
                      </Text>
                    ) : null}
                  </View>
                </ManagementLink>
              ))}
            </View>
            <ManagementFeedback error={failure} retry={load} />
            {accountsAllowed ? (
              <View style={styles.section}>
                <View style={ui.heading}>
                  <Text
                    accessibilityRole="header"
                    style={[ui.sectionTitle, { color: palette.text }]}
                  >
                    {copy.waiting}
                  </Text>
                  {counts?.pendingAccounts ? (
                    <Text style={{ color: palette.accent, fontWeight: "700" }}>
                      {counts.pendingAccounts}
                    </Text>
                  ) : null}
                </View>
                <ManagementFeedback
                  loading={pending.loading !== null}
                  error={pending.error}
                  retry={pending.retry}
                />
                {pending.items.map((account) => (
                  <ManagementLink
                    href={managedAccountRoute(account.id)}
                    key={account.id}
                  >
                    <View
                      style={[
                        styles.approval,
                        { borderBottomColor: palette.line },
                      ]}
                    >
                      <View style={ui.rowCopy}>
                        <Text style={[ui.name, { color: palette.text }]}>
                          {account.name || account.email}
                        </Text>
                        <Text
                          style={[ui.detail, { color: palette.secondaryText }]}
                        >
                          {account.email}
                        </Text>
                      </View>
                    </View>
                  </ManagementLink>
                ))}
                {!pending.loading && !pending.error && !pending.items.length ? (
                  <Text style={[ui.detail, { color: palette.secondaryText }]}>
                    {copy.caughtUp}
                  </Text>
                ) : null}
                {pending.items.length ? (
                  <ManagementLink
                    href={{
                      pathname: "/manage/accounts",
                      params: { status: "pending" },
                    }}
                  >
                    <Text style={{ color: palette.accent, fontWeight: "700" }}>
                      {copy.allAccounts}
                    </Text>
                  </ManagementLink>
                ) : null}
              </View>
            ) : null}
            <View style={styles.section}>
              <Text
                accessibilityRole="header"
                style={[ui.sectionTitle, { color: palette.text }]}
              >
                {copy.tools}
              </Text>
              {[
                { href: "/manage/ministries", label: copy.ministries },
                { href: "/manage/schedule", label: copy.schedule },
                ...(accountsAllowed
                  ? [{ href: "/manage/import", label: copy.import }]
                  : []),
                ...(Platform.OS === "web" && desktop && accountsAllowed
                  ? [{ href: "/manage/audit", label: copy.audit }]
                  : []),
              ].map((tool) => (
                <ManagementLink href={tool.href as Href} key={tool.href}>
                  <View style={styles.tool}>
                    <Text
                      style={{
                        color: palette.text,
                        fontSize: 16,
                        flexShrink: 1,
                      }}
                    >
                      {tool.label}
                    </Text>
                  </View>
                </ManagementLink>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
      <WebTabBar />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 12 },
  tasks: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: 8, marginTop: 22 },
  approval: {
    minHeight: 64,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tool: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
