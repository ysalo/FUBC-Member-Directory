import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { groupFileMaxBytes } from "./group-import";

export async function pickGroupFile(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if (!asset.name.toLowerCase().endsWith(".json")) throw new Error("Choose a .json file.");
    if ((asset.size ?? file.size) > groupFileMaxBytes) throw new Error("File must be 256 KB or smaller.");
    return { name: asset.name, text: await file.text() };
  } finally {
    // Picker copied this file to the application cache. Do not retain private group files.
    if (file.exists) file.delete();
  }
}
