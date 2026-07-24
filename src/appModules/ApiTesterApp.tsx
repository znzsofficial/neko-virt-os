import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../downloadStore";
import { useLanguageStore } from "../languageStore";

type ApiTestMethod = "GET" | "POST";
type ApiTestResult = {
  status: number;
  statusText: string;
  elapsedMs: number;
  headers: string;
  body: string;
};

export function ApiTesterApp() {
  const [method, setMethod] = useState<ApiTestMethod>("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/posts/1");
  const [body, setBody] = useState(`{\n  "title": "hello",\n  "body": "from NekoVirtOS",\n  "userId": 1\n}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiTestResult | null>(null);
  const activeRequestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      activeRequestRef.current?.controller.abort();
    };
  }, []);

  async function sendRequest() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    let requestUrl: URL;
    try {
      requestUrl = new URL(url.includes("://") ? url : `https://${url}`);
    } catch {
      setLoading(false);
      setError(t("apiInvalidUrl"));
      return;
    }

    activeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    activeRequestRef.current = { controller, id: requestId };
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const started = performance.now();

    try {
      const response = await fetch(requestUrl.toString(), {
        method,
        headers: method === "POST" ? { Accept: "application/json, text/plain, */*", "Content-Type": "application/json" } : { Accept: "application/json, text/plain, */*" },
        body: method === "POST" ? body : undefined,
        signal: controller.signal,
      });
      const responseText = await response.text();
      if (!mountedRef.current || activeRequestRef.current?.id !== requestId) return;
      setResult({
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Math.round(performance.now() - started),
        headers: Array.from(response.headers.entries()).map(([key, value]) => `${key}: ${value}`).join("\n") || "(empty)",
        body: formatApiResponseBody(responseText, response.headers.get("content-type")),
      });
    } catch (requestError) {
      if (!mountedRef.current || activeRequestRef.current?.id !== requestId) return;
      setError(requestError instanceof DOMException && requestError.name === "AbortError" ? t("apiRequestTimedOut") : t("apiRequestFailed"));
    } finally {
      window.clearTimeout(timeout);
      if (mountedRef.current && activeRequestRef.current?.id === requestId) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function saveResponse() {
    if (!result) return;
    const payload = JSON.stringify(
      {
        url,
        method,
        status: result.status,
        statusText: result.statusText,
        elapsedMs: result.elapsedMs,
        headers: result.headers,
        body: result.body,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const filename = `api-response-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    downloadBlob({
      blob,
      name: filename,
      source: t("appApiTester"),
      mimeType: "application/json",
    });
  }

  return (
    <div className="api-tester-app">
      <form className="api-request-panel" onSubmit={(event) => { event.preventDefault(); void sendRequest(); }}>
        <label className="api-field api-url-field">
          <span>{t("apiUrl")}</span>
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com/items" spellCheck="false" />
        </label>
        <label className="api-field">
          <span>{t("apiMethod")}</span>
          <select value={method} onChange={(event) => setMethod(event.target.value as ApiTestMethod)}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </label>
        <button className="button-primary" type="submit" disabled={loading}>{loading ? t("apiSending") : t("apiSend")}</button>
        <label className="api-field api-body-field">
          <span>{t("apiBody")}</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} disabled={method === "GET"} spellCheck="false" />
        </label>
      </form>

      <section className="api-response-panel">
        <div className="api-response-heading">
          <h2>{t("apiResponse")}</h2>
          <div className="toolbar-actions">
            {result ? <span className={clsx("api-status", result.status >= 200 && result.status < 300 && "is-ok")}>{result.status} {result.statusText} · {result.elapsedMs}ms</span> : null}
            <button type="button" className="button-ghost" disabled={!result} onClick={saveResponse}>{t("downloadsSaveAgain")}</button>
          </div>
        </div>
        {error ? <div className="empty-state compact"><p>{error}</p></div> : null}
        {!error && !result ? <div className="empty-state compact"><p>{t("apiNoResponse")}</p></div> : null}
        {result ? (
          <div className="api-response-grid">
            <article>
              <h3>{t("apiHeaders")}</h3>
              <pre>{result.headers}</pre>
            </article>
            <article>
              <h3>{t("apiBodyResponse")}</h3>
              <pre>{result.body}</pre>
            </article>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatApiResponseBody(text: string, contentType: string | null) {
  const value = text.length > 20000 ? `${text.slice(0, 20000)}\n... truncated ...` : text;
  if (!value) return "(empty)";
  if (!contentType?.includes("json")) return value;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
