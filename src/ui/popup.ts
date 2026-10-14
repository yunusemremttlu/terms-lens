export {};

const status = document.querySelector<HTMLElement>("#status")!;

document.querySelector("#settings")!.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.querySelector("#analyze")!.addEventListener("click", async () => {
  status.textContent = "Açık sekmeye bağlanılıyor…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id || !/^https?:\/\//.test(tab.url || "")) {
    status.textContent = "Bu sayfa türü uzantı tarafından analiz edilemiyor.";
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "ANALYZE_PAGE" }, (response) => {
    if (chrome.runtime.lastError) {
      status.textContent = "Uzantı yeni yüklendiyse sayfayı yenileyip yeniden deneyin.";
      return;
    }
    status.textContent = response?.error || "Analiz paneli sayfada açıldı.";
  });
});
