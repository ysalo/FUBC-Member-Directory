import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { Alert } from "@/features/platform/alert";
import { useUnsavedChanges } from "@/features/manage/use-unsaved-changes";
import { useSession } from "@/features/session/SessionProvider";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";
import { invalidateData, sessionCacheScope, subscribeDataChanges } from "@/lib/session-cache";

export function MemberNote({ memberId, children, deaconOnly = false }: {
    memberId: string;
    deaconOnly?: boolean;
    children: (noteContent: ReactNode, addNoteAction: ReactNode) => ReactNode;
}) {
    const render = (noteContent: ReactNode, addNoteAction: ReactNode = null) => children(noteContent, addNoteAction);
    const { palette } = useAppearance();
    const { locale } = useLocalization();
    const session = useSession();
    const uk = locale === "uk";
    const [expanded, setExpanded] = useState(false);
    const [access, setAccess] = useState(false);
    const [editable, setEditable] = useState(false);
    const [note, setNote] = useState<{ body: string; revision: number } | null>(null);
    const [editBase, setEditBase] = useState<{ body: string; revision: number } | null>(null);
    const [draft, setDraft] = useState("");
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    useUnsavedChanges(editing && draft !== (editBase?.body ?? ""));
    useEffect(() => subscribeDataChanges(() => setReload(value => value + 1)), []);
    useEffect(() => {
        let alive = true;
        setAccess(false);
        setEditable(false);
        setError("");
        if (!isBackendConfigured || session.status !== "ready" || session.account.status !== "active" || !(deaconOnly ? ["deacon"] : ["pastor", "deacon"]).includes(session.account.leadershipMinistry ?? "")) return;
        const scope = sessionCacheScope();
        const current = () => { try { return alive && scope === sessionCacheScope(); } catch { return false; } };
        const client = requireSupabase();
        void Promise.all([
            client.rpc(deaconOnly ? "deacon_member_note_access" : "member_note_access", { p_person_id: memberId }),
            client.rpc(deaconOnly ? "deacon_member_note_access" : "can_write_member_note", { p_person_id: memberId }),
            client.from(deaconOnly ? "deacon_member_notes" : "member_notes").select("body,revision").eq("person_id", memberId).maybeSingle(),
        ]).then(([allowed, edit, result]) => {
            if (!current()) return;
            if (allowed.error || edit.error || result.error) { setError(uk ? "Не вдалося завантажити нотатку." : "Could not load the note."); return; }
            setAccess(Boolean(allowed.data));
            setEditable(Boolean(edit.data));
            setNote(result.data);
        });
        return () => { alive = false; };
    }, [memberId, session, reload, uk, deaconOnly]);
    if (access && !editable && !note) return render(null);
    if (!access) return render(error ? <View style={{ marginBottom: 20, gap: 8 }}>
        <Text accessibilityRole="alert" style={{ color: palette.secondaryText }}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => setReload(value => value + 1)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.accent }}>{uk ? "Спробувати знову" : "Try again"}</Text></Pressable>
    </View> : null);
    const openEditor = () => { setEditBase(note); setDraft(note?.body ?? ""); setEditing(true); setError(""); };
    const save = async () => {
        const scope = sessionCacheScope();
        setSaving(true);
        setError("");
        try {
            const result = await requireSupabase().rpc(deaconOnly ? "save_deacon_member_note" : "save_member_note", { p_person_id: memberId, p_revision: editBase?.revision ?? null, p_body: draft });
            if (scope !== sessionCacheScope()) return;
            if (result.error) throw result.error;
            setEditing(false);
            invalidateData("directory");
        } catch {
            try { if (scope === sessionCacheScope()) setError(uk ? "Не вдалося зберегти. Якщо нотатку змінено, скасуйте та відкрийте її знову." : "Could not save. If the note changed, cancel and reopen it before retrying."); } catch { /* Session ended. */ }
        } finally { setSaving(false); }
    };
    const remove = () => {
        if (!note || saving) return;
        const revision = note.revision;
        const scope = sessionCacheScope();
        Alert.alert(uk ? "Видалити нотатку?" : "Remove note?", uk ? "Нотатку буде видалено. Цю дію не можна скасувати." : "This deletes the note. You cannot undo this action.", [
            { text: uk ? "Скасувати" : "Cancel", style: "cancel" },
            { text: uk ? "Видалити нотатку" : "Remove note", style: "destructive", onPress: () => {
                // A confirmation must not act on a changed session.
                try { if (scope !== sessionCacheScope()) return; } catch { return; }
                setSaving(true);
                setError("");
                void (async () => {
                    try {
                        const { error: failure } = await requireSupabase().rpc(deaconOnly ? "remove_deacon_member_note" : "remove_member_note", { p_person_id: memberId, p_revision: revision });
                        if (scope !== sessionCacheScope()) return;
                        if (failure) throw failure;
                        setNote(null);
                        setDraft("");
                        invalidateData("directory");
                    } catch {
                        try { if (scope === sessionCacheScope()) setError(uk ? "Не вдалося видалити. Якщо нотатку змінено, оновіть сторінку та спробуйте знову." : "Could not remove the note. If it changed, reload and try again."); } catch { /* Session ended. */ }
                    } finally { setSaving(false); }
                })();
            } },
        ]);
    };
    if (!note && !editing && !deaconOnly) return render(
        error ? <Text accessibilityRole="alert" style={{ color: palette.secondaryText, marginBottom: 20 }}>{error}</Text> : null,
        <Pressable accessibilityRole="button" accessibilityLabel={uk ? "Додати нотатку" : "Add note"} disabled={saving} onPress={openEditor} style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12, marginLeft: "auto", borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: pressed ? palette.subtle : palette.surface })}>
            <Ionicons accessibilityElementsHidden importantForAccessibility="no" name="add-outline" size={18} color={palette.text} />
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: "500" }}>{uk ? "Додати нотатку" : "Add note"}</Text>
        </Pressable>,
    );
    if (deaconOnly && !expanded) return render(<Pressable testID="deacon-notes-toggle" accessibilityRole="button" accessibilityState={{ expanded: false }} onPress={() => setExpanded(true)} style={{ minHeight: 56, marginBottom: 20, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons accessibilityElementsHidden name="heart-outline" size={20} color={palette.accent} />
        <Text style={{ flex: 1, color: palette.text, fontSize: 16, fontWeight: "600" }}>{uk ? "Нотатки дияконів" : "Deacon notes"}{note ? " •" : ""}</Text>
        <Ionicons accessibilityElementsHidden name="chevron-down" size={18} color={palette.secondaryText} />
    </Pressable>);
    return render(<View testID={deaconOnly ? "deacon-notes-section" : "member-note-section"} style={{ marginBottom: 20, padding: 16, borderRadius: 12, backgroundColor: palette.surface, gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons accessibilityElementsHidden importantForAccessibility="no" name={deaconOnly ? "heart-outline" : "document-text-outline"} size={18} color={palette.accent} />
                <Text accessibilityRole="header" style={{ color: palette.secondaryText, fontSize: 14, fontWeight: "600" }}>{deaconOnly ? (uk ? "Нотатки дияконів" : "Deacon notes") : (uk ? "Нотатка" : "Note")}</Text>
            </View>
            {deaconOnly && !editing && <Pressable accessibilityRole="button" accessibilityState={{ expanded: true }} disabled={saving} onPress={() => setExpanded(false)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.secondaryText }}>{uk ? "Згорнути" : "Collapse"}</Text></Pressable>}
            {note && editable && !editing && <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginLeft: "auto" }}>
                {saving && <ActivityIndicator color={palette.accent} />}
                <Pressable accessibilityRole="button" accessibilityLabel={uk ? "Редагувати нотатку" : "Edit note"} disabled={saving} onPress={openEditor} style={{ minHeight: 44, justifyContent: "center" }}>
                    <Text style={{ color: palette.secondaryText, fontSize: 14 }}>{uk ? "Редагувати" : "Edit"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={uk ? "Видалити нотатку" : "Remove note"} disabled={saving} onPress={remove} style={{ minHeight: 44, justifyContent: "center", opacity: saving ? 0.5 : 1 }}>
                    <Text style={{ color: palette.secondaryText, fontSize: 14 }}>{uk ? "Видалити" : "Remove"}</Text>
                </Pressable>
            </View>}
        </View>
        {deaconOnly && <Text style={{ color: palette.secondaryText, fontSize: 13, lineHeight: 20 }}>{uk ? "Лише для дияконів цієї групи. Молитовні потреби та нагадування про турботу." : "Only for this group’s deacons. Prayer needs and care reminders."}</Text>}
        {deaconOnly && !note && !editing && <Pressable accessibilityRole="button" onPress={openEditor} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.accent }}>{uk ? "Додати нотатку" : "Add note"}</Text></Pressable>}
        {editing ? <>
            {!deaconOnly && !editBase && <Text style={{ color: palette.secondaryText, fontSize: 12, lineHeight: 18 }}>{uk ? "Видно лише пасторам і дияконам групи." : "Only visible to pastors and group deacons."}</Text>}
            <TextInput autoFocus accessibilityLabel={deaconOnly ? (uk ? "Нотатка дияконів" : "Deacon note") : (uk ? "Нотатка" : "Note")} multiline maxLength={5000} editable={!saving} value={draft} onChangeText={setDraft} style={{ color: palette.text, borderColor: palette.line, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 120, textAlignVertical: "top" }} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 24 }}>
                {saving && <ActivityIndicator color={palette.accent} />}
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setEditing(false); setError(""); setReload(value => value + 1); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.secondaryText }}>{uk ? "Скасувати" : "Cancel"}</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={saving || !draft.trim()} onPress={() => void save()} style={{ minHeight: 44, justifyContent: "center", opacity: saving || !draft.trim() ? 0.5 : 1 }}><Text style={{ color: palette.accent }}>{uk ? "Зберегти нотатку" : "Save note"}</Text></Pressable>
            </View>
        </> : note && <Text selectable style={{ color: palette.text, fontSize: 16, lineHeight: 24 }}>{note.body}</Text>}
        {error && <Text accessibilityRole="alert" style={{ color: palette.secondaryText }}>{error}</Text>}
    </View>);
}
