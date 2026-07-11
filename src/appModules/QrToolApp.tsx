import { Icon } from "@iconify-icon/react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useDownloadStore } from "../downloadStore";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";

type QrCodeSvgComponent = ComponentType<{
  value: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  bgColor?: string;
  fgColor?: string;
  marginSize?: number;
  title?: string;
}>;

export function QrToolApp() {
  const [qrText, setQrText] = useState("https://os.nekolaska.vip");
  const [decodedText, setDecodedText] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [generatorError, setGeneratorError] = useState(false);
  const [QRCodeSVG, setQRCodeSVG] = useState<QrCodeSvgComponent | null>(null);
  const mountedRef = useRef(true);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const addDownload = useDownloadStore((state) => state.addDownload);
  const encodedValue = qrText.trim();

  useEffect(() => {
    let mounted = true;
    void import("qrcode.react").then((module) => {
      if (mounted) setQRCodeSVG(() => module.QRCodeSVG);
    }).catch(() => {
      if (mounted) setGeneratorError(true);
    });
    return () => {
      mounted = false;
      mountedRef.current = false;
    };
  }, []);

  async function readQrFromFile(file: File | null) {
    if (!file) return;
    setReading(true);
    setDecodedText(null);
    let bitmap: ImageBitmap | null = null;
    try {
      const { default: jsQR } = await import("jsqr");
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas unavailable");
      context.drawImage(bitmap, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (mountedRef.current) setDecodedText(code?.data || t("qrNoCodeFound"));
    } catch {
      if (mountedRef.current) setDecodedText(t("qrReadFailed"));
    } finally {
      bitmap?.close();
      if (mountedRef.current) setReading(false);
    }
  }

  async function copyDecodedText() {
    if (!decodedText) return;
    try {
      await navigator.clipboard.writeText(decodedText);
      addNotification({ title: t("copiedToken"), message: t("qrCopyResult"), type: "success" });
    } catch {
      addNotification({ title: t("copyFailed"), message: t("copyFailedMessage"), type: "error" });
    }
  }

  function saveDecodedText() {
    if (!decodedText) return;
    const blob = new Blob([decodedText], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const filename = `qr-result-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    addDownload({ name: filename, source: t("appQrTool"), size: blob.size, mimeType: "text/plain", url: downloadUrl });
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    link.click();
  }

  return (
    <div className="qr-tool-app">
      <section className="qr-panel qr-generate-panel">
        <header><h2>{t("qrGenerateTitle")}</h2></header>
        <label className="qr-field">
          <span>{t("qrText")}</span>
          <textarea value={qrText} onChange={(event) => setQrText(event.target.value)} placeholder={t("qrTextPlaceholder")} spellCheck="false" />
        </label>
        <div className="qr-preview-box">
          {generatorError ? <div className="empty-state compact"><p>{t("qrGeneratorUnavailable")}</p></div> : encodedValue && QRCodeSVG ? <QRCodeSVG value={encodedValue} size={220} level="M" bgColor="#ffffff" fgColor="#111111" marginSize={3} title={t("qrGenerateTitle")} /> : <div className="empty-state compact"><p>{t("qrTextPlaceholder")}</p></div>}
        </div>
      </section>

      <section className="qr-panel qr-read-panel">
        <header><h2>{t("qrReadTitle")}</h2></header>
        <label className="qr-upload">
          <Icon icon="solar:upload-square-bold-duotone" width={30} height={30} />
          <span>{reading ? t("apiSending") : t("qrUploadImage")}</span>
          <input type="file" accept="image/*" onChange={(event) => void readQrFromFile(event.target.files?.[0] ?? null)} />
        </label>
        <div className="qr-result">
          <div className="qr-result-heading">
            <h3>{t("qrDecodedText")}</h3>
            <div className="toolbar-actions">
              <button className="button-ghost" type="button" disabled={!decodedText} onClick={() => void copyDecodedText()}>{t("qrCopyResult")}</button>
              <button className="button-ghost" type="button" disabled={!decodedText} onClick={saveDecodedText}>{t("downloadsSaveAgain")}</button>
            </div>
          </div>
          <pre>{decodedText ?? t("qrNoCodeFound")}</pre>
        </div>
      </section>
    </div>
  );
}
