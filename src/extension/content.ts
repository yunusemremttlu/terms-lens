import { PageAgentCore } from "page-agent";
import { PageController, type BrowserState } from "@page-agent/page-controller";
import { analysisTask, extractVisibleText, looksLikeLegalDocument } from "../core/legal-page";
import { PAGE_AGENT_SYSTEM_INSTRUCTIONS, READ_ONLY_TOOL_OVERRIDES } from "../core/page-agent-policy";
import { buildEvidenceReport, parseModelAnalysis, type RiskReport } from "../core/report";

interface ProviderSettings {
  apiBaseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: string;
}

const ROOT_ID = "terms-lens-extension";
let panel: HTMLElement | undefined;
let panelRoot: ShadowRoot | undefined;
let activeAnalysis = false;
let dismissed = false;
let scanTimer: number | undefined;

function isProviderSettings(value: ProviderSettings): value is Required<ProviderSettings> {
  return Boolean(value.apiBaseUrl && value.model && value.apiKey);
}

function ensurePanel(): HTMLElement {
  if (panel?.isConnected) return panel;

  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    panel = existing;
    return existing;
  }
  const host = document.createElement("div");
  host.id = ROOT_ID;
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:16px;right:16px;";
  const shadow = host.attachShadow({ mode: "closed" });
  panelRoot = shadow;
  shadow.innerHTML = `
    <style>
      :host{all:initial;color:#17202a;font:14px/1.5 system-ui,sans-serif}
      *{box-sizing:border-box}
      .card{width:min(390px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;
        padding:16px;background:#fff;border:1px solid #d5dce5;border-radius:12px;
        box-shadow:0 8px 32px #10182840}
      .top{display:flex;justify-content:space-between;align-items:center;gap:12px}
      h2{margin:0;font-size:17px}.close{border:0;background:transparent;font-size:20px;cursor:pointer}
      p{margin:9px 0}.meta,.legal{color:#526171;font-size:12px}
      .legal{padding:8px;background:#fff5da;border-radius:6px}
      button{padding:9px 12px;border:0;border-radius:6px;background:#175cd3;color:white;
        font-weight:650;cursor:pointer}
      button:disabled{opacity:.55;cursor:wait}
      .secondary{background:#eef4ff;color:#1849a9}
      .score{font-size:26px;font-weight:750}
      .risk{margin-top:10px;padding:11px;border:1px solid #e1e7ef;border-radius:8px}
      .risk h3{margin:0 0 6px;font-size:14px}
      blockquote{margin:7px 0;padding:7px 9px;border-left:3px solid #175cd3;background:#f5f8ff}
      .status{padding:9px;background:#f2f4f7;border-radius:6px}
      .warning{color:#9a3412}
      a{color:#175cd3;cursor:pointer}
    </style>
    <section class="card" aria-label="Terms Lens risk report">
      <div class="top"><h2>Terms Lens</h2><button class="close" aria-label="Kapat">×</button></div>
      <p class="meta">Sayfa metni seçtiğiniz LLM sağlayıcısına gönderilir.</p>
      <p class="legal"><strong>Hukuki tavsiye değildir.</strong> Sonuçlar yalnızca kaynakta doğrulanabilen maddeleri öne çıkarır.</p>
      <p class="status" role="status">Sözleşme metni kontrol ediliyor…</p>
      <div class="output"></div>
      <button class="analyze">Metni analiz et</button>
      <button class="settings secondary">Ayarları aç</button>
    </section>`;
  document.documentElement.appendChild(host);
  panel = host;

  const status = shadow.querySelector<HTMLElement>(".status")!;
  shadow.querySelector(".close")!.addEventListener("click", () => {
    dismissed = true;
    host.remove();
  });
  shadow.querySelector(".settings")!.addEventListener("click", () => chrome.runtime.openOptionsPage());
  shadow.querySelector(".analyze")!.addEventListener("click", () => {
    void analyzeCurrentPage(status, shadow.querySelector<HTMLElement>(".output")!, shadow.querySelector<HTMLButtonElement>(".analyze")!);
  });
  return host;
}

function shadowElements(): {
  status: HTMLElement;
  output: HTMLElement;
  analyze: HTMLButtonElement;
} | null {
  const root = panelRoot;
  if (!root) return null;
  const status = root.querySelector<HTMLElement>(".status");
  const output = root.querySelector<HTMLElement>(".output");
  const analyze = root.querySelector<HTMLButtonElement>(".analyze");
  return status && output && analyze ? { status, output, analyze } : null;
}

function getSourceText(): string {
  if (!document.body) return "";
  const mainContent = document.querySelector<HTMLElement>("main, article, [role='main']");
  return extractVisibleText(mainContent || document.body);
}

async function analyzeCurrentPage(
  status: HTMLElement,
  output: HTMLElement,
  button: HTMLButtonElement
): Promise<void> {
  if (activeAnalysis) return;
  const sourceText = getSourceText();
  if (sourceText.length < 350) {
    status.textContent = "Yeterli görünür metin bulunamadı. Sayfayı açıp ilgili metni görünür hale getirin.";
    return;
  }

  activeAnalysis = true;
  button.disabled = true;
  output.replaceChildren();
  status.textContent = "Page Agent metni okuyor; alıntılar ve JSON şeması ayrıca doğrulanacak…";
  try {
    const settings = await getSettings();
    if (!isProviderSettings(settings)) {
      status.textContent = "Önce ayarlardan kendi LLM sağlayıcınızı, modelinizi ve API anahtarınızı ekleyin.";
      return;
    }
    const result = await runPageAgent(settings, sourceText);
    const analysis = parseModelAnalysis(result);
    const report = buildEvidenceReport(analysis, sourceText);
    renderReport(output, report);
    status.textContent = report.citationRejections
      ? `${report.citationRejections} alıntı doğrulanamadı ve rapordan çıkarıldı.`
      : "Rapor hazır. Her risk maddesi kaynak metindeki alıntıyla doğrulandı.";
  } catch (error) {
    console.error("Terms Lens analysis failed:", error);
    status.textContent = error instanceof Error
      ? `Analiz tamamlanamadı: ${error.message}`
      : "Analiz tamamlanamadı; yapılandırılmış rapor üretilemedi.";
  } finally {
    activeAnalysis = false;
    button.disabled = false;
  }
}

async function getSettings(): Promise<ProviderSettings> {
  const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (settings?.error) throw new Error(settings.error);
  return settings as ProviderSettings;
}

async function runPageAgent(
  settings: Required<ProviderSettings>,
  sourceText: string
): Promise<string> {
  class SanitizedPageController extends PageController {
    override async getBrowserState(): Promise<BrowserState> {
      await super.getBrowserState();
      return {
        url: new URL(location.href).origin,
        title: "Legal document",
        header: "Legal document review.",
        content: "Page DOM omitted. Use only source text in the task.",
        footer: ""
      };
    }

    override async getCurrentUrl(): Promise<string> {
      return new URL(location.href).origin;
    }
  }

  const agent = new PageAgentCore({
    apiKey: "extension-proxy",
    baseURL: settings.apiBaseUrl.replace(/\/+$/, ""),
    model: settings.model,
    customFetch: extensionFetch,
    pageController: new SanitizedPageController({ enableMask: false, viewportExpansion: 0 }),
    customTools: READ_ONLY_TOOL_OVERRIDES,
    maxSteps: 2,
    stepDelay: 0,
    instructions: { system: PAGE_AGENT_SYSTEM_INSTRUCTIONS },
    transformPageContent: () => "Page DOM omitted. Use only source text in the task."
  });

  try {
    const result = await agent.execute(
      analysisTask(location.href, sourceText)
    );
    if (!result.success) throw new Error(result.data || "Page Agent görevi başarısız.");
    return result.data;
  } finally {
    agent.dispose();
  }
}

async function extensionFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  const body = typeof init?.body === "string" ? init.body : "";
  const result = await chrome.runtime.sendMessage({
    type: "PAGE_AGENT_REQUEST",
    request: { url, body }
  });
  if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
  if (!result || result.error) throw new Error(result?.error || "Model servisine ulaşılamadı.");
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers: { "Content-Type": "application/json" }
  });
}

function renderReport(container: HTMLElement, report: RiskReport): void {
  const heading = document.createElement("p");
  heading.className = "score";
  heading.textContent = `Risk skoru: ${report.riskScore}/100`;
  container.append(heading);

  const summary = document.createElement("p");
  summary.textContent = report.summary;
  container.append(summary);

  for (const item of report.risks) {
    const card = document.createElement("article");
    card.className = "risk";
    const title = document.createElement("h3");
    title.textContent = `${item.category.replaceAll("_", " ")} · ${item.severity.toUpperCase()}`;
    const quote = document.createElement("blockquote");
    quote.textContent = `“${item.quote}”`;
    const explanation = document.createElement("p");
    explanation.textContent = item.explanation;
    const action = document.createElement("p");
    action.textContent = `Sorulacak soru: ${item.action}`;
    card.append(title, quote, explanation, action);
    container.append(card);
  }

  const uncertainty = document.createElement("p");
  uncertainty.className = "warning";
  uncertainty.textContent = `Belirsizlik: ${report.uncertainty}`;
  container.append(uncertainty);
  const formula = document.createElement("p");
  formula.className = "meta";
  formula.textContent = "Skor: doğrulanmış maddeler için düşük 5, orta 12, yüksek 22, kritik 32 puan; toplam en çok 100.";
  container.append(formula);
}

function maybeShowLegalPrompt(): void {
  if (dismissed || !document.body || panel?.isConnected) return;
  const text = getSourceText();
  if (!looksLikeLegalDocument(document.title, location.href, text)) return;
  const host = ensurePanel();
  const elements = shadowElements();
  if (elements) {
    elements.status.textContent = "Bu sayfa sözleşme veya gizlilik metni içeriyor olabilir.";
  }
  if (!host.isConnected) document.documentElement.appendChild(host);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ANALYZE_PAGE") return false;
  dismissed = false;
  ensurePanel();
  const elements = shadowElements();
  if (!elements) {
    sendResponse({ error: "Analiz paneli açılamadı." });
    return false;
  }
  void analyzeCurrentPage(elements.status, elements.output, elements.analyze)
    .then(() => sendResponse({ ok: true }))
    .catch((error: unknown) => sendResponse({ error: error instanceof Error ? error.message : "Analiz hatası." }));
  return true;
});

function scheduleLegalCheck(): void {
  if (scanTimer !== undefined) window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(maybeShowLegalPrompt, 700);
}

scheduleLegalCheck();
new MutationObserver(scheduleLegalCheck).observe(document.documentElement, {
  childList: true,
  subtree: true
});
