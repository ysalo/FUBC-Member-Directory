// @ts-nocheck — Expo Router's generated route union lags newly added nested management routes.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { useSession } from "@/features/session/SessionProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { errorMessage, withTimeout } from "@/lib/async-state";
import { canManageAccounts, canManageDirectory } from "@/lib/permissions";
import { isBackendConfigured } from "@/lib/supabase";
import { managementRepository } from "./management-repository";
import { managedAccountRoute } from "./route-params";
import { initialManagementState, orderedAccounts, pendingAccounts, type ManagedAccount, type ManagedMember, type ManagementState } from "./model";

const labels = {
  en: {
    title: "Manage", subtitle: "Keep the directory accurate and access up to date.", members: "Members", accounts: "Accounts",
    active: "Active", archived: "Archived", pending: "Pending", denied: "Denied", revoked: "Revoked",
    groups: "Groups", groupsDetail: "Assign deacons and review rosters", ministries: "Ministries", ministriesDetail: "Maintain ministry names",
    addMember: "Add member", loading: "Preparing management tools…", loadingDetail: "Loading members and account access.",
    error: "Management tools didn’t load", retry: "Try again", noAccess: "You don’t have permission to manage directory records.",
    waiting: "Waiting for approval", waitingDetail: "Signed-in people who need an administrator’s review.", allCaughtUp: "No accounts are waiting for approval.",
    emptyMembers: "No members yet", emptyMembersDetail: "Add the first person to start the directory.", emptyAccounts: "No accounts found", emptyAccountsDetail: "New sign-ins will appear here.",
    opensAccount: "Opens account access settings", opensMember: "Opens member management",
  },
  uk: {
    title: "Керування", subtitle: "Підтримуйте довідник і доступ в актуальному стані.", members: "Учасники", accounts: "Облікові записи",
    active: "Активний", archived: "Архівний", pending: "Очікує", denied: "Відхилено", revoked: "Відкликано",
    groups: "Групи", groupsDetail: "Призначення дияконів і склад груп", ministries: "Служіння", ministriesDetail: "Назви служінь",
    addMember: "Додати учасника", loading: "Готуємо інструменти керування…", loadingDetail: "Завантажуємо учасників і доступ до облікових записів.",
    error: "Не вдалося завантажити керування", retry: "Спробувати ще раз", noAccess: "У вас немає дозволу керувати записами довідника.",
    waiting: "Очікують схвалення", waitingDetail: "Користувачі, які вже ввійшли й потребують перевірки адміністратора.", allCaughtUp: "Немає облікових записів, що очікують схвалення.",
    emptyMembers: "Учасників ще немає", emptyMembersDetail: "Додайте першу людину, щоб почати довідник.", emptyAccounts: "Облікових записів не знайдено", emptyAccountsDetail: "Нові користувачі з’являться тут після входу.",
    opensAccount: "Відкриває налаштування доступу", opensMember: "Відкриває керування учасником",
  },
} as const;

export function ManageScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const router = useRouter();
  const copy = labels[locale];
  const actor = session.status === "ready" ? session.account : null;
  const allowed = !isBackendConfigured || canManageDirectory(actor);
  const accountsAllowed = !isBackendConfigured || canManageAccounts(actor);
  const [panel, setPanel] = useState<"members" | "accounts">("members");
  const [state, setState] = useState<ManagementState>(() => isBackendConfigured ? { members: [], accounts: [] } : initialManagementState);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!allowed) return;
    setLoading(true);
    setFailure(null);
    void withTimeout(managementRepository.load())
      .then(setState)
      .catch((cause) => setFailure(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [allowed]);

  useEffect(() => { load(); }, [load]);

  const approvalQueue = useMemo(() => pendingAccounts(state.accounts), [state.accounts]);
  const data = useMemo(() => panel === "members" ? state.members : accountsAllowed ? orderedAccounts(state.accounts) : [], [accountsAllowed, panel, state]);
  const openAccount = (accountId: string) => {
    router.push(managedAccountRoute(accountId));
  };

  if (!allowed) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <StateView detail={copy.noAccess} icon="lock-closed-outline" title={copy.title} />
      <WebTabBar />
    </SafeAreaView>;
  }

  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={loading || failure ? [] : data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<>
        <View style={styles.heading}>
          <View style={styles.flex}>
            <Text accessibilityRole="header" selectable style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
            <Text selectable style={[styles.subtitle, { color: palette.secondaryText }]}>{copy.subtitle}</Text>
          </View>
          <Pressable accessibilityLabel={copy.addMember} accessibilityRole="button" onPress={() => router.push("/manage/member/new" as Href)} style={({ pressed }) => [styles.add, { backgroundColor: palette.accent }, pressed && styles.pressed]}>
            <Ionicons accessibilityElementsHidden color="#FFF" name="add" size={26} />
          </Pressable>
        </View>

        <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: palette.subtle }]}>
          {(["members", ...(accountsAllowed ? ["accounts"] : [])] as const).map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: panel === value }} key={value} onPress={() => setPanel(value)} style={[styles.segment, panel === value && { backgroundColor: palette.elevated }]}>
            <Text style={[styles.segmentText, { color: panel === value ? palette.text : palette.secondaryText }]}>{copy[value]}</Text>
          </Pressable>)}
        </View>

        <View style={styles.shortcuts}>
          <Shortcut detail={copy.groupsDetail} icon="people-outline" label={copy.groups} onPress={() => router.push("/manage/groups" as Href)} />
          <Shortcut detail={copy.ministriesDetail} icon="layers-outline" label={copy.ministries} onPress={() => router.push("/manage/ministries" as Href)} />
        </View>

        {accountsAllowed && !loading && !failure ? <ApprovalQueue accounts={approvalQueue} onOpen={openAccount} /> : null}
      </>}
      ListEmptyComponent={loading
        ? <StateView detail={copy.loadingDetail} icon="sync-outline" loading title={copy.loading} />
        : failure
          ? <StateView action={load} actionLabel={copy.retry} detail={failure} icon="cloud-offline-outline" title={copy.error} />
          : <StateView detail={panel === "members" ? copy.emptyMembersDetail : copy.emptyAccountsDetail} icon={panel === "members" ? "person-add-outline" : "key-outline"} title={panel === "members" ? copy.emptyMembers : copy.emptyAccounts} />}
      renderItem={({ item }) => panel === "members"
        ? <MemberRow item={item as ManagedMember} onPress={() => router.push(`/manage/member/${item.id}` as Href)} />
        : <AccountRow item={item as ManagedAccount} onPress={() => openAccount(item.id)} />}
    />
    <WebTabBar />
  </SafeAreaView>;

  function Shortcut({ detail, icon, label, onPress }: { detail: string; icon: "people-outline" | "layers-outline"; label: string; onPress: () => void }) {
    return <Pressable accessibilityHint={detail} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.shortcut, { backgroundColor: palette.surface, borderColor: palette.line }, pressed && styles.pressed]}>
      <View style={[styles.shortcutIcon, { backgroundColor: palette.accentSoft }]}><Ionicons accessibilityElementsHidden color={palette.accent} name={icon} size={21} /></View>
      <View style={styles.flex}><Text style={[styles.shortcutTitle, { color: palette.text }]}>{label}</Text><Text numberOfLines={2} style={[styles.shortcutDetail, { color: palette.secondaryText }]}>{detail}</Text></View>
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={18} />
    </Pressable>;
  }

  function ApprovalQueue({ accounts, onOpen }: { accounts: ManagedAccount[]; onOpen: (id: string) => void }) {
    return <View style={[styles.approval, { backgroundColor: palette.warningSoft }]}>
      <View style={styles.approvalHeading}>
        <View style={[styles.approvalIcon, { backgroundColor: palette.elevated }]}><Ionicons accessibilityElementsHidden color={palette.accent} name="time-outline" size={21} /></View>
        <View style={styles.flex}>
          <View style={styles.approvalTitleRow}><Text accessibilityRole="header" style={[styles.approvalTitle, { color: palette.text }]}>{copy.waiting}</Text><Text style={[styles.count, { backgroundColor: palette.accent, color: "#FFF" }]}>{accounts.length}</Text></View>
          <Text style={[styles.approvalDetail, { color: palette.secondaryText }]}>{copy.waitingDetail}</Text>
        </View>
      </View>
      {accounts.length === 0
        ? <View style={[styles.caughtUp, { borderTopColor: palette.line }]}><Ionicons accessibilityElementsHidden color={palette.secondaryText} name="checkmark-circle-outline" size={20} /><Text style={[styles.caughtUpText, { color: palette.secondaryText }]}>{copy.allCaughtUp}</Text></View>
        : accounts.map((account) => <Pressable accessibilityHint={copy.opensAccount} accessibilityLabel={`${account.name}, ${account.email}, ${copy.pending}`} accessibilityRole="button" key={account.id} onPress={() => onOpen(account.id)} style={({ pressed }) => [styles.approvalRow, { borderTopColor: palette.line }, pressed && styles.pressed]}>
          <ProfileAvatar backgroundColor={palette.elevated} name={account.name || account.email} source={state.members.find((member) => member.id === account.personId)?.photo} size={38} textColor={palette.accent} />
          <View style={styles.flex}><Text numberOfLines={1} style={[styles.cardTitle, { color: palette.text }]}>{account.name || account.email}</Text><Text numberOfLines={1} selectable style={[styles.rowDetail, { color: palette.secondaryText }]}>{account.email}</Text></View>
          <Ionicons accessibilityElementsHidden color={palette.accent} name="chevron-forward" size={20} />
        </Pressable>)}
    </View>;
  }

  function MemberRow({ item, onPress }: { item: ManagedMember; onPress: () => void }) {
    return <Pressable accessibilityHint={copy.opensMember} accessibilityLabel={item.name} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: palette.surface, borderColor: palette.line }, pressed && styles.pressed]}>
      <ProfileAvatar backgroundColor={palette.accentSoft} name={item.name} source={item.photo} textColor={palette.accent} />
      <View style={styles.flex}><Text style={[styles.cardTitle, { color: palette.text }]}>{item.name}</Text>{item.group ? <Text numberOfLines={1} style={[styles.rowDetail, { color: palette.secondaryText }]}>{item.group}</Text> : null}</View>
      {item.archived ? <StatusPill label={copy.archived} tone="muted" /> : null}
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={19} />
    </Pressable>;
  }

  function AccountRow({ item, onPress }: { item: ManagedAccount; onPress: () => void }) {
    return <Pressable accessibilityHint={copy.opensAccount} accessibilityLabel={`${item.name}, ${item.email}, ${copy[item.status]}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: palette.surface, borderColor: palette.line }, pressed && styles.pressed]}>
      <ProfileAvatar backgroundColor={palette.accentSoft} name={item.name || item.email} source={state.members.find((member) => member.id === item.personId)?.photo} textColor={palette.accent} />
      <View style={styles.flex}><Text numberOfLines={1} style={[styles.cardTitle, { color: palette.text }]}>{item.name || item.email}</Text><Text numberOfLines={1} selectable style={[styles.rowDetail, { color: palette.secondaryText }]}>{item.email || "—"}</Text></View>
      <StatusPill label={copy[item.status]} tone={item.status === "pending" ? "attention" : item.status === "active" ? "success" : "muted"} />
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={19} />
    </Pressable>;
  }

  function StatusPill({ label, tone }: { label: string; tone: "attention" | "success" | "muted" }) {
    const backgroundColor = tone === "attention" ? palette.warningSoft : tone === "success" ? palette.successSoft : palette.subtle;
    return <View style={[styles.status, { backgroundColor }]}><Text style={[styles.statusText, { color: tone === "attention" ? palette.accent : palette.secondaryText }]}>{label}</Text></View>;
  }

  function StateView({ action, actionLabel, detail, icon, loading: busy, title }: { action?: () => void; actionLabel?: string; detail: string; icon: "cloud-offline-outline" | "key-outline" | "lock-closed-outline" | "person-add-outline" | "sync-outline"; loading?: boolean; title: string }) {
    return <View accessibilityLiveRegion="polite" style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: palette.accentSoft }]}>{busy ? <ActivityIndicator color={palette.accent} /> : <Ionicons accessibilityElementsHidden color={palette.accent} name={icon} size={27} />}</View>
      <Text accessibilityRole="header" selectable style={[styles.stateTitle, { color: palette.text }]}>{title}</Text>
      <Text selectable style={[styles.stateDetail, { color: palette.secondaryText }]}>{detail}</Text>
      {action ? <Pressable accessibilityRole="button" onPress={action} style={({ pressed }) => [styles.retry, { backgroundColor: palette.accent }, pressed && styles.pressed]}><Text style={styles.retryText}>{actionLabel}</Text></Pressable> : null}
    </View>;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { gap: 10, paddingBottom: 116, paddingHorizontal: 18 }, heading: { alignItems: "center", flexDirection: "row", gap: 16, justifyContent: "space-between", paddingTop: 22 },
  title: { fontSize: 42, fontWeight: "800", letterSpacing: -1.3 }, subtitle: { fontSize: 15, lineHeight: 21, marginTop: 3 }, flex: { flex: 1, minWidth: 0 },
  add: { alignItems: "center", borderCurve: "continuous", borderRadius: 15, height: 46, justifyContent: "center", width: 46 }, segmented: { borderCurve: "continuous", borderRadius: 13, flexDirection: "row", marginTop: 14, padding: 3 },
  segment: { alignItems: "center", borderCurve: "continuous", borderRadius: 10, flex: 1, minHeight: 40, justifyContent: "center", paddingHorizontal: 10 }, segmentText: { fontSize: 15, fontWeight: "700" },
  shortcuts: { gap: 8, marginTop: 4 }, shortcut: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 11, minHeight: 66, paddingHorizontal: 12, paddingVertical: 10 },
  shortcutIcon: { alignItems: "center", borderRadius: 10, height: 38, justifyContent: "center", width: 38 }, shortcutTitle: { fontSize: 16, fontWeight: "700" }, shortcutDetail: { fontSize: 13, lineHeight: 17, marginTop: 2 },
  approval: { borderCurve: "continuous", borderRadius: 16, marginBottom: 4, marginTop: 6, overflow: "hidden", paddingHorizontal: 14, paddingTop: 14 }, approvalHeading: { alignItems: "flex-start", flexDirection: "row", gap: 11, paddingBottom: 13 },
  approvalIcon: { alignItems: "center", borderRadius: 10, height: 38, justifyContent: "center", width: 38 }, approvalTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 }, approvalTitle: { fontSize: 18, fontWeight: "800" }, approvalDetail: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  count: { borderRadius: 9, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "800", minWidth: 20, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 2, textAlign: "center" },
  approvalRow: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, minHeight: 60, paddingVertical: 10 }, caughtUp: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 8, minHeight: 50 }, caughtUpText: { flex: 1, fontSize: 14, lineHeight: 19 },
  row: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 11, minHeight: 70, padding: 12 }, cardTitle: { fontSize: 16, fontWeight: "700" }, rowDetail: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  status: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 }, statusText: { fontSize: 11, fontWeight: "800" }, state: { alignItems: "center", justifyContent: "center", minHeight: 260, paddingHorizontal: 26, paddingVertical: 34 },
  stateIcon: { alignItems: "center", borderRadius: 25, height: 50, justifyContent: "center", width: 50 }, stateTitle: { fontSize: 21, fontWeight: "800", marginTop: 15, textAlign: "center" }, stateDetail: { fontSize: 15, lineHeight: 21, marginTop: 7, maxWidth: 330, textAlign: "center" },
  retry: { borderCurve: "continuous", borderRadius: 13, marginTop: 18, minHeight: 46, justifyContent: "center", paddingHorizontal: 20 }, retryText: { color: "#FFF", fontSize: 15, fontWeight: "800" }, pressed: { opacity: 0.72 },
});
