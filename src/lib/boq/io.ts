import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { z } from "zod";

/**
 * تحويل بايتات إلى Base64 بدون Buffer (غير موجود داخل WebView في أندرويد).
 * يعمل على دفعات حتى لا يتجاوز String.fromCharCode حدّ عدد المعاملات في الملفات الكبيرة.
 */
export function bytesToBase64(data: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < data.length; i += CHUNK) {
    binary += String.fromCharCode(...data.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** أسماء الملفات تُستخدم كمسار على الجهاز: نزيل المحارف غير المسموحة ونمنع تجاوز المجلد. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim();
  return cleaned || "export";
}

export async function downloadBinary(
  filename: string,
  data: Uint8Array,
  mimeType: string
): Promise<void> {
  const safeName = safeFileName(filename);
  if (Capacitor.isNativePlatform()) {
    try {
      const savedFile = await Filesystem.writeFile({
        path: safeName,
        data: bytesToBase64(data),
        directory: Directory.Cache,
      });
      await Share.share({
        title: safeName,
        url: savedFile.uri,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // إغلاق نافذة المشاركة من المستخدم ليس خطأ.
      if (/cancel/i.test(message)) return;
      console.error("Native export failed:", err);
      window.alert(`تعذّر تصدير الملف «${safeName}».\n${message}`);
    }
  } else {
    const blob = new Blob([data as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
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
