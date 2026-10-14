interface Settings {
  apiBaseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: string;
}

export {};

const form = document.querySelector<HTMLFormElement>("#settings")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;
const keyStatus = document.querySelector<HTMLElement>("#keyStatus")!;
let existingKey = false;

async function load(): Promise<void> {
  const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" }) as Settings;
  if (settings?.apiBaseUrl) (document.querySelector("#apiBaseUrl") as HTMLInputElement).value = settings.apiBaseUrl;
  if (settings?.model) (document.querySelector("#model") as HTMLInputElement).value = settings.model;
  if (settings?.provider) (document.querySelector("#provider") as HTMLSelectElement).value = settings.provider;
  existingKey = Boolean(settings?.apiKey);
  keyStatus.textContent = existingKey
    ? "Bir anahtar kayıtlı. Değiştirmek için yeni anahtar girin."
    : "Henüz API anahtarı kaydedilmedi.";
}

function isValidBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    if (url.username || url.password || url.search || url.hash ||
        /\/chat\/completions\/?$/.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  const apiBaseUrl = (document.querySelector("#apiBaseUrl") as HTMLInputElement).value.trim().replace(/\/+$/, "");
  const model = (document.querySelector("#model") as HTMLInputElement).value.trim();
  const apiKey = (document.querySelector("#apiKey") as HTMLInputElement).value.trim();
  const provider = (document.querySelector("#provider") as HTMLSelectElement).value;
  const clearKey = (document.querySelector("#clearKey") as HTMLInputElement).checked;
  const parsed = isValidBaseUrl(apiBaseUrl);
  if (!parsed) {
    status.textContent = "API adresi HTTPS olmalı (yalnızca localhost için HTTP kabul edilir) ve /chat/completions ile bitmemelidir.";
    return;
  }
  if (!model || (!apiKey && (!existingKey || clearKey))) {
    status.textContent = "Model adı ve API anahtarı gerekli.";
    return;
  }

  try {
    const originPattern = `${parsed.protocol}//${parsed.hostname}/*`;
    if (!(await chrome.permissions.request({ origins: [originPattern] }))) {
      status.textContent = "Model uç noktası izni verilmedi; ayarlar kaydedilmedi.";
      return;
    }
    const previous = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" }) as Settings;
    const next: Settings = {
      apiBaseUrl,
      model,
      provider,
      apiKey: clearKey ? "" : apiKey || previous.apiKey || ""
    };
    await chrome.storage.local.set(next);
    existingKey = Boolean(next.apiKey);
    (document.querySelector("#apiKey") as HTMLInputElement).value = "";
    (document.querySelector("#clearKey") as HTMLInputElement).checked = false;
    keyStatus.textContent = existingKey ? "API anahtarı bu Chrome profilinde güvenli biçimde kaydedildi." : "API anahtarı kaldırıldı.";
    status.textContent = "Ayarlar kaydedildi.";
  } catch (error) {
    status.textContent = `Ayarlar kaydedilemedi: ${error instanceof Error ? error.message : "Bilinmeyen hata."}`;
  }
});

load().catch((error: unknown) => {
  status.textContent = `Ayarlar yüklenemedi: ${error instanceof Error ? error.message : "Bilinmeyen hata."}`;
});
