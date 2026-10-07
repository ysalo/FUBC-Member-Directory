import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageAccounts } from "@/lib/permissions";
import { isBackendConfigured } from "@/lib/supabase";
import { managementRepository } from "./management-repository";
import { useManagementList } from "./use-management-list";
import { useManagementSearch } from "./use-management-search";
import {
  ManagementFeedback,
  ManagementLink,
  ManagementListFooter,
  ManagementSearch,
  ui,
} from "./ManagementListParts";
import { managedAccountRoute } from "./route-params";
import { LastSeen } from "./LastSeen";
import type { ManagedAccount } from "./model";
const labels = {
  en: {
    title: "Account access",
    detail:
      "Accounts control sign-in access. Member records are managed separately.",
    search: "Search accounts",
    all: "All accounts",
    pending: "Pending",
    active: "Active",
    denied: "Denied",
    revoked: "Revoked",
    empty: "No matching accounts",
    manage: "Manage",
    member: "Member",
    editor: "Editor",
    admin: "Administrator",
  },
  uk: {
    title: "Доступ до облікових записів",
    detail:
      "Облікові записи керують доступом до входу. Записи учасників редагуються окремо.",
    search: "Пошук облікових записів",
    all: "Усі облікові записи",
    pending: "Очікує",
    active: "Активний",
    denied: "Відхилено",
    revoked: "Відкликано",
    empty: "Відповідних облікових записів немає",
    manage: "Керування",
    member: "Учасник",
    editor: "Редактор",
    admin: "Адміністратор",
  },
} as const;
export function AccountsManagementScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const session = useSession();
  const actor = session.status === "ready" ? session.account : null;
  const allowed = !isBackendConfigured || canManageAccounts(actor);
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const status = ["pending", "active", "denied", "revoked"].includes(
    params.status ?? "",
  )
    ? (params.status as ManagedAccount["status"])
    : "all";
  const { query, setQuery, committedQuery } = useManagementSearch();
  const list = useManagementList(
    `accounts:${status}:${committedQuery}`,
    (request) => managementRepository.loadAccountsPage(request),
    { query: committedQuery, filters: { status } },
    allowed,
  );
  return (
    <SafeAreaView
      edges={["top"]}
      style={[ui.root, { backgroundColor: palette.background }]}
    >
      <View style={[ui.toolbar, ui.width, { borderBottomColor: palette.line }]}>
        <ManagementLink href="/manage">
          <Text style={{ color: palette.accent }}>{copy.manage}</Text>
        </ManagementLink>
        <Text
          accessibilityRole="header"
          style={[ui.title, { color: palette.text }]}
        >
          {copy.title}
        </Text>
        <Text style={[ui.detail, { color: palette.secondaryText }]}>
          {copy.detail}
        </Text>
        <ManagementSearch
          label={copy.search}
          query={query}
          onChange={setQuery}
        />
        <View style={ui.chips}>
          {(["all", "pending", "active", "denied", "revoked"] as const).map(
            (value) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: status === value }}
                key={value}
                onPress={() => router.setParams({ status: value })}
                style={[
                  ui.chip,
                  {
                    borderColor:
                      status === value ? palette.accent : palette.line,
                    backgroundColor:
                      status === value ? palette.accentSoft : palette.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: status === value ? palette.accent : palette.text,
                  }}
                >
                  {copy[value]}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        <ManagementFeedback
          error={list.failedOperation === "refresh" ? list.error : null}
          loading={list.loading === "refresh"}
          retry={list.retry}
        />
      </View>
      <FlatList
        style={ui.width}
        contentContainerStyle={ui.content}
        data={list.items}
        keyExtractor={(item) => item.id}
        refreshing={list.loading === "refresh"}
        onRefresh={list.refresh}
        onEndReached={list.error ? undefined : list.append}
        onEndReachedThreshold={0.2}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={[ui.row, { borderBottomColor: palette.line }]}>
            <View style={ui.rowCopy}>
              <ManagementLink href={managedAccountRoute(item.id)}>
                <Text style={[ui.name, { color: palette.text }]}>
                  {item.name || item.email}
                </Text>
                <Text style={[ui.detail, { color: palette.secondaryText }]}>
                  {item.email}
                </Text>
                <Text
                  style={[
                    ui.detail,
                    {
                      color:
                        item.status === "pending"
                          ? palette.accent
                          : palette.secondaryText,
                    },
                  ]}
                >
                  {copy[item.status]} · {copy[item.role]}
                </Text>
              </ManagementLink>
              <LastSeen value={item.lastSeenAt} />
            </View>
            <Ionicons
              accessibilityElementsHidden
              color={palette.secondaryText}
              name="chevron-forward"
              size={20}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={ui.empty}>
            {list.loading === "initial" || list.error ? (
              <ManagementFeedback
                loading={list.loading === "initial"}
                error={list.error}
                retry={list.retry}
              />
            ) : (
              <Text style={[ui.sectionTitle, { color: palette.text }]}>
                {copy.empty}
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          list.items.length ? (
            <ManagementListFooter
              {...list}
              count={list.items.length}
              error={list.failedOperation === "append" ? list.error : null}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
