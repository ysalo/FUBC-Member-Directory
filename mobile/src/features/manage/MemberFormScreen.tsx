import { Alert } from "@/features/platform/alert";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { Text, TextInput } from "@/features/accessibility/app-text";
import * as ImagePicker from "expo-image-picker";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { NativeDateTimeField } from "@/features/forms/NativeDateTimeField";
import { acceptsDateFieldValue, localDateValue } from "@/features/forms/date-field";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { getFamilyCopy } from "@/features/family/family-copy";
import { useSession } from "@/features/session/SessionProvider";
import { canManageAccounts, canManageDirectory } from "@/lib/permissions";
import { formatMemberName } from "@/lib/member-name";
import { formatPhoneNumber } from "@/lib/phone";
import { managementRepository } from "./management-repository";
import { MemberAvatar } from "./MemberAvatar";
import type { ManagedMember, ManagedMinistry } from "./model";
import { managedAccountHref } from "./route-params";
import { createPhotoRenditions } from "./photo-thumbnail";
import { useUnsavedChanges } from "./use-unsaved-changes";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
type PhotoMimeType = "image/jpeg" | "image/png" | "image/webp";
type PendingPhoto = {
    uri: string;
    bytes: ArrayBuffer;
    thumbnail: ArrayBuffer;
    mimeType: PhotoMimeType;
};

export function MemberFormScreen() {
    const desktop = useDesktopLayout();
    const { memberId, accountId, familyReturn } = useLocalSearchParams<{
        memberId?: string;
        accountId?: string;
        familyReturn?: string;
    }>();
    const editing = Boolean(memberId);
    const router = useRouter();
    const { palette } = useAppearance();
    const { locale } = useLocalization();
    const session = useSession();
    const fullManagement = session.status === "ready" && canManageDirectory(session.account);
    const leadershipAllowed = session.status === "ready" && canManageAccounts(session.account);
    const [member, setMember] = useState<ManagedMember | null>(null);
    const [ministries, setMinistries] = useState<ManagedMinistry[]>([]);
    const [familyCandidates, setFamilyCandidates] = useState<ManagedMember[]>([]);
    const [firstName, setFirstName] = useState("");
    const [patronymic, setPatronymic] = useState("");
    const [lastName, setLastName] = useState("");
    const [birthday, setBirthday] = useState("");
    const [membershipJoinedAt, setMembershipJoinedAt] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [ministryIds, setMinistryIds] = useState<string[]>([]);
    const [isOrphan, setIsOrphan] = useState(false);
    const [isWidow, setIsWidow] = useState(false);
    const [gender, setGender] = useState<"male" | "female" | null>(null);
    const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
    const [photoRemoved, setPhotoRemoved] = useState(false);
    const savingRef = useRef(false);
    const [state, setState] = useState<
        "loading" | "ready" | "saving" | "error"
    >(editing ? "loading" : "ready");
    const [error, setError] = useState<string | null>(null);
    const originalName = member ? { firstName: member.first_name ?? splitMemberName(member.name).firstName, lastName: member.last_name ?? splitMemberName(member.name).lastName } : { firstName: "", lastName: "" };
    const dirty = state === "ready" && (JSON.stringify([firstName, patronymic, lastName, birthday, membershipJoinedAt, phone, email, address, [...ministryIds].sort(), isOrphan, isWidow, gender]) !== JSON.stringify([originalName.firstName, member?.patronymic ?? "", originalName.lastName, member?.birthday ?? "", member?.membershipJoinedAt ?? "", formatPhoneNumber(member?.phone), member?.email ?? "", member?.address ?? "", [...(member?.ministryIds ?? [])].sort(), Boolean(member?.isOrphan), Boolean(member?.isWidow), member?.gender ?? null]) || Boolean(pendingPhoto) || photoRemoved);
    const guard = useUnsavedChanges(dirty);
    const leave = () => familyReturn ? router.replace(`/manage/member/${encodeURIComponent(familyReturn)}/family` as never) : accountId ? router.replace(managedAccountHref(accountId) as never) : fullManagement ? router.replace("/manage") : router.replace(`/members/${memberId}` as never);
    useEffect(() => {
        if (!familyReturn) return;
        let alive = true;
        void managementRepository.load().then((result) => { if (alive) setFamilyCandidates(result.members); });
        return () => { alive = false; };
    }, [familyReturn]);
    useEffect(() => {
        let alive = true;
        const selectedMember = memberId
            ? managementRepository.loadMember(memberId)
            : Promise.resolve(null);
        void Promise.all([
            selectedMember,
            managementRepository.listMinistries(),
        ])
            .then(([found, catalog]) => {
                if (!alive) return;
                setMember(found);
                setMinistries(catalog);
                if (found) {
                    const nameParts = { firstName: found.first_name ?? splitMemberName(found.name).firstName, lastName: found.last_name ?? splitMemberName(found.name).lastName };
                    setFirstName(nameParts.firstName);
                    setPatronymic(found.patronymic ?? "");
                    setLastName(nameParts.lastName);
                    setBirthday(found.birthday ?? "");
                    setMembershipJoinedAt(found.membershipJoinedAt ?? "");
                    setPhone(formatPhoneNumber(found.phone));
                    setEmail(found.email ?? "");
                    setAddress(found.address ?? "");
                    setMinistryIds(found.ministryIds ?? []);
                    setIsOrphan(Boolean(found.isOrphan));
                    setIsWidow(Boolean(found.isWidow));
                    setGender(found.gender ?? null);
                }
                setState("ready");
            })
            .catch(() => {
                if (alive) {
                    setError(labels.loadError);
                    setState("error");
                }
            });
        return () => {
            alive = false;
        };
    }, [memberId]);
    const labels = useMemo(
        () =>
            locale === "uk"
                ? {
                      title: editing ? "Редагувати учасника" : "Новий учасник",
                      identity: "Особисті дані",
                      dates: "Дати",
                      contact: "Контактні дані",
                      requiredField: "Обов’язкове поле",
                      firstName: "Ім’я",
                      patronymic: "По батькові (необов’язково)",
                      lastName: "Прізвище",
                      birthday: "День народження",
                      membershipDate: "Дата вступу до церкви",
                      optionalDate: "Необов’язково · залиште порожнім, якщо невідомо",
                      chooseDate: "Оберіть дату",
                      clearDate: "Очистити",
                      invalidMembershipDate: "Вкажіть коректну дату вступу не пізніше сьогоднішньої.",
                      invalidBirthday: "Вкажіть коректну дату народження не пізніше сьогоднішньої.",
                      ministry: "Служіння",
                      care: "Статус опіки",
                      gender: "Стать",
                      male: "Чоловіча",
                      female: "Жіноча",
                      genderRequired: "Оберіть стать учасника: чоловіча або жіноча.",
                      orphan: "Сирота",
                      widow: "Вдова або вдівець",
                      phone: "Телефон",
                      email: "Ел. пошта",
                      address: "Адреса",
                      photo: "Фото",
                      choosePhoto: editing ? "Змінити фото" : "Додати фото",
                      removePhoto: "Видалити фото",
                      leaveMember: "Позначити як того, хто вийшов із членства",
                      restoreMember: "Відновити членство",
                      leaveTitle: "Учасник вийшов із членства?",
                      leaveDetail:
                          "Учасника буде приховано з довідника та вилучено з усіх груп. Запис і історія залишаться.",
                      restoreTitle: "Відновити членство?",
                      restoreDetail:
                          "Учасник знову з’явиться в довіднику без призначення до групи.",
                      deleteMember: "Вилучити учасника",
                      save: "Зберегти",
                      cancel: "Скасувати",
                      required: "Введіть ім’я та прізвище.",
                      loadError: "Не вдалося завантажити учасника.",
                      photoType: "Оберіть фото JPEG, PNG або WebP.",
                      photoSize: "Фото має бути не більшим за 5 МБ.",
                      photoError: "Не вдалося вибрати це фото.",
                      saveError: "Не вдалося зберегти учасника.",
                      partialSave: "Учасника збережено, але наступний крок не завершився. Ваші зміни залишилися тут — повторіть збереження.",
                      photoPartial: "Дані учасника збережено, але фото не оновлено. Повторіть збереження, щоб спробувати ще раз.",
                      linkPartial: "Учасника та фото збережено, але обліковий запис не пов’язано. Повторіть збереження, щоб завершити зв’язування.",
                      photoUncertain: "Оновлення фото не вдалося підтвердити. Оновіть сторінку учасника, перш ніж повторювати спробу.",
                  }
                : {
                      title: editing ? "Edit member" : "New member",
                      identity: "Personal details",
                      dates: "Dates",
                      contact: "Contact details",
                      requiredField: "Required field",
                      firstName: "First name",
                      patronymic: "Patronymic (optional)",
                      lastName: "Last name",
                      birthday: "Birthday",
                      membershipDate: "Member since",
                      optionalDate: "Optional · leave blank if unknown",
                      chooseDate: "Choose a date",
                      clearDate: "Clear",
                      invalidMembershipDate: "Enter a valid membership date no later than today.",
                      invalidBirthday: "Enter a valid birthday no later than today.",
                      ministry: "Ministries",
                      care: "Care status",
                      gender: "Gender",
                      male: "Male",
                      female: "Female",
                      genderRequired: "Choose Male or Female for this member.",
                      orphan: "Orphan",
                      widow: "Widow or widower",
                      phone: "Phone number",
                      email: "Email",
                      address: "Address",
                      photo: "Photo",
                      choosePhoto: editing ? "Change photo" : "Add photo",
                      removePhoto: "Remove photo",
                      leaveMember: "Mark as left membership",
                      restoreMember: "Restore membership",
                      leaveTitle: "Member left membership?",
                      leaveDetail:
                          "This person will be hidden from the directory and removed from every group. Their record and history will remain.",
                      restoreTitle: "Restore membership?",
                      restoreDetail:
                          "This person will return to the directory without a group assignment.",
                      deleteMember: "Remove member",
                      save: "Save member",
                      cancel: "Cancel",
                      required: "Enter a first and last name.",
                      loadError: "Unable to load this member.",
                      photoType: "Choose a JPEG, PNG, or WebP photo.",
                      photoSize: "Photo must be 5 MB or smaller.",
                      photoError: "Unable to choose this photo.",
                      saveError: "Unable to save this member.",
                      partialSave: "The member was saved, but the next step failed. Your changes remain here; try saving again.",
                      photoPartial: "Member details were saved, but the photo was not updated. Save again to retry the photo.",
                      linkPartial: "The member and photo were saved, but the account was not linked. Save again to retry the link.",
                      photoUncertain: "The photo update could not be confirmed. Reload this member before trying again.",
                  },
        [editing, locale],
    );
    const photoSource = pendingPhoto
        ? { uri: pendingPhoto.uri }
        : photoRemoved
          ? undefined
          : member?.photo;
    async function choosePhoto() {
        setError(null);
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                allowsEditing: true,
                aspect: [1, 1],
                mediaTypes: ["images"],
                quality: 0.9,
                selectionLimit: 1,
            });
            if (result.canceled) return;
            const asset = result.assets[0];
            if (!asset || (asset.type && asset.type !== "image")) {
                setError(labels.photoType);
                return;
            }
            const mimeType = photoMimeType(asset.mimeType, asset.fileName);
            if (!mimeType) {
                setError(labels.photoType);
                return;
            }
            if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
                setError(labels.photoSize);
                return;
            }
            const response = await fetch(asset.uri);
            if (!response.ok) throw new Error("photo");
            const selected = await response.blob();
            if (selected.size === 0 || selected.size > MAX_PHOTO_BYTES) {
                setError(labels.photoSize);
                return;
            }
            setPendingPhoto(await createPhotoRenditions(asset.uri));
            setPhotoRemoved(false);
        } catch {
            setError(labels.photoError);
        }
    }
    const fullName = [firstName, lastName]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" ");
    const matchingFamilyMembers = familyReturn && firstName.trim() && lastName.trim() ? familyCandidates.filter((candidate) => candidate.name.toLocaleLowerCase() === fullName.toLocaleLowerCase() && candidate.id !== familyReturn) : [];
    async function save() {
        if (savingRef.current || state === "saving") return;
        if (!firstName.trim() || !lastName.trim()) {
            setError(labels.required);
            return;
        }
        if (!gender) {
            setError(labels.genderRequired);
            return;
        }
        if (birthday && !acceptsDateFieldValue(birthday, "date", localDateValue(new Date()))) {
            setError(labels.invalidBirthday);
            return;
        }
        if (membershipJoinedAt && !acceptsDateFieldValue(membershipJoinedAt, "date", localDateValue(new Date()))) {
            setError(labels.invalidMembershipDate);
            return;
        }
        savingRef.current = true;
        setState("saving");
        setError(null);
        let memberSaved = false;
        let stage: "details" | "photo" | "link" = "details";
        try {
            const saved = await managementRepository.saveMemberDetails({
                id: member?.id,
                revision: member?.revision,
                name: fullName,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                patronymic: patronymic.trim() || null,
                birthday: birthday.trim() || null,
                membershipJoinedAt: membershipJoinedAt || null,
                ministryIds,
                phone: phone.trim() || null,
                email: email.trim() || null,
                address: address.trim() || null,
                isOrphan,
                isWidow,
                gender,
            });
            const previousPhotoPath =
                member?.photoPath ??
                ("photo_path" in saved ? saved.photo_path : null);
            setMember({ ...member, id: saved.id, name: fullName, first_name: firstName.trim(), last_name: lastName.trim(), patronymic: patronymic.trim() || null, birthday: birthday.trim() || null, membershipJoinedAt: membershipJoinedAt || null, ministryIds, phone: phone.trim() || null, email: email.trim() || null, address: address.trim() || null, isOrphan, isWidow, gender, group: member?.group ?? "", archived: member?.archived ?? false, revision: saved.revision, photoPath: previousPhotoPath });
            memberSaved = true;
            stage = "photo";
            const photoChanged =
                Boolean(pendingPhoto) ||
                (photoRemoved && Boolean(previousPhotoPath));
            if (photoChanged && saved.id && saved.revision != null) {
                const photoResult = await managementRepository.replacePhoto(
                    {
                        id: saved.id,
                        revision: saved.revision,
                        photoPath: previousPhotoPath,
                    },
                    pendingPhoto?.bytes ?? null,
                    pendingPhoto?.mimeType,
                    pendingPhoto?.thumbnail,
                );
                const updatedPhotoPath = photoResult.person && ("photo_path" in photoResult.person ? photoResult.person.photo_path : photoResult.person.photoPath);
                setMember(previous => previous ? { ...previous, revision: photoResult.person?.revision ?? saved.revision, photoPath: updatedPhotoPath ?? null, photo: pendingPhoto ? { uri: pendingPhoto.uri } : undefined } : previous);
                setPendingPhoto(null);
                setPhotoRemoved(false);
                if (photoResult.cleanupWarning) Alert.alert(
                    locale === "uk" ? "Фото збережено" : "Photo saved",
                    locale === "uk" ? "Попереднє фото не вдалося видалити. Зверніться до адміністратора." : "The previous photo could not be removed. Please contact an administrator.",
                );
            }
            if (accountId && saved.id) {
                stage = "link";
                const management = await managementRepository.loadAccount(accountId);
                await managementRepository.apply(management, {
                    type: "link-account",
                    accountId,
                    personId: saved.id,
                });
                guard.allowLeave();
                router.replace(managedAccountHref(accountId) as never);
            } else if (familyReturn && saved.id) {
                guard.allowLeave();
                router.replace(`/manage/member/${encodeURIComponent(familyReturn)}/family?createdId=${encodeURIComponent(saved.id)}` as never);
            } else {
                guard.allowLeave();
                leave();
            }
        } catch (e) {
            setError(
                e instanceof Error && e.message.includes("photo update could not be confirmed") ? labels.photoUncertain :
                memberSaved ? stage === "photo" ? labels.photoPartial : stage === "link" ? labels.linkPartial : labels.partialSave : e instanceof Error &&
                    e.message ===
                        "Choose a JPEG, PNG or WebP photo smaller than 5 MB."
                    ? labels.photoSize
                    : labels.saveError,
            );
            setState("ready");
        } finally {
            savingRef.current = false;
        }
    }
    function confirmMembershipChange() {
        if (!member || state === "saving") return;
        const active = member.archived;
        if (!active) { guard.confirmLeave(() => router.push(`/manage/member/${encodeURIComponent(member.id)}/departure` as never)); return; }
        Alert.alert(
            active ? labels.restoreTitle : labels.leaveTitle,
            active ? labels.restoreDetail : labels.leaveDetail,
            [
                { text: labels.cancel, style: "cancel" },
                {
                    text: active ? labels.restoreMember : labels.leaveMember,
                    style: active ? "default" : "destructive",
                    onPress: async () => {
                        setState("saving");
                        setError(null);
                        try {
                            await managementRepository.setMembershipActive(
                                member,
                                active,
                            );
                            router.canGoBack()
                                ? router.back()
                                : fullManagement ? router.replace("/manage") : router.replace(`/members/${memberId}` as never);
                        } catch {
                            setError(labels.saveError);
                            setState("ready");
                        }
                    },
                },
            ],
        );
    }
    if (state === "loading")
        return (
            <SafeAreaView
                style={[styles.safe, { backgroundColor: palette.background }]}
            >
                <ActivityIndicator color={palette.accent} />
            </SafeAreaView>
        );
    if (state === "error")
        return (
            <SafeAreaView
                style={[styles.safe, { backgroundColor: palette.background }]}
            >
                <Text
                    selectable
                    style={[styles.error, { color: palette.text }]}
                >
                    {error ?? labels.loadError}
                </Text>
                <Pressable
                    onPress={() => guard.confirmLeave(leave)}
                >
                    <Text style={[styles.link, { color: palette.accent }]}>
                        {labels.cancel}
                    </Text>
                </Pressable>
            </SafeAreaView>
        );
    return (
        <SafeAreaView
            style={[styles.safe, { backgroundColor: palette.background }]}
        >
            <View style={[styles.header, !desktop && styles.headerMobile, { borderBottomColor: palette.line }]}>
                {!desktop ? <Text accessibilityRole="header" style={[styles.title, styles.titleMobile, { color: palette.text }]}>{labels.title}</Text> : null}
                <Pressable
                    accessibilityRole="button"
                    disabled={state === "saving"}
                    style={styles.headerAction}
                    onPress={() => guard.confirmLeave(leave)}
                >
                    <Text
                        style={[styles.cancel, { color: palette.accent }]}
                    >
                        {labels.cancel}
                    </Text>
                </Pressable>
                {desktop ? <Text
                    accessibilityRole="header"
                    style={[styles.title, { color: palette.text }]}
                >
                    {labels.title}
                </Text> : null}
                <Pressable
                    accessibilityRole="button"
                    style={styles.headerAction}
                    disabled={state === "saving"}
                    onPress={() => void save()}
                >
                    <Text
                        style={[
                            styles.save,
                            { color: palette.accent },
                            state === "saving" && styles.disabled,
                        ]}
                    >
                        {state === "saving" ? "…" : labels.save}
                    </Text>
                </Pressable>
            </View>
            {error ? (
                <Text
                    selectable
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    style={[styles.error, { color: palette.danger }]}
                >
                    {error}
                </Text>
            ) : null}
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                    styles.content,
                    desktop && styles.desktopContent,
                ]}
            >
                {fullManagement && editing && memberId && (
                    state === "saving" ? (
                        <Pressable accessibilityRole="link" accessibilityState={{ disabled: true }} disabled>
                            <Text style={[styles.link, { color: palette.accent }]}>{locale === "uk" ? "Редагувати родину" : "Edit family"}</Text>
                        </Pressable>
                    ) : (
                        <Link href={`/manage/member/${memberId}/family` as never} asChild onPress={(event) => {
                            if (!dirty) return;
                            event.preventDefault();
                            guard.confirmLeave(() => router.push(`/manage/member/${memberId}/family` as never));
                        }}><Pressable accessibilityRole="link">
                            <Text style={[styles.link, { color: palette.accent }]}>{locale === "uk" ? "Редагувати родину" : "Edit family"}</Text>
                        </Pressable></Link>
                    )
                )}
                <View
                    style={[
                        styles.formLayout,
                        desktop && styles.formLayoutDesktop,
                    ]}
                >
                    <View
                        style={[
                            styles.photoSection,
                            desktop && styles.photoSectionDesktop,
                            {
                                backgroundColor: palette.surface,
                                borderColor: palette.line,
                            },
                        ]}
                    >
                        <Text style={[styles.section, { color: palette.text }]}>
                            {labels.photo}
                        </Text>
                        <MemberAvatar name={fullName} source={photoSource} />
                        {fullManagement && <View style={styles.photoActions}>
                            <Pressable
                                accessibilityRole="button"
                                disabled={state === "saving"}
                                onPress={() => void choosePhoto()}
                                style={[
                                    styles.photoButton,
                                    { borderColor: palette.accent },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.photoButtonText,
                                        { color: palette.accent },
                                    ]}
                                >
                                    {labels.choosePhoto}
                                </Text>
                            </Pressable>
                            {photoSource ? (
                                <Pressable
                                    accessibilityRole="button"
                                    disabled={state === "saving"}
                                    onPress={() => {
                                        setPendingPhoto(null);
                                        setPhotoRemoved(true);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.removePhoto,
                                            { color: palette.accent },
                                        ]}
                                    >
                                        {labels.removePhoto}
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>}
                    </View>
                    <View
                        style={[
                            styles.fieldsColumn,
                            desktop && styles.fieldsColumnDesktop,
                        ]}
                    >
                        <Text accessibilityRole="header" style={[styles.section, { color: palette.text }]}>{labels.identity}</Text>
                        <View style={[styles.fieldRow, desktop && styles.fieldRowDesktop]}>
                        <Field
                            label={labels.firstName}
                            hint={labels.requiredField}
                            errorText={error === labels.required && !firstName.trim() ? labels.requiredField : undefined}
                            value={firstName}
                            onChangeText={setFirstName}
                            palette={palette}
                            autoFocus={!editing && desktop}
                        />
                        <Field
                            label={labels.lastName}
                            hint={labels.requiredField}
                            errorText={error === labels.required && !lastName.trim() ? labels.requiredField : undefined}
                            value={lastName}
                            onChangeText={setLastName}
                            palette={palette}
                        />
                        </View>
                        <Field
                            label={labels.patronymic}
                            value={patronymic}
                            onChangeText={setPatronymic}
                            palette={palette}
                            maxLength={200}
                        />
                        {matchingFamilyMembers.length ? <View style={styles.field}>
                            <Text style={[styles.label, { color: palette.secondaryText }]}>{getFamilyCopy(locale).matches}</Text>
                            {matchingFamilyMembers.map((candidate) => <Pressable key={candidate.id} accessibilityRole="button" onPress={() => guard.confirmLeave(() => router.replace(`/manage/member/${encodeURIComponent(familyReturn!)}/family?createdId=${encodeURIComponent(candidate.id)}` as never))} style={[styles.photoButton, { borderColor: palette.line }]}>
                                <Text style={{ color: palette.accent }}>{formatMemberName(candidate)}</Text>
                            </Pressable>)}
                        </View> : null}
                        <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={labels.gender} aria-required>
                            <Text style={[styles.label, { color: palette.secondaryText }]}>{labels.gender} · {labels.requiredField}</Text>
                            <View style={styles.genderOptions}>
                                {(["male", "female"] as const).map((option) => (
                                    <Pressable
                                        key={option}
                                        accessibilityRole="radio"
                                        accessibilityLabel={labels[option]}
                                        accessibilityState={{ checked: gender === option, disabled: state === "saving" }}
                                        aria-checked={gender === option}
                                        disabled={state === "saving"}
                                        onPress={() => { setGender(option); setError(null); }}
                                        style={[styles.genderOption, { borderColor: palette.line, backgroundColor: palette.surface }]}
                                    >
                                        <View style={[styles.radioCircle, { borderColor: palette.accent }]}>
                                            {gender === option ? <View style={[styles.radioDot, { backgroundColor: palette.accent }]} /> : null}
                                        </View>
                                        <Text style={{ color: palette.text }}>{labels[option]}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            {error === labels.genderRequired ? <Text accessibilityLiveRegion="polite" style={{ color: palette.danger }}>{labels.genderRequired}</Text> : null}
                        </View>
                        <View style={[styles.sectionDivider, { borderTopColor: palette.line }]}>
                            <Text accessibilityRole="header" style={[styles.section, { color: palette.text }]}>{labels.dates}</Text>
                            <Text style={[styles.sectionHint, { color: palette.secondaryText }]}>{labels.optionalDate}</Text>
                        </View>
                        <View style={[styles.fieldRow, desktop && styles.fieldRowDesktop]}>
                            {[
                                { label: labels.birthday, value: birthday, change: setBirthday, error: labels.invalidBirthday },
                                { label: labels.membershipDate, value: membershipJoinedAt, change: setMembershipJoinedAt, error: labels.invalidMembershipDate },
                            ].map((date) => <View key={date.label} style={styles.dateField}>
                                <View style={styles.dateLabelRow}>
                                    <Text style={[styles.label, { color: palette.text }]}>{date.label}</Text>
                                    {date.value ? <Pressable accessibilityRole="button" accessibilityLabel={`${labels.clearDate}: ${date.label}`} disabled={state === "saving"} onPress={() => date.change("")} style={styles.clearDate}>
                                        <Text style={{ color: palette.accent, fontSize: 14 }}>{labels.clearDate}</Text>
                                    </Pressable> : null}
                                </View>
                                <NativeDateTimeField
                                    accessibilityLabel={date.label}
                                    allowOutOfRange
                                    accentColor={palette.accent}
                                    backgroundColor={palette.surface}
                                    borderColor={error === date.error ? palette.danger : palette.line}
                                    disabled={state === "saving"}
                                    maximumDate={new Date()}
                                    mode="date"
                                    onChange={date.change}
                                    placeholder={labels.chooseDate}
                                    textColor={palette.text}
                                    value={date.value}
                                />
                                {error === date.error ? <Text accessibilityLiveRegion="polite" style={{ color: palette.danger }}>{date.error}</Text> : null}
                            </View>)}
                        </View>
                        <Text accessibilityRole="header" style={[styles.section, styles.sectionDivider, { color: palette.text, borderTopColor: palette.line }]}>{labels.contact}</Text>
                        <Field
                            label={labels.phone}
                            value={phone}
                            onChangeText={(value) =>
                                setPhone(formatPhoneNumber(value))
                            }
                            palette={palette}
                            keyboardType="phone-pad"
                            maxLength={14}
                            textContentType="telephoneNumber"
                        />
                        <Field
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            label={labels.email}
                            onChangeText={setEmail}
                            palette={palette}
                            textContentType="emailAddress"
                            value={email}
                        />
                        <Field
                            label={labels.address}
                            value={address}
                            onChangeText={setAddress}
                            palette={palette}
                            multiline
                        />
                        <Text style={[styles.section, { color: palette.text }]}>
                            {labels.care}
                        </Text>
                        <View
                            style={[
                                styles.switchCard,
                                {
                                    backgroundColor: palette.surface,
                                    borderColor: palette.line,
                                },
                            ]}
                        >
                            <ToggleRow
                                label={labels.orphan}
                                value={isOrphan}
                                onValueChange={setIsOrphan}
                                palette={palette}
                            />
                            <View
                                style={{
                                    backgroundColor: palette.line,
                                    height: StyleSheet.hairlineWidth,
                                }}
                            />
                            <ToggleRow
                                label={labels.widow}
                                value={isWidow}
                                onValueChange={setIsWidow}
                                palette={palette}
                            />
                        </View>
                        <Text style={[styles.section, { color: palette.text }]}>
                            {labels.ministry}
                        </Text>
                        <View style={styles.chips}>
                            {ministries
                                .filter((item) => !item.archived)
                                .map((item) => {
                                    const selected = ministryIds.includes(
                                        item.id,
                                    );
                                    const disabled = !fullManagement || (Boolean(item.systemKey) && !leadershipAllowed);
                                    return (
                                        <Pressable
                                            accessibilityRole="checkbox"
                                            accessibilityState={{
                                                checked: selected,
                                                disabled,
                                            }}
                                            disabled={disabled}
                                            key={item.id}
                                            onPress={() =>
                                                setMinistryIds((ids) => {
                                                    if (selected)
                                                        return ids.filter(
                                                            (id) =>
                                                                id !== item.id,
                                                        );
                                                    const otherLeadershipIds =
                                                        new Set(
                                                            ministries
                                                                .filter(
                                                                    (
                                                                        candidate,
                                                                    ) =>
                                                                        candidate.systemKey &&
                                                                        candidate.systemKey !==
                                                                            item.systemKey,
                                                                )
                                                                .map(
                                                                    (
                                                                        candidate,
                                                                    ) =>
                                                                        candidate.id,
                                                                ),
                                                        );
                                                    return item.systemKey
                                                        ? [
                                                              ...ids.filter(
                                                                  (id) =>
                                                                      !otherLeadershipIds.has(
                                                                          id,
                                                                      ),
                                                              ),
                                                              item.id,
                                                          ]
                                                        : [...ids, item.id];
                                                })
                                            }
                                            style={[
                                                styles.chip,
                                                {
                                                    borderColor: selected
                                                        ? palette.accent
                                                        : palette.line,
                                                    backgroundColor: selected
                                                        ? palette.accentSoft
                                                        : palette.surface,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={{
                                                    color: palette.text,
                                                    fontWeight: "600",
                                                }}
                                            >
                                                {locale === "uk"
                                                    ? item.nameUk || item.name
                                                    : item.name}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                        </View>
                        {fullManagement && editing && member ? <Pressable accessibilityRole="link" onPress={() => guard.confirmLeave(() => router.push(`/manage/member/${encodeURIComponent(member.id)}/departure` as never))} style={styles.membershipAction}><Text style={{ color: palette.accent }}>{locale === "uk" ? "Історія виходу з членства" : "Departure history"}</Text></Pressable> : null}
                        {fullManagement && editing && member ? (
                            <Pressable
                                accessibilityRole="button"
                                disabled={state === "saving"}
                                onPress={confirmMembershipChange}
                                style={({ pressed }) => [
                                    styles.membershipAction,
                                    {
                                        borderColor: member.archived
                                            ? palette.success
                                            : palette.danger,
                                    },
                                    pressed && { opacity: 0.7 },
                                ]}
                            >
                                <Text
                                    style={{
                                        color: member.archived
                                            ? palette.success
                                            : palette.danger,
                                        fontSize: 16,
                                        fontWeight: "700",
                                    }}
                                >
                                    {member.archived
                                        ? labels.restoreMember
                                        : labels.leaveMember}
                                </Text>
                            </Pressable>
                        ) : null}
                        {editing &&
                        member &&
                        session.status === "ready" &&
                        canManageAccounts(session.account) ? (
                            <Pressable
                                accessibilityRole="button"
                                disabled={state === "saving"}
                                onPress={() => guard.confirmLeave(() =>
                                    router.push(
                                        `/manage/member/${encodeURIComponent(member.id)}/delete` as never,
                                    ),
                                )}
                                style={({ pressed }) => [
                                    styles.deleteMember,
                                    { borderColor: palette.danger },
                                    pressed && { opacity: 0.7 },
                                ]}
                            >
                                <Text
                                    style={{
                                        color: palette.danger,
                                        fontSize: 16,
                                        fontWeight: "700",
                                    }}
                                >
                                    {labels.deleteMember}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
function splitMemberName(name: string) {
    const [firstName = "", ...lastNameParts] = name.trim().split(/\s+/);
    return { firstName, lastName: lastNameParts.join(" ") };
}
function photoMimeType(
    mimeType?: string | null,
    fileName?: string | null,
): PhotoMimeType | null {
    const normalized = mimeType?.toLowerCase();
    if (normalized) {
        if (normalized === "image/jpeg" || normalized === "image/jpg")
            return "image/jpeg";
        if (normalized === "image/png") return "image/png";
        if (normalized === "image/webp") return "image/webp";
        return null;
    }
    const extension = fileName?.toLowerCase().split(".").pop();
    return extension === "jpg" || extension === "jpeg"
        ? "image/jpeg"
        : extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : null;
}
function Field({
    label,
    hint,
    errorText,
    palette,
    multiline,
    ...props
}: {
    label: string;
    hint?: string;
    errorText?: string;
    palette: ReturnType<typeof useAppearance>["palette"];
    multiline?: boolean;
} & ComponentProps<typeof TextInput>) {
    const [focused, setFocused] = useState(false);
    return (
        <View style={styles.field}>
            <Text style={[styles.label, { color: palette.secondaryText }]}>
                {label}
                {hint ? ` · ${hint}` : ""}
            </Text>
            <TextInput
                accessibilityLabel={label}
                {...props}
                multiline={multiline}
                aria-invalid={Boolean(errorText)}
                onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
                onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
                placeholderTextColor={palette.secondaryText}
                style={[
                    styles.input,
                    {
                        color: palette.text,
                        backgroundColor: palette.surface,
                        borderColor: errorText ? palette.danger : focused ? palette.accent : palette.line,
                    },
                    multiline && styles.multiline,
                ]}
            />
            {errorText ? <Text accessibilityLiveRegion="polite" style={{ color: palette.danger, fontSize: 14 }}>{errorText}</Text> : null}
        </View>
    );
}
function ToggleRow({
    label,
    value,
    onValueChange,
    palette,
}: {
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    palette: ReturnType<typeof useAppearance>["palette"];
}) {
    return (
        <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: palette.text }]}>
                {label}
            </Text>
            <View style={styles.toggleControl}>
                <Switch
                    accessibilityLabel={label}
                    onValueChange={onValueChange}
                    value={value}
                />
            </View>
        </View>
    );
}
const styles = StyleSheet.create({
    desktopContent: { padding: 32 },
    formLayout: { gap: 16 },
    formLayoutDesktop: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 32,
    },
    photoSectionDesktop: { width: 240 },
    fieldsColumnDesktop: { flex: 1 },
    fieldsColumn: { gap: 16, minWidth: 0 },
    safe: { flex: 1 },
    content: { padding: 18, paddingBottom: 48, gap: 16 },
    header: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    headerMobile: { flexWrap: "wrap", rowGap: 0 },
    titleMobile: { flexBasis: "100%", flexGrow: 0, paddingBottom: 4 },
    headerAction: { minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center" },
    title: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "800" },
    cancel: { fontSize: 16 },
    save: { fontSize: 16, fontWeight: "700" },
    disabled: { opacity: 0.5 },
    field: { gap: 7, flex: 1, minWidth: 0 },
    fieldRow: { gap: 16 },
    fieldRowDesktop: { flexDirection: "row", alignItems: "flex-start" },
    dateField: { flex: 1, minWidth: 0, gap: 7 },
    dateLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, gap: 8 },
    clearDate: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
    sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 22, marginTop: 8, gap: 5 },
    sectionHint: { fontSize: 14, lineHeight: 20 },
    label: { fontSize: 14, fontWeight: "600" },
    input: {
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 17,
        fontVariant: ["tabular-nums"],
        minHeight: 50,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    multiline: { minHeight: 92, textAlignVertical: "top" },
    section: { fontSize: 20, fontWeight: "800", marginTop: 8 },
    switchCard: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
    },
    toggleRow: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        minHeight: 64,
        paddingHorizontal: 14,
    },
    toggleLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: "600",
        lineHeight: 22,
        paddingRight: 12,
    },
    toggleControl: {
        alignItems: "center",
        height: 44,
        justifyContent: "center",
        width: 56,
    },
    genderOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    genderOption: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 48, minWidth: 120, paddingHorizontal: 14 },
    radioCircle: { alignItems: "center", borderRadius: 10, borderWidth: 2, height: 20, justifyContent: "center", width: 20 },
    radioDot: { borderRadius: 5, height: 10, width: 10 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    chip: {
        borderRadius: 99,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    error: { fontSize: 15, lineHeight: 21, textAlign: "center", paddingHorizontal: 18, paddingVertical: 10 },
    link: {
        fontSize: 16,
        fontWeight: "700",
        marginTop: 14,
        textAlign: "center",
    },
    photoSection: {
        alignItems: "center",
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 12,
        padding: 16,
    },
    photoActions: { alignItems: "center", gap: 12 },
    photoButton: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    photoButtonText: { fontSize: 15, fontWeight: "700" },
    removePhoto: { fontSize: 14, fontWeight: "600" },
    membershipAction: {
        alignItems: "center",
        borderCurve: "continuous",
        borderRadius: 13,
        borderWidth: 1,
        justifyContent: "center",
        minHeight: 48,
        marginTop: 18,
    },
    deleteMember: {
        alignItems: "center",
        borderCurve: "continuous",
        borderRadius: 13,
        borderWidth: 1,
        justifyContent: "center",
        marginTop: 18,
        minHeight: 52,
        paddingHorizontal: 16,
    },
});
