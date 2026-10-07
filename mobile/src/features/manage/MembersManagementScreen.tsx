import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { canManageAccounts, canManageDirectory } from "@/lib/permissions";
import { isBackendConfigured } from "@/lib/supabase";
import { formatMemberName } from "@/lib/member-name";
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
import { BulkMemberDeletion } from "./BulkMemberDeletion";
import type { ManagedMember } from "./model";

const labels = {
  en: {
    title: "Members",
    add: "Add member",
    search: "Search people",
    active: "Active members",
    former: "Former members",
    select: "Select members",
    cancel: "Finish selecting",
    selected: "selected",
    selectLoaded: "Select loaded",
    clear: "Clear selection",
    remove: "Delete selected",
    empty: "No members yet",
    noMatches: "No members match",
    hint: "Try another name, patronymic, group or contact detail.",
    self: "Your own member record cannot be deleted here.",
    notAssigned: "No membership group",
    manage: "Manage",
    formerDetail: "Left membership",
  },
  uk: {
    title: "Учасники",
    add: "Додати учасника",
    search: "Пошук людей",
    active: "Активні учасники",
    former: "Колишні члени",
    select: "Вибрати учасників",
    cancel: "Завершити вибір",
    selected: "вибрано",
    selectLoaded: "Вибрати завантажених",
    clear: "Скасувати вибір",
    remove: "Видалити вибраних",
    empty: "Учасників ще немає",
    noMatches: "Учасників не знайдено",
    hint: "Спробуйте інше ім’я, по батькові, групу або контактні дані.",
    self: "Тут не можна видалити власний запис учасника.",
    notAssigned: "Без членської групи",
    manage: "Керування",
    formerDetail: "Вийшов із членства",
  },
} as const;
export function MembersManagementScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const session = useSession();
  const actor = session.status === "ready" ? session.account : null;
  const allowed = !isBackendConfigured || canManageDirectory(actor),
    deletionAllowed = canManageAccounts(actor);
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const archived = params.status === "former";
  const { query, setQuery, committedQuery } = useManagementSearch();
  const list = useManagementList(
    `members:${archived}:${committedQuery}`,
    (request) => managementRepository.loadMembersPage(request),
    { query: committedQuery, filters: { archived } },
    allowed,
  );
  const [selecting, setSelecting] = useState(false),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [deletionMembers, setDeletionMembers] = useState<ManagedMember[] | null>(
      null,
    );
  useEffect(() => {
    setSelectedIds([]);
    setSelecting(false);
    setDeletionMembers(null);
  }, [query, archived, actor?.id, deletionAllowed]);
  useEffect(() => {
    if (list.loading === "refresh") {
      setSelectedIds([]);
      setSelecting(false);
    }
  }, [list.loading]);
  const selectable = list.items.filter(
    (m) => m.id !== actor?.personId && m.revision != null,
  );
  const selectedMembers = selectable.filter((m) => selectedIds.includes(m.id));
  function toggle(member: ManagedMember) {
    if (
      !deletionAllowed ||
      member.id === actor?.personId ||
      member.revision == null ||
      list.loading === "refresh"
    )
      return;
    setSelectedIds((previous) =>
      previous.includes(member.id)
        ? previous.filter((id) => id !== member.id)
        : [...previous, member.id],
    );
  }
  const row = (member: ManagedMember) => (
    <View style={[ui.row, { borderBottomColor: palette.line }]}>
      <ProfileAvatar name={member.name} source={member.photo} />
      <View style={ui.rowCopy}>
        <Text style={[ui.name, { color: palette.text }]}>
          {formatMemberName(member, undefined, true)}
        </Text>
        <Text style={[ui.detail, { color: palette.secondaryText }]}>
          {archived
            ? `${copy.formerDetail}${member.leftAt ? `: ${new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${member.leftAt.slice(0, 10)}T12:00:00Z`))}` : ""}`
            : member.group || copy.notAssigned}
        </Text>
        {selecting && member.id === actor?.personId ? (
          <Text style={[ui.detail, { color: palette.secondaryText }]}>
            {copy.self}
          </Text>
        ) : null}
      </View>
      {selecting ? <Ionicons
        accessibilityElementsHidden
        color={palette.accent}
        name={selectedIds.includes(member.id) ? "checkmark-circle" : "ellipse-outline"}
        size={22}
      /> : null}
    </View>
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
        <View style={ui.heading}>
          <Text
            accessibilityRole="header"
            style={[ui.title, { color: palette.text }]}
          >
            {copy.title}
          </Text>
          <ManagementLink href="/manage/member/new">
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
        <View style={ui.chips}>
          {[false, true].map((value) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: archived === value }}
              key={String(value)}
              onPress={() =>
                router.setParams({ status: value ? "former" : "active" })
              }
              style={[
                ui.chip,
                {
                  borderColor:
                    archived === value ? palette.accent : palette.line,
                  backgroundColor:
                    archived === value ? palette.accentSoft : palette.surface,
                },
              ]}
            >
              <Text
                style={{
                  color: archived === value ? palette.accent : palette.text,
                }}
              >
                {value ? copy.former : copy.active}
              </Text>
            </Pressable>
          ))}
          {deletionAllowed ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSelecting(!selecting);
                setSelectedIds([]);
              }}
              style={ui.smallButton}
            >
              <Text style={{ color: palette.accent }}>
                {selecting ? copy.cancel : copy.select}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {selecting ? (
          <View style={ui.chips}>
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: palette.text, paddingVertical: 12 }}
            >
              {selectedMembers.length} {copy.selected}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={list.loading === "refresh"}
              onPress={() => setSelectedIds(selectable.map((m) => m.id))}
              style={ui.smallButton}
            >
              <Text style={{ color: palette.accent }}>{copy.selectLoaded}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedIds([])}
              style={ui.smallButton}
            >
              <Text style={{ color: palette.accent }}>{copy.clear}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!selectedMembers.length || list.loading === "refresh"}
              onPress={() => setDeletionMembers(selectedMembers)}
              style={[
                ui.smallButton,
                !selectedMembers.length && { opacity: 0.5 },
              ]}
            >
              <Text style={{ color: palette.danger }}>{copy.remove}</Text>
            </Pressable>
          </View>
        ) : null}
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
        renderItem={({ item }) =>
          selecting ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={formatMemberName(item)}
              accessibilityState={{
                checked: selectedIds.includes(item.id),
                disabled:
                  item.id === actor?.personId || list.loading === "refresh",
              }}
              disabled={
                item.id === actor?.personId || list.loading === "refresh"
              }
              onPress={() => toggle(item)}
            >
              {row(item)}
            </Pressable>
          ) : (
            <ManagementLink
              href={{
                pathname: "/manage/member/[memberId]",
                params: { memberId: item.id },
              }}
              label={formatMemberName(item)}
            >
              {row(item)}
            </ManagementLink>
          )
        }
        ListEmptyComponent={
          <View style={ui.empty}>
            {list.loading === "initial" || list.error ? (
              <ManagementFeedback
                error={list.error}
                loading={list.loading === "initial"}
                retry={list.retry}
              />
            ) : (
              <>
                <Text style={[ui.sectionTitle, { color: palette.text }]}>
                  {committedQuery ? copy.noMatches : copy.empty}
                </Text>
                {committedQuery ? (
                  <Text style={[ui.detail, { color: palette.secondaryText }]}>
                    {copy.hint}
                  </Text>
                ) : null}
              </>
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
      {deletionMembers && deletionAllowed ? (
        <BulkMemberDeletion
          members={deletionMembers}
          onClose={(attempted) => {
            setDeletionMembers(null);
            setSelectedIds([]);
            setSelecting(false);
            if (attempted) list.refresh();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
