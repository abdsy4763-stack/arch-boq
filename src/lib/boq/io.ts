import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { z } from "zod";

export async function downloadBinary(
  filename: string,
  data: Uint8Array,
  mimeType: string
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = Buffer.from(data).toString("base64");
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        url: savedFile.uri,
      });
    } catch (err) {
      console.error("Native export failed:", err);
    }
  } else {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const ProjectBackupSchema = z.object({
  version: z.number().default(2),
  blocks: z.array(z.any()).default([]),
  patches: z.record(z.any()).optional().default({}),
  customItems: z.array(z.any()).optional().default([]),
  hiddenCodes: z.array(z.string()).optional().default([]),
  wasteOverrides: z.record(z.number()).optional().default({}),
  formulaDefinitions: z.array(z.any()).optional().default([]),
  finishDefinitions: z.array(z.any()).optional().default([]),
  reportSettings: z.record(z.any()).optional().default({}),
}).passthrough();

export function parseAndValidateBackup(jsonString: string) {
  try {
    const parsed = JSON.parse(jsonString);
    const validated = ProjectBackupSchema.parse(parsed);
    return { success: true, data: validated, error: null };
  } catch (err) {
    console.error("Backup validation failed:", err);
    return { success: false, data: null, error: "الملف تالف أو غير متوافق مع بنية المشروع." };
  }
}
