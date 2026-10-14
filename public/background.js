const MAX_REQUEST_BYTES = 1_000_000;

chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    apiBaseUrl: "",
    model: "",
    apiKey: "",
    provider: "openai-compatible"
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  const missing = Object.fromEntries(
    Object.entries(defaults).filter(([key]) => stored[key] === undefined)
  );
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === "PAGE_AGENT_REQUEST") {
    proxyPageAgentRequest(message.request)
      .then(sendResponse)
      .catch((error) => {
        console.error("LLM request failed:", error);
        sendResponse({ error: error.message || "Model isteği başarısız." });
      });
    return true;
  }
  if (message?.type === "GET_SETTINGS") {
    chrome.storage.local.get(["apiBaseUrl", "model", "apiKey", "provider"])
      .then((settings) => sendResponse(settings))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  return false;
});

async function proxyPageAgentRequest(request) {
  if (!request || typeof request.url !== "string" || typeof request.body !== "string") {
    throw new Error("Geçersiz model isteği.");
  }
  if (new TextEncoder().encode(request.body).byteLength > MAX_REQUEST_BYTES) {
    throw new Error("İstek boyutu izin verilen sınırı aşıyor.");
  }

  const settings = await chrome.storage.local.get(["apiBaseUrl", "model", "apiKey"]);
  if (!settings.apiKey || !settings.apiBaseUrl || !settings.model) {
    throw new Error("Ayarlar sayfasında kendi model sağlayıcınızı ve API anahtarınızı tanımlayın.");
  }
  const configured = new URL(settings.apiBaseUrl);
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== configured.origin ||
      requestUrl.pathname !== `${configured.pathname.replace(/\/$/, "")}/chat/completions`) {
    throw new Error("İstek yapılandırılmış model adresiyle eşleşmiyor.");
  }
  if (configured.username || configured.password || configured.search || configured.hash) {
    throw new Error("Model base URL kimlik bilgisi, query veya fragment içeremez.");
  }
  if (configured.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(configured.hostname)) {
    throw new Error("Güvenli olmayan uzak model adreslerine izin verilmez.");
  }

  const body = JSON.parse(request.body);
  if (body.model !== settings.model || !Array.isArray(body.messages)) {
    throw new Error("Beklenmeyen model isteği biçimi.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: request.body
    });
    const responseText = await response.text();
    if (responseText.length > 2_000_000) throw new Error("Model yanıtı çok büyük.");
    return {
      status: response.status,
      statusText: response.statusText,
      body: responseText
    };
  } finally {
    clearTimeout(timeout);
  }
}
