const cyrillicLookalikes: Record<string, string> = { A: "А", B: "В", C: "С", E: "Е", H: "Н", I: "І", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У", a: "а", c: "с", e: "е", i: "і", o: "о", p: "р", x: "х", y: "у" };
type SearchableMember = { name: string; first_name?: string; last_name?: string; patronymic?: string | null };

/** Ignore case, accents, repeated whitespace and apostrophe/hyphen variants. */
export function normalizeMemberSearch(value: string): string {
  const repaired = value.replace(/\S+/gu, word => /[\u0400-\u04ff]/u.test(word) ? word.replace(/[A-Za-z]/g, letter => cyrillicLookalikes[letter] ?? letter) : word);
  return repaired.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase()
    .replace(/[’'ʼ`-]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Match whole name tokens or prefixes, in either name order. */
export function memberSearchScore(member: SearchableMember, query: string): number | null {
  const needles = normalizeMemberSearch(query).split(" ").filter(Boolean);
  if (!needles.length) return 0;
  const words = normalizeMemberSearch([member.first_name ?? member.name, member.last_name ?? "", member.patronymic ?? ""].join(" ")).split(" ").filter(Boolean);
  if (needles.length > words.length) return null;
  function match(index: number, used: Set<number>): number | null {
    if (index === needles.length) return 0;
    const needle = needles[index];
    let best: number | null = null;
    words.forEach((word, wordIndex) => {
      if (used.has(wordIndex)) return;
      const score = word === needle ? 0 : word.startsWith(needle) ? 1 : null;
      if (score === null) return;
      const rest = match(index + 1, new Set([...used, wordIndex]));
      if (rest !== null && (best === null || score + rest < best)) best = score + rest;
    });
    return best;
  }
  return match(0, new Set());
}

/** Exact names precede prefixes; ties retain the caller's surname order. */
export function searchMembers<T>(items: T[], query: string, name: (item: T) => SearchableMember): T[] {
  if (!normalizeMemberSearch(query)) return items;
  return items.map((item, index) => ({ item, index, score: memberSearchScore(name(item), query) }))
    .filter((match): match is { item: T; index: number; score: number } => match.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(match => match.item);
}
