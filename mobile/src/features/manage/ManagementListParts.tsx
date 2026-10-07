import { Link, type Href } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";

export function ManagementLink({
  href,
  children,
  label,
}: {
  href: Href;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="link"
        style={({ pressed }) => [ui.link, pressed && { opacity: 0.7 }]}
      >
        {children}
      </Pressable>
    </Link>
  );
}
export function ManagementSearch({
  query,
  onChange,
  label,
  disabled = false,
}: {
  query: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  return (
    <View
      style={[
        ui.search,
        { backgroundColor: palette.surface, borderColor: palette.line },
      ]}
    >
      <Ionicons
        accessibilityElementsHidden
        importantForAccessibility="no"
        color={palette.secondaryText}
        name="search"
        size={20}
      />
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
        maxLength={120}
        onChangeText={onChange}
        placeholder={`${label}…`}
        placeholderTextColor={palette.secondaryText}
        returnKeyType="search"
        style={[ui.searchInput, { color: palette.text }]}
        value={query}
      />
      {query ? (
        <Pressable
          accessibilityLabel={
            locale === "uk" ? "Очистити пошук" : "Clear search"
          }
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onChange("")}
          style={ui.iconButton}
        >
          <Ionicons
            color={palette.secondaryText}
            name="close-circle"
            size={21}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
export function ManagementFeedback({
  error,
  retry,
  loading,
}: {
  error?: string | null;
  retry?: () => void;
  loading?: boolean;
}) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  if (error)
    return (
      <View style={ui.feedback}>
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: palette.danger, flex: 1 }}
        >
          {error}
        </Text>
        {retry ? (
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={ui.smallButton}
          >
            <Text style={{ color: palette.accent, fontWeight: "700" }}>
              {locale === "uk" ? "Спробувати ще раз" : "Try again"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  return loading ? (
    <View accessibilityLiveRegion="polite" style={ui.feedback}>
      <ActivityIndicator color={palette.accent} />
      <Text style={{ color: palette.secondaryText }}>
        {locale === "uk" ? "Завантаження…" : "Loading…"}
      </Text>
    </View>
  ) : null;
}
export function ManagementListFooter({
  loading,
  error,
  hasMore,
  count,
  total,
  append,
  retry,
}: {
  loading: string | null;
  error: string | null;
  hasMore: boolean;
  count: number;
  total: number;
  append: () => void;
  retry: () => void;
}) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  return (
    <View style={ui.footer}>
      <ManagementFeedback
        error={error}
        loading={loading === "append"}
        retry={retry}
      />
      {!loading && !error && hasMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={append}
          style={[
            ui.more,
            { borderColor: palette.line, backgroundColor: palette.surface },
          ]}
        >
          <Text style={{ color: palette.accent, fontWeight: "700" }}>
            {locale === "uk" ? "Завантажити ще" : "Load more"}
          </Text>
        </Pressable>
      ) : null}
      {count ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: palette.secondaryText, textAlign: "center" }}
        >
          {locale === "uk"
            ? `Показано ${count} з ${total}${hasMore ? "" : ". Усі результати завантажено."}`
            : `${count} of ${total}${hasMore ? "" : " · All results loaded"}`}
        </Text>
      ) : null}
    </View>
  );
}
export const ui = StyleSheet.create({
  root: { flex: 1 },
  width: { width: "100%", maxWidth: 1120, alignSelf: "center" },
  toolbar: {
    padding: 18,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  title: { fontSize: 28, fontWeight: "800", flexShrink: 1 },
  detail: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 19, fontWeight: "700" },
  link: { minHeight: 44, justifyContent: "center" },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  iconButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  feedback: {
    gap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingVertical: 8,
  },
  footer: { gap: 12, paddingVertical: 18, paddingHorizontal: 18 },
  more: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 17, fontWeight: "700", lineHeight: 23 },
  empty: { padding: 28, gap: 8 },
  content: { paddingBottom: 24 },
});
