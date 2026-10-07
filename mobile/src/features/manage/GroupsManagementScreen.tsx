import { FlatList, View } from "react-native";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageGroups } from "@/lib/permissions";
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
const labels = {
  en: {
    add: "Add group",
    search: "Search groups",
    empty: "No matching groups",
    members: "members",
    deacons: "of 2 deacons",
    manage: "Manage",
  },
  uk: {
    add: "Додати групу",
    search: "Пошук груп",
    empty: "Відповідних груп немає",
    members: "учасників",
    deacons: "з 2 дияконів",
    manage: "Керування",
  },
} as const;
export function GroupsManagementScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const session = useSession();
  const actor = session.status === "ready" ? session.account : null;
  const allowed = !isBackendConfigured || canManageGroups(actor);
  const { query, setQuery, committedQuery } = useManagementSearch();
  const list = useManagementList(
    `groups:membership:${committedQuery}`,
    (request) => managementRepository.loadGroupsPage(request),
    { query: committedQuery, filters: { kind: "membership" } },
    allowed,
  );
  return (
    <View style={[ui.root, { backgroundColor: palette.background }]}>
      <View style={[ui.toolbar, ui.width, { borderBottomColor: palette.line }]}>
        <View style={ui.heading}>
          <ManagementLink href="/manage">
            <Text style={{ color: palette.accent }}>{copy.manage}</Text>
          </ManagementLink>
          <ManagementLink href="/manage/group/new">
            <Text style={{ color: palette.accent, fontWeight: "700" }}>
              {copy.add}
            </Text>
          </ManagementLink>
        </View>
        <ManagementSearch
          label={copy.search}
          query={query}
          onChange={setQuery}
        />
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
        renderItem={({ item }) => (
          <ManagementLink
            href={{
              pathname: "/manage/group/[groupId]",
              params: { groupId: item.id },
            }}
          >
            <View style={[ui.row, { borderBottomColor: palette.line }]}>
              <View style={ui.rowCopy}>
                <Text style={[ui.name, { color: palette.text }]}>
                  {item.name}
                </Text>
                <Text style={[ui.detail, { color: palette.secondaryText }]}>
                  {item.memberCount} {copy.members} · {item.deaconCount}{" "}
                  {copy.deacons}
                </Text>
              </View>
            </View>
          </ManagementLink>
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
    </View>
  );
}
