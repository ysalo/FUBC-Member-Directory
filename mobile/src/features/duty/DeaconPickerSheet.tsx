import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import type { Member } from "@/features/directory/members";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import type { DutyCandidate } from "./duty-domain";

type ClearOption = { label: string; selected: boolean };

/** The same bordered member-card look used by Manage's member list, reused here for consistency. */
export function DeaconPickerSheet({
  visible,
  onClose,
  title,
  searchLabel,
  noMatchesLabel,
  doneLabel,
  deacons,
  memberById,
  selectedPersonId,
  onSelect,
  clearOption,
  onSelectClear,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  searchLabel: string;
  noMatchesLabel: string;
  doneLabel: string;
  deacons: readonly DutyCandidate[];
  memberById: Map<string, Member>;
  selectedPersonId: string | null;
  onSelect: (deacon: DutyCandidate) => void;
  clearOption?: ClearOption;
  onSelectClear?: () => void;
}) {
  const { palette } = useAppearance();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const filtered = needle ? deacons.filter((deacon) => deacon.name.toLocaleLowerCase().includes(needle)) : deacons;

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: palette.background }]}>
        <View style={[styles.sheetHeader, { borderBottomColor: palette.line }]}>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: palette.text }]}>{title}</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onClose} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
            <Text style={[styles.doneText, { color: palette.accent }]}>{doneLabel}</Text>
          </Pressable>
        </View>
        <View style={[styles.searchField, { backgroundColor: palette.subtle }]}>
          <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="search-outline" size={20} />
          <TextInput
            accessibilityLabel={searchLabel}
            autoCapitalize="none"
            autoFocus
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder={searchLabel}
            placeholderTextColor={palette.secondaryText}
            style={[styles.searchInput, { color: palette.text }]}
            value={query}
          />
        </View>
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          {clearOption && !query ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSelectClear}
              style={({ pressed }) => [styles.row, { backgroundColor: palette.surface, borderColor: palette.line }, pressed && styles.pressed]}
            >
              <View style={[styles.clearIcon, { backgroundColor: palette.subtle }]}>
                <Ionicons color={palette.accent} name="people-outline" size={20} />
              </View>
              <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{clearOption.label}</Text>
              {clearOption.selected ? <Ionicons color={palette.accent} name="checkmark" size={20} /> : null}
            </Pressable>
          ) : null}
          {filtered.length === 0 ? (
            <Text style={[styles.noMatches, { color: palette.secondaryText }]}>{noMatchesLabel}</Text>
          ) : (
            filtered.map((deacon) => {
              const member = memberById.get(deacon.personId);
              const selected = deacon.personId === selectedPersonId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={deacon.personId}
                  onPress={() => onSelect(deacon)}
                  style={({ pressed }) => [styles.row, { backgroundColor: palette.surface, borderColor: palette.line }, pressed && styles.pressed]}
                >
                  <ProfileAvatar name={deacon.name} size={46} source={member?.avatar} />
                  <Text numberOfLines={1} style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{deacon.name}</Text>
                  {selected ? <Ionicons color={palette.accent} name="checkmark" size={20} /> : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  sheetHeader: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 58, paddingHorizontal: 20 },
  sheetTitle: { flex: 1, fontSize: 20, fontWeight: "700" },
  doneButton: { alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 },
  doneText: { fontSize: 17, fontWeight: "600" },
  searchField: { alignItems: "center", borderRadius: 14, flexDirection: "row", gap: 10, margin: 20, minHeight: 46, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 11 },
  sheetContent: { gap: 10, paddingBottom: 40, paddingHorizontal: 20 },
  pressed: { opacity: 0.72 },
  row: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 11, minHeight: 70, padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  clearIcon: { alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  noMatches: { fontSize: 14, paddingTop: 20, textAlign: "center" },
});
