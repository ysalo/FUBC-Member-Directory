import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { memberSearchScore, normalizeMemberSearch } from "@/lib/member-search";
import { managementRepository } from "./management-repository";
import type { GroupManagementState } from "./model";

export function MemberGroupField({ value, onChange, disabled, currentName }: {
    value: string | null;
    onChange: (value: string | null) => void;
    disabled: boolean;
    currentName?: string;
}) {
    const { palette } = useAppearance();
    const { locale } = useLocalization();
    const uk = locale === "uk";
    const [catalog, setCatalog] = useState<GroupManagementState | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    useEffect(() => {
        let alive = true;
        setFailed(false);
        void managementRepository.listMemberGroupOptions().then(result => {
            if (alive) setCatalog(result);
        }).catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [attempt]);
    const noGroup = uk ? "Без групи" : "No group";
    const selected = catalog?.groups.find(group => group.id === value);
    const deacons = (ids: string[]) => catalog?.deacons.filter(deacon => ids.includes(deacon.personId)) ?? [];
    const results = catalog?.groups.filter(group => !group.archived && group.kind === "membership" && (
        normalizeMemberSearch(group.name).includes(normalizeMemberSearch(query)) ||
        deacons(group.deaconIds).some(deacon => memberSearchScore(deacon, query) !== null)
    )).sort((a, b) => a.name.localeCompare(b.name, locale)) ?? [];
    function choose(id: string | null) { onChange(id); setOpen(false); setQuery(""); }
    return <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.heading, { color: palette.text }]}>{uk ? "Група" : "Group"}</Text>
        <Text style={{ color: palette.secondaryText }}>{uk ? "Учасник може належати лише до однієї групи. Зміни застосуються після збереження." : "A member can belong to one group. Changes apply when you save."}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={uk ? "Змінити групу" : "Change group"} accessibilityState={{ expanded: open, disabled: disabled || !catalog }} disabled={disabled || !catalog} onPress={() => setOpen(!open)} style={[styles.card, { borderColor: open ? palette.accent : palette.line, backgroundColor: palette.surface }]}>
            <View style={styles.summary}>
                <Text style={[styles.name, { color: palette.text }]}>{value ? selected?.name ?? currentName ?? (uk ? "Поточна група" : "Current group") : noGroup}</Text>
                {selected && <Text style={{ color: palette.secondaryText }}>{deacons(selected.deaconIds).map(deacon => deacon.name).join(" · ") || (uk ? "Дияконів не призначено" : "No deacons assigned")}</Text>}
            </View>
            <Text style={{ color: palette.accent }}>{open ? (uk ? "Закрити" : "Close") : (uk ? "Змінити" : "Change")}</Text>
        </Pressable>
        {!catalog && !failed && <ActivityIndicator accessibilityLabel={uk ? "Завантаження груп" : "Loading groups"} color={palette.accent} />}
        {failed && <View style={styles.section}>
            <Text accessibilityRole="alert" style={{ color: palette.danger }}>{uk ? "Не вдалося завантажити групи." : "Could not load groups."}</Text>
            <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setAttempt(attempt + 1)} style={styles.retry}><Text style={{ color: palette.accent }}>{uk ? "Спробувати ще раз" : "Retry"}</Text></Pressable>
        </View>}
        {open && <View style={styles.section}>
            <TextInput accessibilityLabel={uk ? "Пошук за назвою групи або ім’ям диякона" : "Search by group or deacon name"} placeholder={uk ? "Назва групи або ім’я диякона" : "Group or deacon name"} placeholderTextColor={palette.secondaryText} value={query} onChangeText={setQuery} editable={!disabled} autoCorrect={false} style={[styles.search, { color: palette.text, borderColor: palette.accent, backgroundColor: palette.surface }]} />
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={[styles.results, { borderColor: palette.line }]}>
                {[{ id: null, name: noGroup, deaconIds: [] }, ...results].map(group => <Pressable key={group.id ?? "none"} accessibilityRole="radio" accessibilityState={{ checked: value === group.id, disabled }} disabled={disabled} onPress={() => choose(group.id)} style={[styles.card, { borderColor: palette.line, backgroundColor: value === group.id ? palette.accentSoft : palette.surface }]}>
                    <View style={styles.summary}><Text style={[styles.name, { color: palette.text }]}>{group.name}</Text>{group.id && <Text style={{ color: palette.secondaryText }}>{deacons(group.deaconIds).map(deacon => deacon.name).join(" · ") || (uk ? "Дияконів не призначено" : "No deacons assigned")}</Text>}</View>
                    <Text style={{ color: palette.accent }}>{value === group.id ? "●" : "○"}</Text>
                </Pressable>)}
                {!results.length && <Text accessibilityLiveRegion="polite" style={[styles.empty, { color: palette.secondaryText }]}>{uk ? "Груп не знайдено. Спробуйте іншу назву або ім’я диякона." : "No groups found. Try another group or deacon name."}</Text>}
            </ScrollView>
        </View>}
    </View>;
}
const styles = StyleSheet.create({
    section: { gap: 10 },
    heading: { fontSize: 20, fontWeight: "800", marginTop: 8 },
    card: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
    summary: { flex: 1, gap: 4, minWidth: 0 },
    name: { fontSize: 16, fontWeight: "600" },
    search: { minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 17 },
    results: { maxHeight: 300, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
    empty: { padding: 14 },
    retry: { minHeight: 44, justifyContent: "center" },
});
