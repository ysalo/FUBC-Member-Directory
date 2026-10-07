import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { canManageAccounts } from "@/lib/permissions";
import { isBackendConfigured } from "@/lib/supabase";
import { formatMemberName } from "@/lib/member-name";
import { errorMessage, withTimeout } from "@/lib/async-state";
import { managementRepository } from "./management-repository";
import type { ManagementState, ManagedMember } from "./model";
import { managedAccountHref, normalizeAccountId } from "./route-params";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { useManagementList } from "./use-management-list";
import { useManagementSearch } from "./use-management-search";
import {
  ManagementFeedback,
  ManagementListFooter,
  ManagementSearch,
  ui,
} from "./ManagementListParts";

export function MemberLinkScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy =
    locale === "uk"
      ? {
          title: "Пов’язати учасника",
          search: "Пошук учасників",
          empty: "Немає доступних учасників",
          save: "Зберегти зв’язок",
          saving: "Збереження…",
          cancel: "Скасувати",
          invalid: "Недійсне посилання на обліковий запис.",
          missing: "Цей обліковий запис недоступний.",
          selected: "Вибрано",
        }
      : {
          title: "Link member",
          search: "Search members",
          empty: "No available members",
          save: "Save link",
          saving: "Saving…",
          cancel: "Cancel",
          invalid: "This account link is invalid.",
          missing: "This account is unavailable.",
          selected: "Selected",
        };
  const params = useLocalSearchParams<{ accountId?: string | string[] }>();
  const accountId = normalizeAccountId(params.accountId);
  const router = useRouter();
  const session = useSession();
  const actor = session.status === "ready" ? session.account : null;
  const allowed = !isBackendConfigured || canManageAccounts(actor);
  const identity = `${actor?.id}:${actor?.status}:${actor?.role}:${accountId}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [loaded, setLoaded] = useState<{
      identity: string;
      value: ManagementState;
    } | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<ManagedMember | null>(null),
    [reload, setReload] = useState(0);
  const state = loaded?.identity === identity ? loaded.value : null,
    submitting = useRef(false);
  const guard = useUnsavedChanges(Boolean(selected));
  const { query, setQuery, committedQuery } = useManagementSearch();
  const list = useManagementList(
    `link:${accountId}:${committedQuery}`,
    (request) => managementRepository.loadMembersPage(request),
    {
      query: committedQuery,
      filters: { linkable: true, accountId: accountId ?? undefined },
    },
    allowed &&
      Boolean(
        accountId &&
          state?.accounts.some((account) => account.id === accountId),
      ),
  );
  useEffect(() => {
    let active = true;
    setLoaded(null);
    setSelected(null);
    setError(null);
    setBusy(false);
    submitting.current = false;
    if (accountId && allowed)
      void withTimeout(managementRepository.loadAccount(accountId))
        .then((value) => {
          if (active && currentIdentity.current === identity)
            setLoaded({ identity, value });
        })
        .catch((cause) => {
          if (active && currentIdentity.current === identity)
            setError(errorMessage(cause));
        });
    return () => {
      active = false;
    };
  }, [accountId, allowed, identity, reload]);
  async function linkMember() {
    if (
      !accountId ||
      !state ||
      !selected ||
      busy ||
      submitting.current ||
      !allowed
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const origin = identity;
    try {
      await managementRepository.apply(state, {
        type: "link-account",
        accountId,
        personId: selected.id,
      });
      if (currentIdentity.current === origin) {
        guard.allowLeave();
        router.replace(managedAccountHref(accountId));
      }
    } catch (cause) {
      if (currentIdentity.current === origin) {
        setError(errorMessage(cause));
        setBusy(false);
        submitting.current = false;
      }
    }
  }
  if (
    !accountId ||
    !state ||
    !state.accounts.some((account) => account.id === accountId)
  )
    return (
      <View
        style={[
          ui.root,
          ui.empty,
          { backgroundColor: palette.background, justifyContent: "center" },
        ]}
      >
        {!accountId || state ? (
          <Text style={{ color: palette.text }}>
            {!accountId ? copy.invalid : copy.missing}
          </Text>
        ) : (
          <ManagementFeedback
            error={error}
            loading={!error}
            retry={() => setReload((value) => value + 1)}
          />
        )}
      </View>
    );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[ui.root, { backgroundColor: palette.background }]}
    >
      <View style={[ui.toolbar, ui.width, { borderBottomColor: palette.line }]}>
        <Text
          accessibilityRole="header"
          style={[ui.title, { color: palette.text }]}
        >
          {copy.title}
        </Text>
        <Text style={[ui.detail, { color: palette.secondaryText }]}>
          {state.accounts.find((account) => account.id === accountId)?.email}
        </Text>
        <ManagementSearch
          label={copy.search}
          query={query}
          onChange={setQuery}
          disabled={busy}
        />
        <ManagementFeedback error={error} />
        <ManagementFeedback
          error={list.failedOperation === "refresh" ? list.error : null}
          loading={list.loading === "refresh"}
          retry={list.retry}
        />
        {selected ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: palette.text }}
          >
            {copy.selected}: {formatMemberName(selected, undefined, true)}
          </Text>
        ) : null}
      </View>
      <FlatList
        style={ui.width}
        data={list.items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={list.error ? undefined : list.append}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={formatMemberName(item)}
            accessibilityRole="radio"
            accessibilityState={{
              checked: selected?.id === item.id,
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => setSelected(item)}
            style={[
              ui.row,
              {
                borderBottomColor: palette.line,
                backgroundColor:
                  selected?.id === item.id
                    ? palette.accentSoft
                    : palette.background,
              },
            ]}
          >
            <ProfileAvatar name={item.name} source={item.photo} />
            <View style={ui.rowCopy}>
              <Text style={[ui.name, { color: palette.text }]}>
                {formatMemberName(item, undefined, true)}
              </Text>
              <Text style={[ui.detail, { color: palette.secondaryText }]}>
                {item.group}
              </Text>
            </View>
            <Ionicons
              accessibilityElementsHidden
              color={palette.accent}
              name={
                selected?.id === item.id
                  ? "radio-button-on"
                  : "radio-button-off"
              }
              size={22}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={ui.empty}>
            {list.loading || list.error ? (
              <ManagementFeedback
                error={list.error}
                loading={list.loading !== null}
                retry={list.retry}
              />
            ) : (
              <Text style={{ color: palette.secondaryText }}>{copy.empty}</Text>
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
      <View
        style={[
          ui.toolbar,
          ui.width,
          ui.chips,
          {
            borderBottomColor: palette.line,
            paddingBottom:
              Platform.OS === "web" ? 18 : Math.max(18, insets.bottom),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() =>
            guard.confirmLeave(() =>
              router.replace(managedAccountHref(accountId)),
            )
          }
          style={[ui.more, { flex: 1, borderColor: palette.line }]}
        >
          <Text style={{ color: palette.accent }}>{copy.cancel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || !selected, busy }}
          disabled={busy || !selected}
          onPress={() => void linkMember()}
          style={[
            ui.more,
            {
              flex: 2,
              borderColor: palette.accent,
              backgroundColor: palette.accent,
            },
            (busy || !selected) && { opacity: 0.5 },
          ]}
        >
          <Text style={{ color: "#FFF", fontWeight: "700" }}>
            {busy ? copy.saving : copy.save}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
