import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { LoadingSkeleton } from "@/features/shell/LoadingSkeleton";
import { formatFixedPdt } from "@/lib/dates";
import { canCreateVisit } from "@/lib/permissions";

import { visitationCopy } from "./copy";
import { bindVisitationSession, visitationDemoMode, visitationRepository } from "./repository";
import type { RepositorySnapshot, VisitListItem, VisitListMode } from "./types";
import { ActionButton, ScreenState, SectionCard, StatusPill, visitColors } from "./VisitationUi";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: RepositorySnapshot; visits: VisitListItem[]; nextOffset: number | null; loadingMore: boolean };

export function VisitationListScreen() {
  const { locale } = useLocalization();
  const session = useSession();
  const account = session.status === "ready" ? session.account : null;
  const c = visitationCopy(locale);
  const router = useRouter();
  const desktop = useDesktopLayout();
  const [mode, setMode] = useState<VisitListMode>("current");
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState({ status: "loading" });
    try {
      const [snapshot, page] = await Promise.all([visitationRepository.getSnapshot(), visitationRepository.listPage(mode)]);
      setState({ status: "ready", snapshot, visits: page.items, nextOffset: page.nextOffset, loadingMore: false });
    } catch {
      setState({ status: "error", message: c.loadFailed });
    } finally {
      setRefreshing(false);
    }
  }, [c.loadFailed, mode]);

  const loadMore = useCallback(async () => {
    if (state.status !== "ready" || state.nextOffset === null || state.loadingMore) return;
    setState((current) => current.status === "ready" ? { ...current, loadingMore: true } : current);
    try {
      const page = await visitationRepository.listPage(mode, state.nextOffset);
      setState((current) => {
        if (current.status !== "ready") return current;
        const known = new Set(current.visits.map((visit) => visit.id));
        return { ...current, visits: [...current.visits, ...page.items.filter((visit) => !known.has(visit.id))], nextOffset: page.nextOffset, loadingMore: false };
      });
    } catch {
      setState((current) => current.status === "ready" ? { ...current, loadingMore: false } : current);
    }
  }, [mode, state]);

  useEffect(() => bindVisitationSession(account), [account]);

  useEffect(() => {
    void load();
    return visitationRepository.subscribe(() => void load(true));
  }, [load]);

  const selectActor = async (accountId: string) => {
    if (state.status !== "ready" || state.snapshot.actor.id === accountId) return;
    await visitationRepository.setActor(accountId);
  };

  const content = (() => {
    if (state.status === "loading") return <View accessibilityLiveRegion="polite"><LoadingSkeleton rows={4} /><ScreenState icon="calendar-outline" loading title={c.loading} /></View>;
    if (state.status === "error") return <ScreenState actionLabel={c.retry} detail={state.message} icon="cloud-offline-outline" onAction={() => void load()} title={c.loadFailed} />;
    return (
      <>
        {visitationDemoMode ? (
          <SectionCard detail={c.previewHint} title={c.previewIdentity}>
            <View accessibilityRole="radiogroup" style={styles.actorRow}>
              {state.snapshot.actors.map((actor) => {
                const active = actor.id === state.snapshot.actor.id;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    key={actor.id}
                    onPress={() => void selectActor(actor.id)}
                    style={({ pressed }) => [styles.actorButton, active && styles.actorButtonActive, pressed && styles.pressed]}
                  >
                    <Ionicons accessibilityElementsHidden color={active ? visitColors.accent : visitColors.secondaryText} name={actor.leadershipMinistry === "pastor" ? "book-outline" : "people-outline"} size={19} />
                    <Text numberOfLines={2} style={[styles.actorLabel, active && styles.actorLabelActive]}>{actor.displayName}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        ) : null}

        <View accessibilityRole="tablist" style={styles.segment}>
          {(["current", "archive"] as const).map((value) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === value }}
              key={value}
              onPress={() => setMode(value)}
              style={[styles.segmentButton, mode === value && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentLabel, mode === value && styles.segmentLabelActive]}>{value === "current" ? c.current : c.archive}</Text>
            </Pressable>
          ))}
        </View>

        {canCreateVisit(state.snapshot.actor) && mode === "current" ? (
          <ActionButton icon="add" label={c.planVisit} onPress={() => router.push("/visitation/new" as Href)} />
        ) : null}

        {state.visits.length === 0 ? (
          <ScreenState
            detail={mode === "current" ? c.emptyCurrentDetail : c.emptyArchiveDetail}
            icon={mode === "current" ? "calendar-clear-outline" : "archive-outline"}
            title={mode === "current" ? c.emptyCurrent : c.emptyArchive}
          />
        ) : (
          <View style={[styles.listGroups, desktop && styles.desktopListGroups]}>
            {[
              { title: c.myVisits, visits: state.visits.filter((visit) => visit.plannerId === state.snapshot.actor.id) },
              { title: c.invitations, visits: state.visits.filter((visit) => visit.recipients.some((recipient) => recipient.accountId === state.snapshot.actor.id)) },
            ].filter((section) => section.visits.length > 0).map((section) => <View key={section.title} style={[styles.list, desktop && styles.desktopList]}>
            <Text accessibilityRole="header" style={styles.listHeading}>{section.title}</Text>
            {section.visits.map((visit) => {
              const status = visit.archivedAt ? "archived" : visit.status;
              const tone = status === "completed" ? "success" : status === "cancelled" ? "danger" : status === "archived" ? "neutral" : "accent";
              return (
                <Pressable
                  accessibilityHint={c.viewDetails}
                  accessibilityRole="button"
                  key={visit.id}
                  onPress={() => router.push(`/visitation/${visit.id}` as Href)}
                  style={({ pressed }) => [styles.visitCard, pressed && styles.pressed]}
                >
                  <View style={styles.visitTopline}>
                    <StatusPill label={c[status]} tone={tone} />
                  </View>
                  <Text selectable style={styles.memberName}>{visit.memberName}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons accessibilityElementsHidden color={visitColors.secondaryText} name="calendar-outline" size={17} />
                    <Text selectable style={styles.metaText}>{formatFixedPdt(visit.scheduledAt, locale)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons accessibilityElementsHidden color={visitColors.secondaryText} name="location-outline" size={17} />
                    <Text numberOfLines={2} selectable style={styles.metaText}>{visit.location}</Text>
                  </View>
                  <View style={styles.responseList}>
                    <View style={styles.responseRow}>
                      <Text numberOfLines={1} style={styles.responseName}>{visit.plannerName}</Text>
                      <StatusPill label={c.organizer} tone="accent" />
                    </View>
                    {visit.recipients.map((recipient) => (
                      <View key={recipient.participantPersonId} style={styles.responseRow}>
                        <Text numberOfLines={1} style={styles.responseName}>{recipient.participantName}</Text>
                        <StatusPill
                          label={recipient.accountId ? c[recipient.response] : c.noAccount}
                          tone={recipient.response === "accepted" ? "success" : recipient.response === "declined" ? "danger" : "neutral"}
                        />
                      </View>
                    ))}
                  </View>
                  <Ionicons accessibilityElementsHidden color={visitColors.secondaryText} name="chevron-forward" size={21} style={styles.chevron} />
                </Pressable>
              );
            })}
          </View>)}
          </View>
        )}
        {state.nextOffset !== null ? (
          <ActionButton icon="chevron-down" label={state.loadingMore ? c.loadingMore : c.loadMore} onPress={() => void loadMore()} />
        ) : null}
        <Text selectable style={styles.privacyNote}>{Platform.OS === "web" ? (locale === "uk" ? "Відкривайте відвідування, щоб переглянути оновлення. Сповіщення в цій вебверсії не надсилаються." : "Open visitations to review updates. This web version does not send notifications.") : c.notificationNote}</Text>
      </>
    );
  })();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, desktop && styles.desktopContent]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={visitColors.accent} onRefresh={() => { setRefreshing(true); void load(true); }} />}
      >
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" selectable style={styles.title}>{c.title}</Text>
          <Pressable accessibilityLabel={c.refresh} accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
            <Ionicons accessibilityElementsHidden color={visitColors.text} name="refresh" size={22} />
          </Pressable>
        </View>
        {content}
      </ScrollView>
      <WebTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  desktopListGroups: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  desktopList: { flex: 1, minWidth: 0 },
  desktopContent: { maxWidth: 1120, paddingHorizontal: 32, paddingTop: 28 },
  screen: { backgroundColor: visitColors.background, flex: 1 },
  content: { alignSelf: "center", gap: 14, maxWidth: 680, paddingBottom: 104, paddingHorizontal: 18, paddingTop: 20, width: "100%" },
  titleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  title: { color: visitColors.text, flex: 1, fontSize: 40, fontWeight: "800", letterSpacing: -1.2, lineHeight: 48 },
  refreshButton: { alignItems: "center", backgroundColor: visitColors.surfaceMuted, borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  actorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actorButton: { alignItems: "center", backgroundColor: visitColors.background, borderColor: visitColors.line, borderCurve: "continuous", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 7, minHeight: 45, paddingHorizontal: 10, paddingVertical: 8 },
  actorButtonActive: { backgroundColor: visitColors.accentSoft, borderColor: visitColors.accent },
  actorLabel: { color: visitColors.secondaryText, flexShrink: 1, fontSize: 13, fontWeight: "600", maxWidth: 130 },
  actorLabelActive: { color: visitColors.accent },
  segment: { backgroundColor: visitColors.surfaceMuted, borderCurve: "continuous", borderRadius: 12, flexDirection: "row", padding: 3 },
  segmentButton: { alignItems: "center", borderCurve: "continuous", borderRadius: 9, flex: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 10 },
  segmentButtonActive: { backgroundColor: visitColors.surface, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" },
  segmentLabel: { color: visitColors.secondaryText, fontSize: 15, fontWeight: "600" },
  segmentLabelActive: { color: visitColors.text },
  list: { gap: 10 },
  listGroups: { gap: 20 },
  listHeading: { color: visitColors.text, fontSize: 17, fontWeight: "700", lineHeight: 23, paddingHorizontal: 2, paddingTop: 3 },
  visitCard: { backgroundColor: visitColors.surface, borderColor: visitColors.line, borderCurve: "continuous", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 9, padding: 16, paddingRight: 43 },
  visitTopline: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  memberName: { color: visitColors.text, fontSize: 20, fontWeight: "700", lineHeight: 26 },
  metaRow: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  metaText: { color: visitColors.secondaryText, flex: 1, fontSize: 14, lineHeight: 20 },
  responseList: { borderTopColor: visitColors.line, borderTopWidth: StyleSheet.hairlineWidth, gap: 7, marginTop: 2, paddingTop: 10 },
  responseName: { color: visitColors.text, flex: 1, fontSize: 14, fontWeight: "600" },
  responseRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  chevron: { position: "absolute", right: 14, top: "48%" },
  privacyNote: { color: visitColors.secondaryText, fontSize: 12, lineHeight: 18, paddingHorizontal: 8, textAlign: "center" },
  pressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
});
