import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { memberCsvMaxBytes } from "../../../supabase/functions/_shared/member-csv";

export async function pickMemberCsv(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if (!asset.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
    if ((asset.size ?? file.size) > memberCsvMaxBytes) throw new Error("File must be 2 MB or smaller.");
    return { name: asset.name, text: await file.text() };
  } finally {
    // Picker copied this file to the application cache. Do not retain private CSVs.
    if (file.exists) file.delete();
  }
}
