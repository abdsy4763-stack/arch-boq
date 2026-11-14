import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// تم نقل هذه الدالة من engine.ts لتنظيف التبعيات
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
