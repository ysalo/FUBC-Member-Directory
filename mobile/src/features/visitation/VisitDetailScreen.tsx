import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageVisit, canRespondToVisit } from "@/lib/permissions";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { formatFixedPdt } from "@/lib/dates";
import { formatPhoneNumber } from "@/lib/phone";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";

import { visitationCopy } from "./copy";
import { calendarSnapshotExporter } from "./calendar";
import { bindVisitationSession, visitationRepository } from "./repository";
import type { RepositorySnapshot, VisitRecord, VisitResponseInput } from "./types";
import { VisitRepositoryError } from "./types";
import { ActionButton, DataRow, ScreenState, SectionCard, StatusPill, visitColors } from "./VisitationUi";

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: RepositorySnapshot; visit: VisitRecord };

type ConfirmAction = "complete" | "cancel" | "archive";

export function VisitDetailScreen({ id }: { id: string }) {
  const { locale } = useLocalization();
  const session = useSession();
  const account = session.status === "ready" ? session.account : null;
  const c = visitationCopy(locale);
  const router = useRouter();
  const desktop = useDesktopLayout();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [mutation, setMutation] = useState<{ status: "idle" | "pending" | "success" | "error" | "conflict"; message?: string }>({ status: "idle" });
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<ConfirmAction | null>(null);
  const [calendarConfirming, setCalendarConfirming] = useState(false);
  const [calendarError, setCalendarError] = useState(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [snapshot, visit] = await Promise.all([visitationRepository.getSnapshot(), visitationRepository.getAuthorized(id)]);
      setState({ status: "ready", snapshot, visit });
      const recipient = visit.recipients.find((candidate) => candidate.accountId === snapshot.actor.id);
      setReason(recipient?.reason ?? "");
      if (recipient && recipient.lastViewedRevision < visit.revision) void visitationRepository.markViewed(id, visit.revision);
    } catch (error) {
      const unavailable = error instanceof VisitRepositoryError && (error.code === "not-found" || error.code === "forbidden");
      setState({ status: "error", message: unavailable ? c.notFoundDetail : c.loadFailed });
    }
  }, [c.loadFailed, c.notFoundDetail, id]);

  useEffect(() => bindVisitationSession(account), [account]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (input: VisitResponseInput) => {
    if (state.status !== "ready" || mutation.status === "pending") return;
    const prior = state;
    const optimistic: VisitRecord = {
      ...state.visit,
      recipients: state.visit.recipients.map((recipient) => recipient.accountId === state.snapshot.actor.id
        ? { ...recipient, response: input.response, reason: input.response === "declined" ? input.reason : null }
        : recipient),
    };
    setState({ ...state, visit: optimistic });
    setMutation({ status: "pending" });
    try {
      const visit = await visitationRepository.respond(id, input, prior.visit.revision);
      setState({ ...prior, visit });
      setMutation({ status: "success", message: c.responseSaved });
      if (input.response === "accepted") setReason("");
    } catch (error) {
      setState(prior);
      setMutation({ status: error instanceof VisitRepositoryError && error.code === "conflict" ? "conflict" : "error", message: error instanceof VisitRepositoryError && error.code === "forbidden" ? c.forbidden : c.saveFailed });
    }
  };

  const runPastorAction = async (action: ConfirmAction) => {
    if (state.status !== "ready" || mutation.status === "pending") return;
    setMutation({ status: "pending" });
    setConfirming(null);
    try {
      const visit = action === "complete"
        ? await visitationRepository.complete(id, state.visit.revision)
        : action === "cancel"
          ? await visitationRepository.cancel(id, state.visit.revision)
          : await visitationRepository.archive(id, state.visit.revision);
      setState({ ...state, visit });
      setMutation({ status: "success" });
    } catch (error) {
      setMutation({ status: error instanceof VisitRepositoryError && error.code === "conflict" ? "conflict" : "error", message: c.saveFailed });
    }
  };

  const openCalendarSnapshot = async () => {
    if (state.status !== "ready") return;
    setCalendarError(false);
    try {
      await calendarSnapshotExporter.openSnapshot(state.visit, locale);
      setCalendarConfirming(false);
    } catch {
      setCalendarError(true);
    }
  };

  const body = (() => {
    if (state.status === "loading") return <ScreenState icon="calendar-outline" loading title={c.loadingDetail} />;
    if (state.status === "error") return <ScreenState actionLabel={c.retry} detail={state.message} icon="lock-closed-outline" onAction={() => void load()} title={c.notFound} />;

    const { snapshot, visit } = state;
    const recipient = visit.recipients.find((candidate) => candidate.accountId === snapshot.actor.id);
    const unseen = Boolean(recipient && visit.revision > 1 && recipient.lastViewedRevision < visit.revision);
    const plannerOwnsVisit = canManageVisit(snapshot.actor, visit);
    const canRespond = canRespondToVisit(snapshot.actor, visit);
    const terminal = visit.status !== "open";
    const status = visit.archivedAt ? "archived" : visit.status;

    return (
      <>
        <View style={styles.headingBlock}>
          <Text selectable style={styles.eyebrow}>{plannerOwnsVisit ? c.plannedByMe : `${c.plannedBy}: ${visit.plannerName}`}</Text>
          <Text accessibilityRole="header" selectable style={styles.title}>{visit.memberName}</Text>
          <StatusPill label={c[status]} tone={status === "completed" ? "success" : status === "cancelled" ? "danger" : status === "open" ? "accent" : "neutral"} />
        </View>

        {unseen ? (
          <View accessibilityLiveRegion="polite" style={styles.updatedBanner}>
            <Ionicons accessibilityElementsHidden color={visitColors.accent} name="alert-circle-outline" size={22} />
            <View style={styles.flex}>
              <Text selectable style={styles.updatedTitle}>{c.updated}</Text>
              <Text selectable style={styles.updatedDetail}>{c.updatedDetail}</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.detailColumns, desktop && styles.detailColumnsDesktop]}><View style={[styles.detailColumn, desktop && styles.detailColumnDesktop]}>
        <View style={styles.dataCard}>
          <DataRow icon="calendar-outline" label={c.time}>{formatFixedPdt(visit.scheduledAt, locale)}</DataRow>
          <DataRow icon="location-outline" label={c.location}>
            <Pressable accessibilityHint={c.openMaps} accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.location)}`)}>
              <Text selectable style={styles.linkText}>{visit.location}</Text>
            </Pressable>
          </DataRow>
          <DataRow icon="call-outline" label={c.phone} last>{visit.memberPhone ? formatPhoneNumber(visit.memberPhone) : "—"}</DataRow>
        </View>

        <SectionCard title={c.notes}>
          <Text selectable style={[styles.bodyText, !visit.notes && styles.muted]}>{visit.notes || c.noNotes}</Text>
        </SectionCard>

        <ActionButton icon="calendar-outline" label={c.addCalendar} onPress={() => { setCalendarError(false); setCalendarConfirming(true); }} tone="secondary" />

        {calendarConfirming ? (
          <SectionCard title={c.calendarSnapshot}>
            <Text selectable style={styles.bodyText}>{c.calendarSnapshotDetail}</Text>
            <View style={styles.confirmRow}>
              <View style={styles.flex}><ActionButton label={c.keepVisit} onPress={() => setCalendarConfirming(false)} tone="plain" /></View>
              <View style={styles.flex}><ActionButton icon="open-outline" label={c.openCalendar} onPress={() => void openCalendarSnapshot()} /></View>
            </View>
            {calendarError ? <Text accessibilityLiveRegion="assertive" selectable style={styles.errorText}>{c.calendarFailed}</Text> : null}
          </SectionCard>
        ) : null}

        </View><View style={[styles.detailColumn, desktop && styles.detailColumnDesktop]}>
        <SectionCard title={c.participants}>
          <View style={styles.recipientList}>
            <View style={styles.recipientRow}>
              <ProfileAvatar name={visit.plannerName} size={40} />
              <View style={styles.flex}>
                <Text selectable style={styles.recipientName}>{visit.plannerName}</Text>
              </View>
              <StatusPill icon="person-outline" label={c.organizer} tone="accent" />
            </View>
            {visit.recipients.map((candidate) => (
              <View key={candidate.participantPersonId} style={styles.recipientRow}>
                <ProfileAvatar name={candidate.participantName} size={40} source={candidate.photo} />
                <View style={styles.flex}>
                  <Text selectable style={styles.recipientName}>{candidate.participantName}</Text>
                  <Text selectable style={styles.reasonText}>{c[candidate.leadershipMinistry]}</Text>
                  {candidate.reason ? <Text selectable style={styles.reasonText}>{candidate.reason}</Text> : null}
                </View>
                {candidate.accountId ? <StatusPill
                  icon={candidate.response === "accepted" ? "checkmark" : candidate.response === "declined" ? "close" : "time-outline"}
                  label={c[candidate.response]}
                  tone={candidate.response === "accepted" ? "success" : candidate.response === "declined" ? "danger" : "neutral"}
                /> : <StatusPill label={c.noAccount} />}
              </View>
            ))}
          </View>
        </SectionCard>

        {canRespond && recipient ? (
          <SectionCard detail={c.optional} title={c.yourResponse}>
            <View style={styles.responseRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: recipient.response === "accepted" }}
                disabled={mutation.status === "pending"}
                onPress={() => void respond({ response: "accepted", reason: null })}
                style={({ pressed }) => [styles.responseButton, recipient.response === "accepted" && styles.responseAccepted, pressed && styles.pressed]}
              >
                <Ionicons accessibilityElementsHidden color={recipient.response === "accepted" ? visitColors.white : visitColors.success} name="checkmark" size={20} />
                <Text style={[styles.responseLabel, recipient.response === "accepted" && styles.responseLabelSelected]}>{c.accept}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: recipient.response === "declined" }}
                disabled={mutation.status === "pending"}
                onPress={() => void respond({ response: "declined", reason: reason || null })}
                style={({ pressed }) => [styles.responseButton, recipient.response === "declined" && styles.responseDeclined, pressed && styles.pressed]}
              >
                <Ionicons accessibilityElementsHidden color={recipient.response === "declined" ? visitColors.white : visitColors.danger} name="close" size={20} />
                <Text style={[styles.responseLabel, recipient.response === "declined" && styles.responseLabelSelected]}>{c.decline}</Text>
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel={c.declineReason}
              editable={mutation.status !== "pending"}
              maxLength={1000}
              multiline
              onChangeText={setReason}
              placeholder={c.declineReason}
              placeholderTextColor={visitColors.secondaryText}
              style={styles.textArea}
              value={reason}
            />
          </SectionCard>
        ) : null}

        {plannerOwnsVisit && !visit.archivedAt ? (
          <SectionCard title={c.manage}>
            <View style={styles.manageActions}>
            {confirming ? (
              <View accessibilityLiveRegion="polite" accessibilityViewIsModal style={styles.confirmationPopover}>
                <Text accessibilityRole="header" selectable style={styles.confirmationTitle}>
                  {confirming === "complete" ? c.complete : confirming === "cancel" ? c.cancel : c.archiveVisit}
                </Text>
                <Text selectable style={styles.bodyText}>{confirming === "complete" ? c.confirmComplete : confirming === "cancel" ? c.confirmCancel : c.confirmArchive}</Text>
                <View style={styles.confirmRow}>
                  <View style={styles.flex}><ActionButton label={c.keepVisit} onPress={() => setConfirming(null)} tone="plain" /></View>
                  <View style={styles.flex}><ActionButton label={c.confirmAction} onPress={() => void runPastorAction(confirming)} tone={confirming === "cancel" ? "danger" : "primary"} /></View>
                </View>
              </View>
            ) : !terminal ? (
              <>
                <ActionButton icon="create-outline" label={c.edit} onPress={() => router.push(`/visitation/${id}/edit` as Href)} tone="secondary" />
                <ActionButton icon="checkmark-circle-outline" label={c.complete} onPress={() => setConfirming("complete")} tone="secondary" />
                <ActionButton icon="close-circle-outline" label={c.cancel} onPress={() => setConfirming("cancel")} tone="danger" />
              </>
            ) : (
              <ActionButton icon="archive-outline" label={c.archiveVisit} onPress={() => setConfirming("archive")} tone="secondary" />
            )}
            </View>
          </SectionCard>
        ) : null}

        </View></View>
        {mutation.status === "pending" ? <Text accessibilityLiveRegion="polite" style={styles.statusMessage}>{c.saving}</Text> : null}
        {mutation.status === "success" && mutation.message ? <Text accessibilityLiveRegion="polite" style={styles.successMessage}>{mutation.message}</Text> : null}
        {mutation.status === "conflict" ? (
          <View accessibilityLiveRegion="assertive" style={styles.errorBanner}>
            <Text selectable style={styles.errorTitle}>{c.conflictTitle}</Text>
            <Text selectable style={styles.errorText}>{c.conflictDetail}</Text>
            <ActionButton label={c.refresh} onPress={() => { setMutation({ status: "idle" }); void load(); }} tone="secondary" />
          </View>
        ) : null}
        {mutation.status === "error" ? <Text accessibilityLiveRegion="assertive" selectable style={styles.errorText}>{mutation.message ?? c.saveFailed}</Text> : null}
      </>
    );
  })();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, desktop && styles.desktopContent]} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <Pressable accessibilityLabel={c.back} accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/visitation" as Href)} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons accessibilityElementsHidden color={visitColors.text} name="chevron-back" size={24} />
          <Text style={styles.backLabel}>{c.back}</Text>
        </Pressable>
        {body}
      </ScrollView>
      <WebTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  detailColumns: { gap: 14 },
  detailColumnsDesktop: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  detailColumn: { gap: 14 },
  detailColumnDesktop: { flex: 1, minWidth: 0 },
  desktopContent: { maxWidth: 1120, paddingHorizontal: 32, paddingTop: 28 },
  screen: { backgroundColor: visitColors.background, flex: 1 },
  content: { alignSelf: "center", gap: 14, maxWidth: 680, paddingBottom: 104, paddingHorizontal: 18, paddingTop: 16, width: "100%" },
  backButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, minHeight: 44, paddingRight: 10 },
  backLabel: { color: visitColors.text, fontSize: 16, fontWeight: "600" },
  headingBlock: { gap: 8 },
  eyebrow: { color: visitColors.secondaryText, fontSize: 14, lineHeight: 20 },
  title: { color: visitColors.text, fontSize: 34, fontWeight: "800", letterSpacing: -0.8, lineHeight: 41 },
  updatedBanner: { alignItems: "flex-start", backgroundColor: visitColors.accentSoft, borderCurve: "continuous", borderRadius: 16, flexDirection: "row", gap: 11, padding: 15 },
  updatedTitle: { color: visitColors.text, fontSize: 15, fontWeight: "700" },
  updatedDetail: { color: visitColors.secondaryText, fontSize: 14, lineHeight: 20, paddingTop: 2 },
  dataCard: { backgroundColor: visitColors.surface, borderColor: visitColors.line, borderCurve: "continuous", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  linkText: { color: visitColors.accent, fontSize: 16, fontWeight: "600", lineHeight: 22, textDecorationLine: "underline" },
  bodyText: { color: visitColors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: visitColors.secondaryText },
  recipientList: { gap: 13 },
  recipientRow: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  recipientName: { color: visitColors.text, fontSize: 16, fontWeight: "600", lineHeight: 22 },
  reasonText: { color: visitColors.secondaryText, fontSize: 13, lineHeight: 18, paddingTop: 2 },
  responseRow: { flexDirection: "row", gap: 9 },
  responseButton: { alignItems: "center", borderColor: visitColors.line, borderCurve: "continuous", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 48, padding: 10 },
  responseAccepted: { backgroundColor: visitColors.success, borderColor: visitColors.success },
  responseDeclined: { backgroundColor: visitColors.danger, borderColor: visitColors.danger },
  responseLabel: { color: visitColors.text, fontSize: 15, fontWeight: "700" },
  responseLabelSelected: { color: visitColors.white },
  textArea: { backgroundColor: visitColors.background, borderColor: visitColors.line, borderCurve: "continuous", borderRadius: 13, borderWidth: 1, color: visitColors.text, fontSize: 16, minHeight: 94, padding: 13, textAlignVertical: "top" },
  manageActions: { gap: 10 },
  confirmationPopover: { backgroundColor: visitColors.surfaceMuted, borderCurve: "continuous", borderRadius: 14, elevation: 8, gap: 10, padding: 14, shadowColor: "#000", shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.16, shadowRadius: 12 },
  confirmationTitle: { color: visitColors.text, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  confirmRow: { flexDirection: "row", gap: 9 },
  statusMessage: { color: visitColors.secondaryText, fontSize: 14, textAlign: "center" },
  successMessage: { color: visitColors.success, fontSize: 14, fontWeight: "600", textAlign: "center" },
  errorBanner: { backgroundColor: visitColors.dangerSoft, borderCurve: "continuous", borderRadius: 16, gap: 8, padding: 15 },
  errorTitle: { color: visitColors.danger, fontSize: 16, fontWeight: "700" },
  errorText: { color: visitColors.danger, fontSize: 14, lineHeight: 20 },
  flex: { flex: 1 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
});
