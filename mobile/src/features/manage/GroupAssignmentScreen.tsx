import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  SectionList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import SegmentedControl from "@expo/ui/community/segmented-control";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { Alert } from "@/features/platform/alert";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { canManageGroups } from "@/lib/permissions";
import { isBackendConfigured } from "@/lib/supabase";
import { errorMessage, withTimeout } from "@/lib/async-state";
import { formatMemberName } from "@/lib/member-name";
import { managementRepository } from "./management-repository";
import type { ManagedGroup, GroupManagementState } from "./model";
import type { ManagementCandidate } from "./management-read-model";
import { useManagementList } from "./use-management-list";
import { useManagementSearch } from "./use-management-search";
import {
  ManagementFeedback,
  ManagementListFooter,
  ManagementSearch,
  ui,
} from "./ManagementListParts";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { GroupFileImport } from "./GroupFileImport";

const labels = {
  en: {
    name: "Group name",
    nameRequired: "Enter a group name.",
    type: "Group type",
    membership: "Membership",
    responsibility: "Care",
    deacons: "Responsible deacons",
    deaconDetail: "Choose up to two. A deacon can lead one group only.",
    changeDeacons: "Choose deacons",
    noDeacons: "No deacons selected",
    deaconSearch: "Search deacons",
    members: "Group members",
    all: "All members",
    selected: "Selected",
    search: "Search members",
    none: "No members match this view.",
    noDeaconMatches: "No active deacons match.",
    assigned: "Assigned to this group",
    unassigned: "No current assignment",
    other: "Currently assigned to",
    leader: "Responsible deacon",
    limit: "A group can have at most two deacons.",
    moveTitle: "Move existing assignments?",
    moveDetail: (count: number) =>
      `${count} selected ${count === 1 ? "person is" : "people are"} assigned elsewhere and will be moved to this group.`,
    move: "Move and save",
    save: "Save group",
    saving: "Saving…",
    checking: "Checking assignments…",
    cancel: "Cancel",
    done: "Done",
    dirty: "Unsaved changes",
    saved: "No changes",
    loading: "Loading group…",
    unavailable: "This group is unavailable.",
    failed: "The group could not be saved. Try again.",
    delete: "Delete group",
    deleteDetail:
      "Members will not be deleted. Their assignment to this group will simply be removed.",
    deleteTitle: (name: string) => `Delete “${name}”?`,
    deleteConfirm: "Delete",
    importing: "Open group file import",
    closeImport: "Close import",
    importLoading: "Loading import matching data…",
    clearSelected: "Clear member selection",
  },
  uk: {
    name: "Назва групи",
    nameRequired: "Введіть назву групи.",
    type: "Тип групи",
    membership: "Членська",
    responsibility: "Турботи",
    deacons: "Відповідальні диякони",
    deaconDetail:
      "Оберіть не більше двох. Диякон може відповідати лише за одну групу.",
    changeDeacons: "Обрати дияконів",
    noDeacons: "Дияконів не вибрано",
    deaconSearch: "Пошук дияконів",
    members: "Учасники групи",
    all: "Усі учасники",
    selected: "Вибрані",
    search: "Пошук учасників",
    none: "Учасників у цьому поданні не знайдено.",
    noDeaconMatches: "Активних дияконів не знайдено.",
    assigned: "Призначено до цієї групи",
    unassigned: "Без поточного призначення",
    other: "Зараз у групі",
    leader: "Відповідальний диякон",
    limit: "У групі може бути не більше двох дияконів.",
    moveTitle: "Перемістити наявні призначення?",
    moveDetail: (count: number) =>
      `${count} вибраних людей уже призначено до інших груп. Їх буде переміщено до цієї групи.`,
    move: "Перемістити й зберегти",
    save: "Зберегти групу",
    saving: "Збереження…",
    checking: "Перевірка призначень…",
    cancel: "Скасувати",
    done: "Готово",
    dirty: "Незбережені зміни",
    saved: "Без змін",
    loading: "Завантаження групи…",
    unavailable: "Ця група недоступна.",
    failed: "Не вдалося зберегти групу. Спробуйте ще раз.",
    delete: "Видалити групу",
    deleteDetail:
      "Учасників не буде видалено. Буде видалено лише їхнє призначення до цієї групи.",
    deleteTitle: (name: string) => `Видалити групу «${name}»?`,
    deleteConfirm: "Видалити",
    importing: "Відкрити імпорт файлу групи",
    closeImport: "Закрити імпорт",
    importLoading: "Завантаження даних для зіставлення…",
    clearSelected: "Скасувати вибір учасників",
  },
} as const;
const equalIds = (a: string[], b: string[]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export function GroupAssignmentScreen({
  creating = false,
}: {
  creating?: boolean;
}) {
  const desktop = useDesktopLayout(),
    insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const router = useRouter();
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const session = useSession(),
    actor = session.status === "ready" ? session.account : null;
  const allowed = !isBackendConfigured || canManageGroups(actor);
  const identity = `${actor?.id ?? session.status}:${actor?.role}:${actor?.status}:${creating}:${groupId ?? ""}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const generation = useRef(0),
    submitting = useRef(false),
    nameInput = useRef<NativeTextInput>(null);
  const [loaded, setLoaded] = useState<{
      identity: string;
      group: ManagedGroup | null;
    } | null>(null),
    [reload, setReload] = useState(0),
    [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState(""),
    [kind, setKind] = useState<ManagedGroup["kind"]>("membership"),
    [selectedMembers, setSelectedMembers] = useState<string[]>([]),
    [selectedDeacons, setSelectedDeacons] = useState<string[]>([]);
  const [mode, setMode] = useState<"selected" | "all">(
      creating ? "all" : "selected",
    ),
    [operation, setOperation] = useState<
      "checking" | "saving" | "deleting" | null
    >(null),
    [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false),
    [deaconQuery, setDeaconQuery] = useState(""),
    [deaconSearch, setDeaconSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false),
    [importData, setImportData] = useState<GroupManagementState | null>(null),
    [importLoading, setImportLoading] = useState(false),
    [importPending, setImportPending] = useState(false),
    [importError, setImportError] = useState<string | null>(null);
  const { query, setQuery, committedQuery } = useManagementSearch();
  const snapshot = loaded?.identity === identity ? loaded : null,
    group = snapshot?.group ?? undefined,
    ready = Boolean(snapshot && (creating || group));
  const busy = operation !== null;
  useEffect(() => {
    const ticket = ++generation.current;
    setLoaded(null);
    setLoadError(null);
    setError(null);
    setOperation(null);
    submitting.current = false;
    setImportOpen(false);
    setImportData(null);
    setImportPending(false);
    setImportLoading(false);
    setImportError(null);
    setPickerOpen(false);
    if (!allowed) return;
    void withTimeout(
      managementRepository.loadGroupContext(creating ? undefined : groupId),
    )
      .then((context) => {
        if (ticket !== generation.current || identityRef.current !== identity)
          return;
        setLoaded({ identity, group: context.group });
        setName(context.group?.name ?? "");
        setKind(context.group?.kind ?? "membership");
        setSelectedMembers(context.group?.memberIds ?? []);
        setSelectedDeacons(context.group?.deaconIds ?? []);
        setMode(creating ? "all" : "selected");
      })
      .catch((cause) => {
        if (ticket === generation.current && identityRef.current === identity)
          setLoadError(errorMessage(cause));
      });
    return () => {
      generation.current++;
    };
  }, [allowed, creating, groupId, identity, reload]);
  useEffect(() => {
    if (!deaconQuery.trim()) {
      setDeaconSearch("");
      return;
    }
    const timer = setTimeout(() => setDeaconSearch(deaconQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [deaconQuery]);
  const targetKind = group?.kind ?? kind;
  const dirty = Boolean(
    ready &&
      (importPending ||
        name !== (group?.name ?? "") ||
        targetKind !== (group?.kind ?? "membership") ||
        !equalIds(selectedMembers, group?.memberIds ?? []) ||
        !equalIds(selectedDeacons, group?.deaconIds ?? [])),
  );
  const guard = useUnsavedChanges(dirty);
  // Keep the server roster fixed for this view/query. Removing a selected row
  // hides it locally without shifting later offsets or refetching the roster.
  const selectedRead = useRef<{ key: string; ids: string[] } | null>(null);
  const [rosterRevision, setRosterRevision] = useState(0);
  const selectedReadKey = `${identity}:${mode}:${committedQuery}:${ready}:${rosterRevision}`;
  if (selectedRead.current?.key !== selectedReadKey)
    selectedRead.current = { key: selectedReadKey, ids: [...selectedMembers] };
  const list = useManagementList(
    `group-members:${identity}:${mode}:${committedQuery}:${rosterRevision}`,
    (request) => managementRepository.loadCandidatesPage(request),
    {
      query: committedQuery,
      filters: {
        selectedOnly: mode === "selected",
        selectedIds: mode === "selected" ? selectedRead.current.ids : [],
      },
    },
    allowed && ready,
  );
  const deacons = useManagementList(
    `group-deacons:${identity}:${deaconSearch}`,
    (request) => managementRepository.loadCandidatesPage(request),
    { query: deaconSearch, filters: { deacons: true } },
    allowed && ready && pickerOpen,
  );
  const selectedDeaconList = useManagementList(
    `group-selected-deacons:${identity}:${selectedDeacons.join(",")}`,
    (request) => managementRepository.loadCandidatesPage(request),
    {
      limit: 2,
      filters: {
        deacons: true,
        selectedOnly: true,
        selectedIds: selectedDeacons,
      },
    },
    allowed && ready && selectedDeacons.length > 0,
  );
  const visibleMemberItems =
    mode === "selected"
      ? list.items.filter((member) => selectedMembers.includes(member.id))
      : list.items;
  const visibleTotal =
    mode !== "selected"
      ? list.total
      : !committedQuery
        ? selectedMembers.length
        : list.total -
          list.items.filter((member) => !selectedMembers.includes(member.id))
            .length;
  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace("/manage/groups");
  }
  function cancel() {
    if (!busy) guard.confirmLeave(leave);
  }
  function toggleDeacon(id: string) {
    if (busy) return;
    setError(null);
    if (selectedDeacons.includes(id))
      setSelectedDeacons((previous) =>
        previous.filter((value) => value !== id),
      );
    else if (selectedDeacons.length >= 2) setError(copy.limit);
    else {
      setSelectedDeacons((previous) => [...previous, id]);
      setSelectedMembers((previous) =>
        previous.filter((value) => value !== id),
      );
    }
  }
  function toggleMember(id: string) {
    if (busy || selectedDeacons.includes(id)) return;
    setError(null);
    setSelectedMembers((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    );
  }
  async function persist() {
    if (!ready || !allowed || importPending) return;
    const ticket = generation.current,
      origin = identity;
    setOperation("saving");
    setError(null);
    try {
      await managementRepository.saveGroup({
        p_id: group?.id ?? null,
        p_revision: group?.revision ?? null,
        p_name: name.trim(),
        p_kind: targetKind,
        p_archived: false,
        p_deacon_ids: selectedDeacons,
        p_member_ids: selectedMembers,
      });
      if (ticket !== generation.current || identityRef.current !== origin)
        return;
      guard.allowLeave();
      leave();
    } catch (cause) {
      if (ticket === generation.current && identityRef.current === origin) {
        setError(errorMessage(cause));
        setOperation(null);
        submitting.current = false;
      }
    }
  }
  async function confirmSave() {
    if (
      !ready ||
      !allowed ||
      busy ||
      submitting.current ||
      importPending ||
      importLoading
    )
      return;
    if (!name.trim()) {
      setError(copy.nameRequired);
      nameInput.current?.focus();
      return;
    }
    submitting.current = true;
    setOperation("checking");
    setError(null);
    const ticket = generation.current,
      origin = identity;
    try {
      const count = await withTimeout(
        managementRepository.previewGroupMoves(
          group?.id ?? null,
          targetKind,
          selectedMembers,
          selectedDeacons,
        ),
      );
      if (ticket !== generation.current || identityRef.current !== origin)
        return;
      if (!count) {
        void persist();
        return;
      }
      Alert.alert(
        copy.moveTitle,
        copy.moveDetail(count),
        [
          {
            text: copy.cancel,
            style: "cancel",
            onPress: () => {
              submitting.current = false;
              setOperation(null);
            },
          },
          {
            text: copy.move,
            onPress: () => {
              if (
                ticket === generation.current &&
                identityRef.current === origin
              )
                void persist();
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            submitting.current = false;
            setOperation(null);
          },
        },
      );
    } catch (cause) {
      if (ticket === generation.current && identityRef.current === origin) {
        submitting.current = false;
        setOperation(null);
        setError(errorMessage(cause));
      }
    }
  }
  async function removeGroup() {
    if (
      !group ||
      busy ||
      submitting.current ||
      !allowed ||
      identityRef.current !== identity
    )
      return;
    submitting.current = true;
    setOperation("deleting");
    setError(null);
    const ticket = generation.current,
      origin = identity;
    try {
      await managementRepository.deleteGroup(group.id, group.revision);
      if (ticket === generation.current && identityRef.current === origin) {
        guard.allowLeave();
        leave();
      }
    } catch (cause) {
      if (ticket === generation.current && identityRef.current === origin) {
        submitting.current = false;
        setOperation(null);
        setError(errorMessage(cause));
      }
    }
  }
  function confirmDelete() {
    if (!group || busy) return;
    Alert.alert(copy.deleteTitle(group.name), copy.deleteDetail, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.deleteConfirm,
        style: "destructive",
        onPress: () => void removeGroup(),
      },
    ]);
  }
  function closeImport() {
    const close = () => {
      setImportOpen(false);
      setImportPending(false);
    };
    if (!importPending) {
      close();
      return;
    }
    Alert.alert(
      locale === "uk" ? "Незастосований імпорт" : "Unapplied import",
      locale === "uk"
        ? "Відкинути чернетку імпорту?"
        : "Discard the import draft?",
      [
        { text: copy.cancel, style: "cancel" },
        {
          text: locale === "uk" ? "Відкинути імпорт" : "Discard import",
          style: "destructive",
          onPress: close,
        },
      ],
    );
  }
  async function openImport() {
    if (busy) return;
    setImportOpen(true);
    if (importData || importLoading) return;
    setImportLoading(true);
    setImportError(null);
    const ticket = generation.current,
      origin = identity;
    try {
      const data = await withTimeout(
        managementRepository.loadGroupImportCatalog(),
        30000,
      );
      if (ticket === generation.current && identityRef.current === origin)
        setImportData(data);
    } catch (cause) {
      if (ticket === generation.current && identityRef.current === origin)
        setImportError(errorMessage(cause));
    } finally {
      if (ticket === generation.current && identityRef.current === origin)
        setImportLoading(false);
    }
  }
  function candidateRow(item: ManagementCandidate, deacon = false) {
    const checked = (deacon ? selectedDeacons : selectedMembers).includes(
        item.id,
      ),
      isLeader = !deacon && selectedDeacons.includes(item.id);
    const assignmentId = deacon
      ? item.currentDeaconGroupId
      : targetKind === "membership"
        ? item.currentMembershipGroupId
        : item.currentResponsibilityGroupId;
    const assignmentName = deacon
      ? item.currentDeaconGroupName
      : targetKind === "membership"
        ? item.currentMembershipGroupName
        : item.currentResponsibilityGroupName;
    const status = isLeader
      ? copy.leader
      : assignmentId === group?.id && assignmentId
        ? copy.assigned
        : assignmentName
          ? `${copy.other} ${assignmentName}`
          : copy.unassigned;
    return (
      <Pressable
        accessibilityLabel={`${formatMemberName(item)}. ${status}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: busy || isLeader }}
        disabled={busy || isLeader}
        onPress={() => (deacon ? toggleDeacon(item.id) : toggleMember(item.id))}
        style={[
          ui.row,
          {
            borderBottomColor: palette.line,
            backgroundColor: checked ? palette.accentSoft : palette.background,
          },
          isLeader && { opacity: 0.6 },
        ]}
      >
        <ProfileAvatar name={item.name} source={item.photo} />
        <View style={ui.rowCopy}>
          <Text style={[ui.name, { color: palette.text }]}>
            {formatMemberName(item, undefined, true)}
          </Text>
          <Text style={[ui.detail, { color: palette.secondaryText }]}>
            {status}
          </Text>
        </View>
        <Ionicons
          accessibilityElementsHidden
          color={checked ? palette.accent : palette.secondaryText}
          name={checked ? "checkmark-circle" : "ellipse-outline"}
          size={24}
        />
      </Pressable>
    );
  }
  if (!ready)
    return (
      <View style={[styles.state, { backgroundColor: palette.background }]}>
        {loadError || snapshot ? (
          <>
            {!loadError ? (
              <Text style={{ color: palette.text }}>{copy.unavailable}</Text>
            ) : null}
            {loadError ? (
              <ManagementFeedback
                error={loadError}
                retry={() => setReload((value) => value + 1)}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={leave}
              style={ui.smallButton}
            >
              <Text style={{ color: palette.accent }}>{copy.cancel}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={palette.accent} />
            <Text style={{ color: palette.secondaryText }}>{copy.loading}</Text>
          </>
        )}
      </View>
    );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[ui.root, { backgroundColor: palette.background }]}
    >
      <SectionList
        style={ui.width}
        contentContainerStyle={ui.content}
        sections={[{ key: "members", data: visibleMemberItems }]}
        stickySectionHeadersEnabled
        renderSectionHeader={() => (
          <View
            style={[
              styles.rosterControls,
              ui.width,
              {
                borderColor: palette.line,
                backgroundColor: palette.background,
              },
            ]}
          >
            <View style={ui.heading}>
              <Text
                accessibilityRole="header"
                style={[ui.sectionTitle, { color: palette.text }]}
              >
                {copy.members}
              </Text>
              <View style={ui.chips}>
                {(["selected", "all"] as const).map((value) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === value }}
                    disabled={busy}
                    key={value}
                    onPress={() => setMode(value)}
                    style={[
                      ui.chip,
                      {
                        borderColor:
                          mode === value ? palette.accent : palette.line,
                        backgroundColor:
                          mode === value ? palette.accentSoft : palette.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: mode === value ? palette.accent : palette.text,
                      }}
                    >
                      {value === "selected"
                        ? `${copy.selected} (${selectedMembers.length})`
                        : copy.all}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <ManagementSearch
              label={copy.search}
              query={query}
              onChange={setQuery}
              disabled={busy}
            />
            <ManagementFeedback
              error={list.failedOperation === "refresh" ? list.error : null}
              loading={list.loading === "refresh"}
              retry={list.retry}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onEndReached={list.error ? undefined : list.append}
        onEndReachedThreshold={0.2}
        renderItem={({ item }) => candidateRow(item)}
        ListHeaderComponent={
          <View style={styles.editorHeader}>
            {creating ? (
              <View style={styles.field}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() =>
                    importOpen ? closeImport() : void openImport()
                  }
                  style={ui.smallButton}
                >
                  <Text style={{ color: palette.accent }}>
                    {importOpen ? copy.closeImport : copy.importing}
                  </Text>
                </Pressable>
                {importOpen ? (
                  <>
                    {importLoading ? (
                      <Text style={{ color: palette.secondaryText }}>
                        {copy.importLoading}
                      </Text>
                    ) : null}
                    <ManagementFeedback
                      error={importError}
                      retry={() => void openImport()}
                    />
                    {importData ? (
                      <GroupFileImport
                        data={importData}
                        disabled={busy}
                        onPending={setImportPending}
                        onApply={(file, deaconIds, memberIds) => {
                          setName(file.name);
                          setKind(file.kind);
                          setSelectedDeacons(deaconIds);
                          setSelectedMembers(memberIds);
                          setMode("selected");
                          setRosterRevision((revision) => revision + 1);
                          setError(null);
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.secondaryText }]}>
                {copy.name}
              </Text>
              <TextInput
                ref={nameInput}
                accessibilityLabel={copy.name}
                autoCapitalize="sentences"
                autoCorrect={false}
                editable={!busy}
                maxLength={120}
                onChangeText={(value) => {
                  setName(value);
                  setError(null);
                }}
                style={[
                  styles.input,
                  {
                    borderColor:
                      error === copy.nameRequired
                        ? palette.danger
                        : palette.line,
                    backgroundColor: palette.surface,
                    color: palette.text,
                  },
                ]}
                value={name}
              />
            </View>
            {creating ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.secondaryText }]}>
                  {copy.type}
                </Text>
                <SegmentedControl
                  enabled={!busy}
                  selectedIndex={kind === "membership" ? 0 : 1}
                  onValueChange={(value) =>
                    setKind(
                      value === copy.responsibility
                        ? "responsibility"
                        : "membership",
                    )
                  }
                  values={[copy.membership, copy.responsibility]}
                />
              </View>
            ) : (
              <Text style={[ui.detail, { color: palette.secondaryText }]}>
                {copy[targetKind]}
              </Text>
            )}
            <View style={styles.field}>
              <View style={ui.heading}>
                <Text
                  accessibilityRole="header"
                  style={[ui.sectionTitle, { color: palette.text }]}
                >
                  {copy.deacons} ({selectedDeacons.length}/2)
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setPickerOpen(true)}
                  style={ui.smallButton}
                >
                  <Text style={{ color: palette.accent, fontWeight: "700" }}>
                    {copy.changeDeacons}
                  </Text>
                </Pressable>
              </View>
              <Text style={[ui.detail, { color: palette.secondaryText }]}>
                {copy.deaconDetail}
              </Text>
              <ManagementFeedback
                error={selectedDeaconList.error}
                loading={
                  selectedDeaconList.loading !== null &&
                  selectedDeacons.length > 0
                }
                retry={selectedDeaconList.retry}
              />
              {selectedDeaconList.items.map((item) => (
                <View key={item.id}>{candidateRow(item, true)}</View>
              ))}
              {!selectedDeacons.length ? (
                <Text style={[ui.detail, { color: palette.secondaryText }]}>
                  {copy.noDeacons}
                </Text>
              ) : null}
            </View>
            {group ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={confirmDelete}
                style={[ui.smallButton, styles.delete]}
              >
                <Text style={{ color: palette.danger }}>{copy.delete}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderSectionFooter={() =>
          !visibleMemberItems.length ? (
            <View style={ui.empty}>
              {list.loading === "initial" || list.error ? (
                <ManagementFeedback
                  loading={list.loading === "initial"}
                  error={list.error}
                  retry={list.retry}
                />
              ) : (
                <Text style={[ui.detail, { color: palette.secondaryText }]}>
                  {copy.none}
                </Text>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          list.items.length ? (
            <ManagementListFooter
              {...list}
              count={visibleMemberItems.length}
              total={visibleTotal}
              error={list.failedOperation === "append" ? list.error : null}
            />
          ) : null
        }
      />
      <View
        style={[
          styles.actions,
          ui.width,
          {
            borderTopColor: palette.line,
            backgroundColor: palette.surface,
            paddingBottom:
              Platform.OS === "web" ? 14 : Math.max(14, insets.bottom),
          },
        ]}
      >
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[ui.detail, { color: palette.danger }]}
          >
            {error}
          </Text>
        ) : null}
        <View style={styles.actionRow}>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              ui.detail,
              styles.actionSummary,
              { color: palette.secondaryText },
            ]}
          >
            {selectedMembers.length} {copy.selected.toLocaleLowerCase()} ·{" "}
            {dirty ? copy.dirty : copy.saved}
          </Text>
          <View style={[styles.actionButtons, !desktop && styles.phoneButtons]}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={cancel}
              style={[styles.cancel, { borderColor: palette.line }]}
            >
              <Text style={{ color: palette.accent, fontWeight: "700" }}>
                {copy.cancel}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                busy,
                disabled:
                  busy ||
                  importPending ||
                  importLoading ||
                  (!creating && !dirty),
              }}
              disabled={
                busy || importPending || importLoading || (!creating && !dirty)
              }
              onPress={() => void confirmSave()}
              style={[
                styles.save,
                { backgroundColor: palette.accent },
                (busy ||
                  importPending ||
                  importLoading ||
                  (!creating && !dirty)) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.saveText}>
                {operation === "checking"
                  ? copy.checking
                  : busy
                    ? copy.saving
                    : copy.save}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <Modal
        animationType="slide"
        visible={pickerOpen}
        onRequestClose={() => {
          if (!busy) setPickerOpen(false);
        }}
      >
        <View
          role="dialog"
          aria-modal
          accessibilityLabel={copy.deacons}
          style={[
            ui.root,
            {
              backgroundColor: palette.background,
              paddingTop: Platform.OS === "web" ? 12 : insets.top,
            },
          ]}
        >
          <View
            style={[ui.toolbar, ui.width, { borderBottomColor: palette.line }]}
          >
            <View style={ui.heading}>
              <Text
                accessibilityRole="header"
                style={[ui.sectionTitle, { color: palette.text }]}
              >
                {copy.deacons} ({selectedDeacons.length}/2)
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setPickerOpen(false)}
                style={ui.smallButton}
              >
                <Text style={{ color: palette.accent, fontWeight: "700" }}>
                  {copy.done}
                </Text>
              </Pressable>
            </View>
            <Text style={[ui.detail, { color: palette.secondaryText }]}>
              {copy.deaconDetail}
            </Text>
            <ManagementSearch
              label={copy.deaconSearch}
              query={deaconQuery}
              onChange={setDeaconQuery}
              disabled={busy}
            />
            <ManagementFeedback
              error={
                deacons.failedOperation === "refresh" ? deacons.error : null
              }
              loading={deacons.loading === "refresh"}
              retry={deacons.retry}
            />
            {error ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: palette.danger }}
              >
                {error}
              </Text>
            ) : null}
          </View>
          <FlatList
            style={ui.width}
            data={deacons.items}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            onEndReached={deacons.error ? undefined : deacons.append}
            renderItem={({ item }) => candidateRow(item, true)}
            ListEmptyComponent={
              <View style={ui.empty}>
                {deacons.loading || deacons.error ? (
                  <ManagementFeedback
                    error={deacons.error}
                    loading={deacons.loading !== null}
                    retry={deacons.retry}
                  />
                ) : (
                  <Text style={{ color: palette.secondaryText }}>
                    {copy.noDeaconMatches}
                  </Text>
                )}
              </View>
            }
            ListFooterComponent={
              deacons.items.length ? (
                <ManagementListFooter
                  {...deacons}
                  count={deacons.items.length}
                  error={
                    deacons.failedOperation === "append" ? deacons.error : null
                  }
                />
              ) : null
            }
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  editorHeader: { padding: 18, gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
  },
  delete: { alignSelf: "flex-start" },
  rosterControls: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: { borderTopWidth: 1, padding: 14, gap: 8 },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  actionSummary: { flexGrow: 1, flexShrink: 1 },
  actionButtons: { flexDirection: "row", gap: 10, flexGrow: 1 },
  phoneButtons: { width: "100%" },
  cancel: {
    minHeight: 48,
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  save: {
    minHeight: 48,
    flex: 2,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
