import { memberCsvMaxBytes } from "../../../supabase/functions/_shared/member-csv";

export async function pickMemberCsv(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.style.display = "none";
    document.body.appendChild(input);
    input.oncancel = () => { input.remove(); resolve(null); };
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
        if (file.size > memberCsvMaxBytes) throw new Error("File must be 2 MB or smaller.");
        resolve({ name: file.name, text: await file.text() });
      } catch (cause) { reject(cause); }
      finally { input.remove(); }
    };
    input.click();
  });
}
