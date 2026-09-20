import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { NativeDateTimeField } from "@/features/forms/NativeDateTimeField";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { fixedPdtToIso, isoToFixedPdt } from "@/lib/dates";
import { canCreateVisit } from "@/lib/permissions";

import { visitationCopy } from "./copy";
import { bindVisitationSession, visitationRepository } from "./repository";
import type { RepositorySnapshot, VisitRecord } from "./types";
import { VisitRepositoryError } from "./types";
import {
    ActionButton,
    ScreenState,
    SectionCard,
    visitColors,
} from "./VisitationUi";

type FormLoadState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
          status: "ready";
          snapshot: RepositorySnapshot;
          visit: VisitRecord | null;
      };

type FormValues = {
    personId: string;
    date: string;
    time: string;
    location: string;
    notes: string;
    participantPersonIds: string[];
};

const newSubmissionId = () =>
    `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const choicePageSize = 5;

const initialValues = (personId = ""): FormValues => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { date } = isoToFixedPdt(tomorrow);
    return {
        personId,
        date,
        time: "18:00",
        location: "",
        notes: "",
        participantPersonIds: [],
    };
};

export function VisitFormScreen({
    visitId = null,
    initialPersonId = "",
}: {
    visitId?: string | null;
    initialPersonId?: string;
}) {
    const { locale } = useLocalization();
    const session = useSession();
    const account = session.status === "ready" ? session.account : null;
    const c = visitationCopy(locale);
    const router = useRouter();
    const desktop = useDesktopLayout();
    const editing = Boolean(visitId);
    const [state, setState] = useState<FormLoadState>({ status: "loading" });
    const [values, setValues] = useState<FormValues>(() =>
        initialValues(initialPersonId),
    );
    const [query, setQuery] = useState("");
    const [visiblePeopleCount, setVisiblePeopleCount] = useState(choicePageSize);
    const [visibleParticipantCount, setVisibleParticipantCount] =
        useState(choicePageSize);
    const [submissionId] = useState(newSubmissionId);
    const [mutation, setMutation] = useState<{
        status: "idle" | "pending" | "error" | "conflict";
        message?: string;
    }>({ status: "idle" });
    const [validation, setValidation] = useState<string | null>(null);

    const load = useCallback(async () => {
        setState({ status: "loading" });
        try {
            const snapshot = await visitationRepository.getSnapshot();
            const visit = visitId
                ? await visitationRepository.getAuthorized(visitId)
                : null;
            if (
                !canCreateVisit(snapshot.actor) ||
                (visit && visit.plannerId !== snapshot.actor.id)
            ) {
                throw new VisitRepositoryError(
                    "forbidden",
                    "Pastor or deacon access required.",
                );
            }
            if (visit && (visit.status !== "open" || visit.archivedAt)) {
                throw new VisitRepositoryError(
                    "terminal",
                    "This visit is read-only.",
                );
            }
            setState({ status: "ready", snapshot, visit });
            if (visit) {
                const { date, time } = isoToFixedPdt(visit.scheduledAt);
                setValues({
                    personId: visit.personId,
                    date,
                    time,
                    location: visit.location,
                    notes: visit.notes,
                    participantPersonIds: visit.recipients.map(
                        (recipient) => recipient.participantPersonId,
                    ),
                });
            } else if (initialPersonId) {
                const person = snapshot.people.find(
                    (candidate) => candidate.id === initialPersonId,
                );
                if (person) {
                    const groupDeacons = snapshot.eligibleParticipants
                        .filter(
                            (participant) =>
                                participant.leadershipMinistry === "deacon" &&
                                person.responsibilityGroupId &&
                                participant.responsibilityGroupId ===
                                    person.responsibilityGroupId,
                        )
                        .map((participant) => participant.personId);
                    setValues((current) => ({
                        ...current,
                        personId: person.id,
                        location: person.address,
                        participantPersonIds: groupDeacons,
                    }));
                }
            }
        } catch (error) {
            setState({
                status: "error",
                message:
                    error instanceof VisitRepositoryError &&
                    error.code === "forbidden"
                        ? c.forbidden
                        : c.notFoundDetail,
            });
        }
    }, [c.forbidden, c.notFoundDetail, initialPersonId, visitId]);

    useEffect(() => bindVisitationSession(account), [account]);

    useEffect(() => {
        void load();
    }, [load]);

    const filteredPeople = useMemo(() => {
        if (state.status !== "ready") return [];
        const needle = query.trim().toLocaleLowerCase(locale);
        return state.snapshot.people.filter(
            (person) =>
                !needle ||
                person.name.toLocaleLowerCase(locale).includes(needle),
        );
    }, [locale, query, state]);
    const visiblePeople = filteredPeople.slice(0, visiblePeopleCount);
    const visibleParticipants =
        state.status === "ready"
            ? state.snapshot.eligibleParticipants.slice(
                  0,
                  visibleParticipantCount,
              )
            : [];
    const reachedEnd = (event: {
        nativeEvent: {
            contentOffset: { y: number };
            contentSize: { height: number };
            layoutMeasurement: { height: number };
        };
    }) => {
        const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;
        return (
            contentOffset.y + layoutMeasurement.height >=
            contentSize.height - 24
        );
    };

    const choosePerson = (personId: string) => {
        if (state.status !== "ready" || editing) return;
        const person = state.snapshot.people.find(
            (candidate) => candidate.id === personId,
        );
        if (!person) return;
        const groupDeacons = state.snapshot.eligibleParticipants
            .filter(
                (participant) =>
                    participant.leadershipMinistry === "deacon" &&
                    person.responsibilityGroupId &&
                    participant.responsibilityGroupId ===
                        person.responsibilityGroupId,
            )
            .map((participant) => participant.personId);
        setValues((current) => ({
            ...current,
            personId,
            location: person.address,
            participantPersonIds: groupDeacons,
        }));
        setQuery("");
        setValidation(null);
    };

    const toggleParticipant = (personId: string) => {
        if (editing) return;
        setValues((current) => {
            const selected = current.participantPersonIds.includes(personId);
            return {
                ...current,
                participantPersonIds: selected
                    ? current.participantPersonIds.filter(
                          (id) => id !== personId,
                      )
                    : [...current.participantPersonIds, personId],
            };
        });
    };

    const save = async () => {
        if (state.status !== "ready" || mutation.status === "pending") return;
        setValidation(null);
        let scheduledAt: string;
        try {
            if (!values.personId) throw new Error(c.validationPerson);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date))
                throw new Error(c.validationDate);
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time))
                throw new Error(c.validationTime);
            scheduledAt = fixedPdtToIso(values.date, values.time);
            if (!values.location.trim()) throw new Error(c.validationLocation);
        } catch (error) {
            setValidation(
                error instanceof Error ? error.message : c.saveFailed,
            );
            return;
        }

        setMutation({ status: "pending" });
        try {
            const visit =
                editing && state.visit
                    ? await visitationRepository.update(
                          state.visit.id,
                          {
                              scheduledAt,
                              location: values.location,
                              notes: values.notes,
                          },
                          state.visit.revision,
                      )
                    : await visitationRepository.create({
                          personId: values.personId,
                          scheduledAt,
                          location: values.location,
                          notes: values.notes,
                          participantPersonIds: values.participantPersonIds,
                          submissionId,
                      });
            router.replace(`/visitation/${visit.id}` as Href);
        } catch (error) {
            setMutation({
                status:
                    error instanceof VisitRepositoryError &&
                    error.code === "conflict"
                        ? "conflict"
                        : "error",
                message:
                    error instanceof VisitRepositoryError &&
                    error.code === "forbidden"
                        ? c.forbidden
                        : error instanceof Error
                          ? error.message
                          : c.saveFailed,
            });
        }
    };

    const body = (() => {
        if (state.status === "loading")
            return (
                <ScreenState
                    icon="calendar-outline"
                    loading
                    title={c.loadingDetail}
                />
            );
        if (state.status === "error")
            return (
                <ScreenState
                    actionLabel={c.back}
                    detail={state.message}
                    icon="lock-closed-outline"
                    onAction={() => router.replace("/visitation" as Href)}
                    title={c.notFound}
                />
            );

        const selectedPerson = state.snapshot.people.find(
            (person) => person.id === values.personId,
        );
        const personField = (
            <SectionCard title={c.person}>
                {editing && selectedPerson ? (
                    <View style={styles.readonlyRow}>
                        <ProfileAvatar
                            name={selectedPerson.name}
                            size={44}
                            source={selectedPerson.photo}
                        />
                        <Text selectable style={styles.readonlyValue}>
                            {selectedPerson.name}
                        </Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.searchField}>
                            <Ionicons
                                accessibilityElementsHidden
                                color={visitColors.secondaryText}
                                name="search-outline"
                                size={20}
                            />
                            <TextInput
                                accessibilityLabel={c.choosePerson}
                                autoCapitalize="words"
                                onChangeText={(value) => {
                                    setQuery(value);
                                    setVisiblePeopleCount(choicePageSize);
                                }}
                                placeholder={c.choosePerson}
                                placeholderTextColor={visitColors.secondaryText}
                                style={styles.searchInput}
                                value={query}
                            />
                        </View>
                        <ScrollView
                            contentContainerStyle={styles.choiceList}
                            nestedScrollEnabled
                            onScroll={(event) => {
                                if (reachedEnd(event))
                                    setVisiblePeopleCount((count) =>
                                        Math.min(
                                            count + choicePageSize,
                                            filteredPeople.length,
                                        ),
                                    );
                            }}
                            scrollEventThrottle={100}
                            style={styles.choiceScroll}
                        >
                            {visiblePeople.map((person) => {
                                const selected = person.id === values.personId;
                                return (
                                    <Pressable
                                        accessibilityRole="radio"
                                        accessibilityState={{
                                            checked: selected,
                                        }}
                                        key={person.id}
                                        onPress={() => choosePerson(person.id)}
                                        style={({ pressed }) => [
                                            styles.choiceRow,
                                            selected &&
                                                styles.choiceRowSelected,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <ProfileAvatar
                                            name={person.name}
                                            size={44}
                                            source={person.photo}
                                        />
                                        <View style={styles.flex}>
                                            <Text
                                                selectable
                                                style={styles.choiceTitle}
                                            >
                                                {person.name}
                                            </Text>
                                            <Text
                                                numberOfLines={2}
                                                selectable
                                                style={styles.choiceDetail}
                                            >
                                                {person.address}
                                            </Text>
                                        </View>
                                        {selected ? (
                                            <Ionicons
                                                accessibilityElementsHidden
                                                color={visitColors.accent}
                                                name="checkmark-circle"
                                                size={23}
                                            />
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                            {filteredPeople.length === 0 ? (
                                <Text selectable style={styles.emptyText}>
                                    {c.noResults}
                                </Text>
                            ) : null}
                        </ScrollView>
                    </>
                )}
            </SectionCard>
        );
        const timeField = (
            <SectionCard detail={c.fixedPdt} title={c.time}>
                <View style={desktop ? styles.fieldRow : styles.fieldStack}>
                    <View style={desktop ? styles.flex : styles.fullWidthField}>
                        <Text style={styles.fieldLabel}>{c.date}</Text>
                        <NativeDateTimeField
                            accessibilityLabel={c.date}
                            accentColor={visitColors.accent}
                            backgroundColor={visitColors.background}
                            borderColor={visitColors.line}
                            disabled={mutation.status === "pending"}
                            mode="date"
                            onChange={(date) =>
                                setValues((current) => ({ ...current, date }))
                            }
                            textColor={visitColors.text}
                            value={values.date}
                        />
                    </View>
                    <View
                        style={
                            desktop ? styles.timeField : styles.fullWidthField
                        }
                    >
                        <Text style={styles.fieldLabel}>{c.time}</Text>
                        <NativeDateTimeField
                            accessibilityLabel={c.time}
                            accentColor={visitColors.accent}
                            backgroundColor={visitColors.background}
                            borderColor={visitColors.line}
                            disabled={mutation.status === "pending"}
                            mode="time"
                            onChange={(time) =>
                                setValues((current) => ({ ...current, time }))
                            }
                            textColor={visitColors.text}
                            value={values.time}
                        />
                    </View>
                </View>
            </SectionCard>
        );
        const participantField = !editing ? (
            <SectionCard detail={c.chooseParticipants} title={c.participants}>
                <ScrollView
                    contentContainerStyle={styles.choiceList}
                    nestedScrollEnabled
                    onScroll={(event) => {
                        if (reachedEnd(event))
                            setVisibleParticipantCount((count) =>
                                Math.min(
                                    count + choicePageSize,
                                    state.snapshot.eligibleParticipants.length,
                                ),
                            );
                    }}
                    scrollEventThrottle={100}
                    style={styles.choiceScroll}
                >
                    {visibleParticipants.map((participant) => {
                        const selected = values.participantPersonIds.includes(
                            participant.personId,
                        );
                        const groupMatch = Boolean(
                            participant.leadershipMinistry === "deacon" &&
                            selectedPerson?.responsibilityGroupId &&
                            selectedPerson.responsibilityGroupId ===
                                participant.responsibilityGroupId,
                        );
                        return (
                            <Pressable
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: selected }}
                                key={participant.personId}
                                onPress={() =>
                                    toggleParticipant(participant.personId)
                                }
                                style={({ pressed }) => [
                                    styles.choiceRow,
                                    selected && styles.choiceRowSelected,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Ionicons
                                    accessibilityElementsHidden
                                    color={
                                        selected
                                            ? visitColors.accent
                                            : visitColors.secondaryText
                                    }
                                    name={
                                        selected ? "checkbox" : "square-outline"
                                    }
                                    size={23}
                                />
                                <ProfileAvatar
                                    name={participant.name}
                                    size={44}
                                    source={participant.photo}
                                />
                                <View style={styles.flex}>
                                    <Text selectable style={styles.choiceTitle}>
                                        {participant.name}
                                    </Text>
                                    <Text
                                        selectable
                                        style={styles.choiceDetail}
                                    >
                                        {c[participant.leadershipMinistry]}
                                    </Text>
                                    {groupMatch ? (
                                        <Text
                                            selectable
                                            style={styles.groupMatch}
                                        >
                                            {c.groupDeacon}
                                        </Text>
                                    ) : null}
                                </View>
                            </Pressable>
                        );
                    })}
                    {state.snapshot.eligibleParticipants.length === 0 ? (
                        <Text selectable style={styles.emptyText}>
                            {c.noParticipants}
                        </Text>
                    ) : null}
                </ScrollView>
            </SectionCard>
        ) : (
            <SectionCard title={c.participants}>
                {state.visit?.recipients.map((recipient) => (
                    <Text
                        key={recipient.participantPersonId}
                        selectable
                        style={styles.readonlyValue}
                    >
                        {recipient.participantName} ·{" "}
                        {c[recipient.leadershipMinistry]}
                    </Text>
                ))}
            </SectionCard>
        );
        const locationField = (
            <SectionCard>
                <Text style={styles.fieldLabel}>{c.location}</Text>
                <TextInput
                    accessibilityLabel={c.location}
                    editable={mutation.status !== "pending"}
                    maxLength={1000}
                    onChangeText={(location) =>
                        setValues((current) => ({ ...current, location }))
                    }
                    placeholder={c.location}
                    placeholderTextColor={visitColors.secondaryText}
                    style={styles.input}
                    value={values.location}
                />
                <Text style={styles.fieldLabel}>
                    {c.notes} ({c.optional})
                </Text>
                <TextInput
                    accessibilityLabel={`${c.notes}, ${c.optional}`}
                    editable={mutation.status !== "pending"}
                    maxLength={5000}
                    multiline
                    onChangeText={(notes) =>
                        setValues((current) => ({ ...current, notes }))
                    }
                    placeholder={c.notes}
                    placeholderTextColor={visitColors.secondaryText}
                    style={styles.textArea}
                    value={values.notes}
                />
            </SectionCard>
        );
        return (
            <>
                <Text
                    accessibilityRole="header"
                    selectable
                    style={styles.title}
                >
                    {editing ? c.editVisit : c.planVisit}
                </Text>

                {desktop ? (
                    <View style={styles.formFieldsDesktop}>
                        <View style={styles.formColumn}>
                            {personField}
                            {participantField}
                        </View>
                        <View style={styles.formColumn}>
                            {timeField}
                            {locationField}
                        </View>
                    </View>
                ) : (
                    <View style={styles.formFields}>
                        {personField}
                        {timeField}
                        {participantField}
                        {locationField}
                    </View>
                )}

                {validation ? (
                    <Text
                        accessibilityLiveRegion="assertive"
                        selectable
                        style={styles.errorText}
                    >
                        {validation}
                    </Text>
                ) : null}
                {mutation.status === "conflict" ? (
                    <View
                        accessibilityLiveRegion="assertive"
                        style={styles.errorBanner}
                    >
                        <Text selectable style={styles.errorTitle}>
                            {c.conflictTitle}
                        </Text>
                        <Text selectable style={styles.errorText}>
                            {c.conflictDetail}
                        </Text>
                        <ActionButton
                            label={c.refresh}
                            onPress={() => {
                                setMutation({ status: "idle" });
                                void load();
                            }}
                            tone="secondary"
                        />
                    </View>
                ) : null}
                {mutation.status === "error" ? (
                    <Text
                        accessibilityLiveRegion="assertive"
                        selectable
                        style={styles.errorText}
                    >
                        {mutation.message ?? c.saveFailed}
                    </Text>
                ) : null}
                <ActionButton
                    disabled={mutation.status === "pending"}
                    icon="checkmark"
                    label={
                        mutation.status === "pending"
                            ? c.saving
                            : editing
                              ? c.save
                              : c.create
                    }
                    onPress={() => void save()}
                />
            </>
        );
    })();

    return (
        <View style={styles.screen}>
            <ScrollView
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={[
                    styles.content,
                    desktop && styles.desktopContent,
                ]}
                contentInsetAdjustmentBehavior="automatic"
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
            >
                <Pressable
                    accessibilityLabel={c.back}
                    accessibilityRole="button"
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace("/visitation" as Href)
                    }
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons
                        accessibilityElementsHidden
                        color={visitColors.text}
                        name="chevron-back"
                        size={24}
                    />
                    <Text style={styles.backLabel}>{c.back}</Text>
                </Pressable>
                {body}
            </ScrollView>
            <WebTabBar />
        </View>
    );
}

const styles = StyleSheet.create({
    formFields: { gap: 14 },
    formFieldsDesktop: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 24,
    },
    formColumn: { flex: 1, minWidth: 0, gap: 14 },
    desktopContent: { maxWidth: 1120, paddingHorizontal: 32, paddingTop: 28 },
    screen: { backgroundColor: visitColors.background, flex: 1 },
    content: {
        alignSelf: "center",
        gap: 14,
        maxWidth: 680,
        paddingBottom: 104,
        paddingHorizontal: 18,
        paddingTop: 16,
        width: "100%",
    },
    backButton: {
        alignItems: "center",
        alignSelf: "flex-start",
        flexDirection: "row",
        gap: 2,
        minHeight: 44,
        paddingRight: 10,
    },
    backLabel: { color: visitColors.text, fontSize: 16, fontWeight: "600" },
    title: {
        color: visitColors.text,
        fontSize: 34,
        fontWeight: "800",
        letterSpacing: -0.8,
        lineHeight: 41,
    },
    readonlyRow: { alignItems: "center", flexDirection: "row", gap: 10 },
    readonlyValue: {
        color: visitColors.text,
        fontSize: 16,
        fontWeight: "600",
        lineHeight: 23,
    },
    searchField: {
        alignItems: "center",
        backgroundColor: visitColors.surfaceMuted,
        borderCurve: "continuous",
        borderRadius: 14,
        flexDirection: "row",
        gap: 10,
        minHeight: 46,
        paddingHorizontal: 14,
    },
    searchInput: {
        color: visitColors.text,
        flex: 1,
        fontSize: 16,
        paddingVertical: 10,
    },
    choiceScroll: { maxHeight: 310 },
    choiceList: { gap: 8 },
    choiceRow: {
        alignItems: "center",
        backgroundColor: visitColors.background,
        borderColor: visitColors.line,
        borderCurve: "continuous",
        borderRadius: 13,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        gap: 10,
        minHeight: 54,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    choiceRowSelected: {
        backgroundColor: visitColors.accentSoft,
        borderColor: visitColors.accent,
    },
    choiceTitle: {
        color: visitColors.text,
        fontSize: 16,
        fontWeight: "600",
        lineHeight: 22,
    },
    choiceDetail: {
        color: visitColors.secondaryText,
        fontSize: 13,
        lineHeight: 18,
        paddingTop: 2,
    },
    groupMatch: {
        color: visitColors.accent,
        fontSize: 12,
        fontWeight: "700",
        paddingTop: 2,
    },
    fieldRow: { flexDirection: "row", gap: 10 },
    fieldStack: { gap: 12, minWidth: 0 },
    fullWidthField: { minWidth: 0 },
    timeField: { width: 120 },
    fieldLabel: {
        color: visitColors.text,
        fontSize: 14,
        fontWeight: "600",
        paddingBottom: 6,
    },
    input: {
        backgroundColor: visitColors.background,
        borderColor: visitColors.line,
        borderCurve: "continuous",
        borderRadius: 12,
        borderWidth: 1,
        color: visitColors.text,
        fontSize: 16,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 11,
    },
    textArea: {
        backgroundColor: visitColors.background,
        borderColor: visitColors.line,
        borderCurve: "continuous",
        borderRadius: 12,
        borderWidth: 1,
        color: visitColors.text,
        fontSize: 16,
        minHeight: 110,
        padding: 12,
        textAlignVertical: "top",
    },
    emptyText: {
        color: visitColors.secondaryText,
        fontSize: 14,
        padding: 12,
        textAlign: "center",
    },
    errorBanner: {
        backgroundColor: visitColors.dangerSoft,
        borderCurve: "continuous",
        borderRadius: 16,
        gap: 8,
        padding: 15,
    },
    errorTitle: { color: visitColors.danger, fontSize: 16, fontWeight: "700" },
    errorText: { color: visitColors.danger, fontSize: 14, lineHeight: 20 },
    flex: { flex: 1 },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
});
