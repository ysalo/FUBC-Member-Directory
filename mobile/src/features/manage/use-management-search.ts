import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

/** Keep the committed search in the URL and debounce only typed searches. */
export function useManagementSearch() {
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const initial = typeof params.q === "string" ? params.q : "";
  const [query, setQuery] = useState(initial);
  const [committedQuery, setCommittedQuery] = useState(initial);
  const router = useRouter();
  useEffect(() => {
    setQuery(initial);
    setCommittedQuery(initial);
  }, [initial]);
  useEffect(() => {
    if (query === committedQuery) return;
    const commit = () => {
      const next = query.trim().slice(0, 120);
      setCommittedQuery(next);
      router.setParams({ q: next || undefined });
    };
    if (!query.trim()) {
      commit();
      return;
    }
    const timer = setTimeout(commit, 250);
    return () => clearTimeout(timer);
  }, [query, committedQuery, router]);
  return { query, setQuery, committedQuery };
}
