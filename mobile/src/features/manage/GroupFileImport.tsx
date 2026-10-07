import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import type { GroupManagementState } from "./model";
import {
  type GroupFile,
  groupPersonName,
  groupPersonBirthDate,
  matchGroupFile,
  normalizeGroupName,
  parseGroupFile,
} from "./group-import";
import { pickGroupFile } from "./pick-group-file";

const labels = {
  en: {
    choose: "Upload group file",
    detail:
      "Choose a JSON group file with verify empty or absent. Match every name to an existing person, then review the group before saving. Missing people are never created.",
    resolve: "Choose a match",
    search: "Search existing people",
    apply: "Use these assignments",
    duplicate: "Each person must be assigned only once.",
    failed: "Could not read the group file.",
    matched: "Matched",
    pending: "Needs a match",
    replace: "Choosing a file replaces this import draft.",
    born: "Born",
    unknownBirth: "Birth date unavailable",
  },
  uk: {
    choose: "Завантажити файл групи",
    detail:
      "Оберіть JSON-файл групи з порожнім або відсутнім verify. Зіставте кожне ім’я з наявним учасником і перевірте групу перед збереженням. Нових учасників не буде створено.",
    resolve: "Оберіть відповідність",
    search: "Пошук наявних учасників",
    apply: "Використати ці призначення",
    duplicate: "Кожного учасника можна призначити лише один раз.",
    failed: "Не вдалося прочитати файл групи.",
    matched: "Зіставлено",
    pending: "Потрібне зіставлення",
    replace: "Вибір файлу замінює чернетку імпорту.",
    born: "Дата народження",
    unknownBirth: "Дата народження невідома",
  },
};
export function GroupFileImport({
  data,
  disabled,
  onPending,
  onApply,
}: {
  data: GroupManagementState;
  disabled: boolean;
  onPending: (pending: boolean) => void;
  onApply: (file: GroupFile, deacons: string[], members: string[]) => void;
}) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const [file, setFile] = useState<GroupFile | null>(null);
  const [ids, setIds] = useState<(string | null)[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [candidatePage, setCandidatePage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function choose() {
    setBusy(true);
    setError(null);
    onPending(true);
    try {
      const picked = await pickGroupFile();
      if (!picked) {
        onPending(Boolean(file));
        return;
      }
      const parsed = parseGroupFile(picked.text);
      setFile(parsed);
      setIds(matchGroupFile(parsed, data));
      setEditing(null);
      setQuery("");
      setCandidatePage(0);
    } catch (cause) {
      onPending(Boolean(file));
      setError(cause instanceof Error ? cause.message : copy.failed);
    } finally {
      setBusy(false);
    }
  }
  const complete =
    file && ids.every(Boolean) && new Set(ids).size === ids.length;
  const button = {
    backgroundColor: palette.accent,
    borderRadius: 14,
    padding: 14,
    alignItems: "center" as const,
  };
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        disabled={busy || disabled}
        onPress={() => void choose()}
        style={[button, (busy || disabled) && { opacity: 0.5 }]}
      >
        <Text style={{ color: "#FFF", fontWeight: "700" }}>{copy.choose}</Text>
      </Pressable>
      <Text style={{ color: palette.secondaryText }}>
        {copy.detail} {file ? copy.replace : ""}
      </Text>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: palette.danger }}
        >
          {error}
        </Text>
      ) : null}
      {file ? (
        <>
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            {file.name} · {file.deacons.length} / {file.members.length}
          </Text>
          {[...file.deacons, ...file.members].map((person, index) => {
            const name = groupPersonName(person),
              birthDate = groupPersonBirthDate(person);
            const people =
              index < file.deacons.length ? data.deacons : data.members;
            const selected = people.find(
              (person) => person.personId === ids[index],
            );
            const candidates = people.filter(
              (person) =>
                !query.trim() ||
                normalizeGroupName(person.importName ?? person.name).includes(
                  normalizeGroupName(query),
                ),
            );
            return (
              <View
                key={index}
                style={{
                  gap: 6,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: palette.line,
                  borderRadius: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setEditing(editing === index ? null : index);
                    setQuery("");
                    setCandidatePage(0);
                  }}
                >
                  <Text style={{ color: palette.text }}>
                    {index < file.deacons.length
                      ? locale === "uk"
                        ? "Диякон: "
                        : "Deacon: "
                      : ""}
                    {name}
                    {birthDate ? ` · ${copy.born}: ${birthDate}` : ""}
                  </Text>
                  <Text
                    style={{
                      color: selected ? palette.secondaryText : palette.danger,
                    }}
                  >
                    {selected
                      ? `${copy.matched}: ${selected.importName ?? selected.name} · ${selected.birthDate ? `${copy.born}: ${selected.birthDate}` : copy.unknownBirth}`
                      : copy.pending}{" "}
                    · {copy.resolve}
                  </Text>
                </Pressable>
                {editing === index ? (
                  <>
                    <TextInput
                      accessibilityLabel={copy.search}
                      placeholder={copy.search}
                      placeholderTextColor={palette.secondaryText}
                      value={query}
                      onChangeText={(value) => {
                        setQuery(value);
                        setCandidatePage(0);
                      }}
                      style={{
                        color: palette.text,
                        borderWidth: 1,
                        borderColor: palette.line,
                        borderRadius: 10,
                        padding: 10,
                      }}
                    />
                    {candidates
                      .slice(candidatePage * 25, (candidatePage + 1) * 25)
                      .map((person) => (
                        <Pressable
                          key={person.personId}
                          accessibilityRole="button"
                          disabled={ids.some(
                            (id, slot) =>
                              slot !== index && id === person.personId,
                          )}
                          onPress={() => {
                            setIds((current) =>
                              current.map((id, slot) =>
                                slot === index ? person.personId : id,
                              ),
                            );
                            setEditing(null);
                          }}
                          style={{
                            padding: 10,
                            opacity: ids.some(
                              (id, slot) =>
                                slot !== index && id === person.personId,
                            )
                              ? 0.4
                              : 1,
                          }}
                        >
                          <Text style={{ color: palette.text }}>
                            {person.importName ?? person.name} ·{" "}
                            {person.birthDate
                              ? `${copy.born}: ${person.birthDate}`
                              : copy.unknownBirth}
                          </Text>
                        </Pressable>
                      ))}
                    {candidates.length > 25 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          disabled={candidatePage === 0}
                          onPress={() => setCandidatePage((page) => page - 1)}
                          style={{
                            minHeight: 44,
                            justifyContent: "center",
                            opacity: candidatePage === 0 ? 0.5 : 1,
                          }}
                        >
                          <Text style={{ color: palette.accent }}>
                            {locale === "uk" ? "Попередні" : "Previous"}
                          </Text>
                        </Pressable>
                        <Text
                          style={{
                            color: palette.secondaryText,
                            paddingVertical: 12,
                          }}
                        >
                          {candidatePage * 25 + 1}–
                          {Math.min(
                            (candidatePage + 1) * 25,
                            candidates.length,
                          )}{" "}
                          / {candidates.length}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          disabled={
                            (candidatePage + 1) * 25 >= candidates.length
                          }
                          onPress={() => setCandidatePage((page) => page + 1)}
                          style={{
                            minHeight: 44,
                            justifyContent: "center",
                            opacity:
                              (candidatePage + 1) * 25 >= candidates.length
                                ? 0.5
                                : 1,
                          }}
                        >
                          <Text style={{ color: palette.accent }}>
                            {locale === "uk" ? "Наступні" : "Next"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            );
          })}
          {ids.every(Boolean) && new Set(ids).size !== ids.length ? (
            <Text style={{ color: palette.danger }}>{copy.duplicate}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !complete }}
            disabled={!complete}
            onPress={() => {
              if (complete) {
                onApply(
                  file,
                  ids.slice(0, file.deacons.length) as string[],
                  ids.slice(file.deacons.length) as string[],
                );
                setFile(null);
                onPending(false);
              }
            }}
            style={[button, !complete && { opacity: 0.5 }]}
          >
            <Text style={{ color: "#FFF", fontWeight: "700" }}>
              {copy.apply}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
