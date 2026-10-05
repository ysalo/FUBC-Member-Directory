import { groupFileMaxBytes } from "./group-import";

export async function pickGroupFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.oncancel = () => { input.remove(); resolve(null); };
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Choose a .json file.");
        if (file.size > groupFileMaxBytes) throw new Error("File must be 256 KB or smaller.");
        resolve({ name: file.name, text: await file.text() });
      } catch (cause) { reject(cause); }
      finally { input.remove(); }
    };
    input.click();
  });
}
