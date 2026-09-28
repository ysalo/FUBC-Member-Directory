import { useEffect, useRef, useState } from "react";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Alert } from "@/features/platform/alert";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useBrowserExitWarning } from "./use-browser-exit-warning";

/** Keeps drafts in memory and guards route removal. A successful save can call allowLeave. */
export function useUnsavedChanges(dirty: boolean) {
  const navigation = useNavigation();
  const { locale } = useLocalization();
  const allowed = useRef(false);
  const [permitted, setPermitted] = useState(false);
  const labels = locale === "uk"
    ? { title: "Незбережені зміни", detail: "Вийти без збереження змін?", stay: "Продовжити редагування", discard: "Вийти без збереження" }
    : { title: "Unsaved changes", detail: "Leave without saving your changes?", stay: "Keep editing", discard: "Discard changes" };

  useEffect(() => { if (!dirty) { allowed.current = false; setPermitted(false); } }, [dirty]);

  usePreventRemove(dirty && !permitted, ({ data }) => {
    if (allowed.current) {
      // The first action may arrive before the permitted render has committed.
      setTimeout(() => navigation.dispatch(data.action), 0);
      return;
    }
    Alert.alert(labels.title, labels.detail, [
      { text: labels.stay, style: "cancel" },
      { text: labels.discard, style: "destructive", onPress: () => {
        allowed.current = true;
        setPermitted(true);
        setTimeout(() => navigation.dispatch(data.action), 0);
      } },
    ]);
  });

  useBrowserExitWarning(dirty, allowed);

  return {
    allowLeave() { allowed.current = true; setPermitted(true); },
    confirmLeave(leave: () => void) {
      if (!dirty) { leave(); return; }
      Alert.alert(labels.title, labels.detail, [
        { text: labels.stay, style: "cancel" },
        { text: labels.discard, style: "destructive", onPress: () => { allowed.current = true; setPermitted(true); setTimeout(leave, 0); } },
      ]);
    },
  };
}
