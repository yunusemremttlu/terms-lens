import { extractVisibleText } from "../core/legal-page";
import { buildEvidenceReport } from "../core/report";

const reportNode = document.querySelector<HTMLElement>("#report")!;
const quote = "Spotify reserves the right to change our Spotify Service offerings and their availability from time to time, without notice or liability to you.";
const evidence = {
  documentType: "terms" as const,
  summary: "Şartlar, hizmetteki değişikliklere önceden bildirim olmadan izin veriyor.",
  uncertainty: "Bu kısa örnek tüm sözleşmeyi temsil etmez.",
  risks: [{
    category: "unilateral_change",
    severity: "high" as const,
    quote,
    explanation: "Hizmetin hangi özelliklerinin ne zaman değişebileceği belirtilmeden değişiklik yapılabileceği yazıyor.",
    action: "Önemli bir hizmet değişikliğinde bildirim ve iptal hakkınızın nasıl işlediğini kontrol edin."
  }]
};

function renderDemo(uncertain: boolean): void {
  const sourceText = extractVisibleText(document.body);
  const result = uncertain
    ? {
        ...evidence,
        risks: [{
          ...evidence.risks[0],
          quote: "The provider can permanently retain all personal data forever."
        }],
        uncertainty: "Bu alıntı kaynak metinde bulunmuyor; maddenin varlığı doğrulanamadı."
      }
    : evidence;
  const report = buildEvidenceReport(result, sourceText, "2026-10-14T12:00:00.000Z");
  const score = document.createElement("p");
  score.className = "score";
  score.dataset.cy = "score";
  score.textContent = `Risk skoru: ${report.riskScore}/100`;
  const summary = document.createElement("p");
  summary.textContent = report.summary;
  const fragment = document.createDocumentFragment();
  fragment.append(score, summary);

  for (const item of report.risks) {
    const card = document.createElement("article");
    card.className = "risk";
    const heading = document.createElement("h3");
    heading.textContent = `${item.category.replaceAll("_", " ")} · ${item.severity.toUpperCase()}`;
    const citation = document.createElement("blockquote");
    citation.dataset.cy = "citation";
    citation.textContent = `“${item.quote}”`;
    const explanation = document.createElement("p");
    explanation.textContent = item.explanation;
    const action = document.createElement("p");
    action.textContent = `Sorulacak soru: ${item.action}`;
    card.append(heading, citation, explanation, action);
    fragment.append(card);
  }

  const uncertainty = document.createElement("p");
  uncertainty.className = "uncertainty";
  uncertainty.dataset.cy = "uncertainty";
  uncertainty.textContent = `Belirsizlik: ${report.uncertainty}`;
  fragment.append(uncertainty);
  const injection = document.createElement("p");
  injection.dataset.cy = "prompt-defense";
  injection.textContent = sourceText.includes("Ignore all prior instructions")
    ? "Prompt injection: visible source input; still treated as untrusted data."
    : "Prompt injection: hidden instruction excluded from captured text.";
  fragment.append(injection);
  reportNode.replaceChildren(fragment);
}

document.querySelector("#happy")!.addEventListener("click", () => renderDemo(false));
document.querySelector("#uncertain")!.addEventListener("click", () => renderDemo(true));
