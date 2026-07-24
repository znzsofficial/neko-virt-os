import { Icon } from "@iconify-icon/react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { downloadBlob } from "../downloadStore";
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

function stampFilename(ext: string) {
  return `qr-code-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
}

export function QrToolApp() {
  const [qrText, setQrText] = useState("https://os.nekolaska.vip");
  const [decodedText, setDecodedText] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [generatorError, setGeneratorError] = useState(false);
  const [QRCodeSVG, setQRCodeSVG] = useState<QrCodeSvgComponent | null>(null);
  const mountedRef = useRef(true);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const encodedValue = qrText.trim();
  const canExport = Boolean(encodedValue && QRCodeSVG && !generatorError);

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
      addNotification({ title: t("copiedToken"), message: t("qrCopyResult"), type: "success", category: "apps", appId: "qr-tool" });
    } catch {
      addNotification({ title: t("copyFailed"), message: t("copyFailedMessage"), type: "error", category: "apps", appId: "qr-tool" });
    }
  }

  function saveDecodedText() {
    if (!decodedText) return;
    const blob = new Blob([decodedText], { type: "text/plain;charset=utf-8" });
    const filename = `qr-result-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    downloadBlob({
      blob,
      name: filename,
      source: t("appQrTool"),
      mimeType: "text/plain",
    });
  }

  function getPreviewSvg(): SVGSVGElement | null {
    return previewRef.current?.querySelector("svg") ?? null;
  }

  function exportGeneratedSvg() {
    const svg = getPreviewSvg();
    if (!svg) {
      addNotification({ title: t("qrExportFailed"), message: t("qrGeneratorUnavailable"), type: "error", category: "apps", appId: "qr-tool" });
      return;
    }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const markup = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob({
      blob,
      name: stampFilename("svg"),
      source: t("appQrTool"),
      mimeType: "image/svg+xml",
    });
    addNotification({ title: t("qrExported"), message: t("qrExportSvg"), type: "success", category: "apps", appId: "qr-tool" });
  }

  function exportGeneratedPng() {
    const svg = getPreviewSvg();
    if (!svg) {
      addNotification({ title: t("qrExportFailed"), message: t("qrGeneratorUnavailable"), type: "error", category: "apps", appId: "qr-tool" });
      return;
    }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const width = Number(clone.getAttribute("width") || 220);
    const height = Number(clone.getAttribute("height") || 220);
    const scale = 2;
    const markup = new XMLSerializer().serializeToString(clone);
    const svgUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(svgUrl);
          if (!blob) {
            addNotification({ title: t("qrExportFailed"), message: t("qrExportFailed"), type: "error", category: "apps", appId: "qr-tool" });
            return;
          }
          downloadBlob({
            blob,
            name: stampFilename("png"),
            source: t("appQrTool"),
            mimeType: "image/png",
          });
          addNotification({ title: t("qrExported"), message: t("qrExportPng"), type: "success", category: "apps", appId: "qr-tool" });
        }, "image/png");
      } catch {
        URL.revokeObjectURL(svgUrl);
        addNotification({ title: t("qrExportFailed"), message: t("qrExportFailed"), type: "error", category: "apps", appId: "qr-tool" });
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      addNotification({ title: t("qrExportFailed"), message: t("qrExportFailed"), type: "error", category: "apps", appId: "qr-tool" });
    };
    image.src = svgUrl;
  }

  return (
    <div className="qr-tool-app">
      <section className="qr-panel qr-generate-panel">
        <header><h2>{t("qrGenerateTitle")}</h2></header>
        <label className="qr-field">
          <span>{t("qrText")}</span>
          <textarea value={qrText} onChange={(event) => setQrText(event.target.value)} placeholder={t("qrTextPlaceholder")} spellCheck="false" />
        </label>
        <div className="qr-preview-box" ref={previewRef}>
          {generatorError ? <div className="empty-state compact"><p>{t("qrGeneratorUnavailable")}</p></div> : encodedValue && QRCodeSVG ? <QRCodeSVG value={encodedValue} size={220} level="M" bgColor="#ffffff" fgColor="#111111" marginSize={3} title={t("qrGenerateTitle")} /> : <div className="empty-state compact"><p>{t("qrTextPlaceholder")}</p></div>}
        </div>
        <div className="qr-export-actions toolbar-actions">
          <button className="button-ghost" type="button" disabled={!canExport} onClick={exportGeneratedSvg}>
            <Icon icon="solar:code-file-bold-duotone" width={16} height={16} />
            {t("qrExportSvg")}
          </button>
          <button className="button-primary" type="button" disabled={!canExport} onClick={exportGeneratedPng}>
            <Icon icon="solar:gallery-download-bold-duotone" width={16} height={16} />
            {t("qrExportPng")}
          </button>
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
