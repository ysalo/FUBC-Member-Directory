import { useEffect, useState } from "react";
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

export function MemberNote({ memberId }: { memberId: string }) {
    const { palette } = useAppearance();
    const { locale } = useLocalization();
    const session = useSession();
    const uk = locale === "uk";
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
        if (!isBackendConfigured || session.status !== "ready" || session.account.status !== "active" || !["pastor", "deacon"].includes(session.account.leadershipMinistry ?? "")) return;
        const scope = sessionCacheScope();
        const current = () => { try { return alive && scope === sessionCacheScope(); } catch { return false; } };
        const client = requireSupabase();
        void Promise.all([
            client.rpc("member_note_access", { p_person_id: memberId }),
            client.rpc("can_edit_group_member", { p_person_id: memberId }),
            client.from("member_notes").select("body,revision").eq("person_id", memberId).maybeSingle(),
        ]).then(([allowed, edit, result]) => {
            if (!current()) return;
            if (allowed.error || edit.error || result.error) { setError(uk ? "Не вдалося завантажити нотатку." : "Could not load the note."); return; }
            setAccess(Boolean(allowed.data));
            setEditable(Boolean(edit.data));
            setNote(result.data);
        });
        return () => { alive = false; };
    }, [memberId, session, reload, uk]);
    if (access && !editable && !note) return null;
    if (!access) return error ? <Text style={{ color: palette.secondaryText }}>{error}</Text> : null;
    const openEditor = () => { setEditBase(note); setDraft(note?.body ?? ""); setEditing(true); setError(""); };
    const save = async () => {
        const scope = sessionCacheScope();
        setSaving(true);
        setError("");
        try {
            const result = await requireSupabase().rpc("save_member_note", { p_person_id: memberId, p_revision: editBase?.revision ?? null, p_body: draft });
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
                        const { error: failure } = await requireSupabase().rpc("remove_member_note", { p_person_id: memberId, p_revision: revision });
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
    if (!note && !editing) return <View style={{ marginBottom: 20, alignItems: "flex-start" }}>
        <Pressable accessibilityRole="button" disabled={saving} onPress={openEditor} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, borderWidth: 0.5, borderColor: palette.line }}>
            <Text style={{ color: palette.secondaryText, fontSize: 14 }}>{uk ? "Додати нотатку" : "Add note"}</Text>
        </Pressable>
        {error && <Text accessibilityRole="alert" style={{ color: palette.secondaryText }}>{error}</Text>}
    </View>;
    return <View style={{ marginBottom: 20, padding: 16, borderRadius: 12, backgroundColor: palette.surface, gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons accessibilityElementsHidden importantForAccessibility="no" name="document-text-outline" size={18} color={palette.accent} />
                <Text accessibilityRole="header" style={{ color: palette.secondaryText, fontSize: 14, fontWeight: "600" }}>{uk ? "Нотатка" : "Note"}</Text>
            </View>
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
        {editing ? <>
            <TextInput autoFocus accessibilityLabel={uk ? "Нотатка" : "Note"} multiline maxLength={5000} editable={!saving} value={draft} onChangeText={setDraft} style={{ color: palette.text, borderColor: palette.line, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 120, textAlignVertical: "top" }} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 24 }}>
                {saving && <ActivityIndicator color={palette.accent} />}
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setEditing(false); setError(""); setReload(value => value + 1); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.secondaryText }}>{uk ? "Скасувати" : "Cancel"}</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={saving || !draft.trim()} onPress={() => void save()} style={{ minHeight: 44, justifyContent: "center", opacity: saving || !draft.trim() ? 0.5 : 1 }}><Text style={{ color: palette.accent }}>{uk ? "Зберегти нотатку" : "Save note"}</Text></Pressable>
            </View>
        </> : note && <Text selectable style={{ color: palette.text, fontSize: 16, lineHeight: 24 }}>{note.body}</Text>}
        {error && <Text accessibilityRole="alert" style={{ color: palette.secondaryText }}>{error}</Text>}
    </View>;
}
