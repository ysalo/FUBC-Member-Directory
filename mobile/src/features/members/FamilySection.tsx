import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { getFamilyCopy } from "@/features/family/family-copy";
import type { FamilyMember, FamilySnapshot } from "@/features/family/family-repository";
import { sessionCacheScope, subscribeDataChanges } from "@/lib/session-cache";
import { memberProfileRepository } from "./member-repository";
import { getMemberCopy } from "./member-copy";
import { ProfileAvatar } from "./ProfileAvatar";

/** A separately loaded section keeps contact details available if family loading fails. */
export function FamilySection({ memberId }: { memberId: string }) {
    const { palette } = useAppearance();
    const { locale } = useLocalization();
    const copy = getFamilyCopy(locale);
    const memberCopy = getMemberCopy(locale);
    const scope = (() => { try { return sessionCacheScope(); } catch { return null; } })();
    const [loaded, setLoaded] = useState<{ scope: string; memberId: string; family: FamilySnapshot | null; failed: boolean }>();
    const request = useRef(0);
    const current = loaded?.scope === scope && loaded?.memberId === memberId ? loaded : undefined;
    const load = useCallback(() => {
        const ticket = ++request.current;
        if (scope === null) { setLoaded(undefined); return; }
        const isCurrent = () => {
            try { return request.current === ticket && sessionCacheScope() === scope; }
            catch { return false; }
        };
        setLoaded(undefined);
        void memberProfileRepository.getFamily(memberId).then((family) => {
            if (isCurrent()) setLoaded({ scope, memberId, family, failed: false });
        }).catch(() => {
            if (isCurrent()) setLoaded({ scope, memberId, family: null, failed: true });
        });
    }, [memberId, scope]);
    useFocusEffect(useCallback(() => {
        load();
        const unsubscribe = subscribeDataChanges(load);
        return () => { request.current++; unsubscribe(); };
    }, [load]));
    if (scope === null) return null;
    const family = current?.family;
    const groups: { label: string; members: FamilyMember[] }[] = family ? [
        { label: copy.parents, members: family.parents },
        { label: copy.spouse, members: family.spouse ? [family.spouse] : [] },
        { label: copy.children, members: family.children },
        { label: copy.siblings, members: family.siblings },
    ].map((group) => ({ ...group, members: group.members.filter((member) => !member.archived) })).filter((group) => group.members.length > 0) : [];
    if (family && groups.length === 0) return null;
    return <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.family}</Text>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
            {!current ? <View accessibilityLabel={memberCopy.loading} style={styles.feedback}><ActivityIndicator color={palette.accent} /></View> : current.failed ?
                <View accessibilityLiveRegion="polite" style={styles.feedback}>
                    <Text style={[styles.name, { color: palette.secondaryText }]}>{copy.loadError}</Text>
                    <Pressable accessibilityRole="button" onPress={load} style={[styles.retry, { backgroundColor: palette.accentSoft }]}>
                        <Text style={[styles.name, { color: palette.accent }]}>{memberCopy.retry}</Text>
                    </Pressable>
                </View> : groups.map((group) => <View key={group.label} style={styles.category}>
                    <Text accessibilityRole="header" style={[styles.categoryTitle, { color: palette.secondaryText }]}>{group.label}</Text>
                    {group.members.map((relative) => <Link key={relative.id} href={`/members/${relative.id}`} asChild>
                        <Pressable accessibilityRole="link" accessibilityLabel={`${relative.name}, ${memberCopy.profile}`} style={styles.relative}>
                            <ProfileAvatar name={relative.name} source={relative.photo} size={48} />
                            <Text style={[styles.name, styles.relativeName, { color: palette.accent }]}>{relative.name}</Text>
                        </Pressable>
                    </Link>)}
                </View>)}
        </View>
    </View>;
}

const styles = StyleSheet.create({
    section: { gap: 8 },
    title: { fontSize: 19, fontWeight: "800" },
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 18 },
    category: { gap: 6 },
    categoryTitle: { fontSize: 14, fontWeight: "700" },
    relative: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, minHeight: 60 },
    relativeName: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, lineHeight: 23 },
    feedback: { gap: 10, alignItems: "flex-start" },
    retry: { minHeight: 44, justifyContent: "center", padding: 10, borderRadius: 8 },
});
