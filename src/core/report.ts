import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import analysisSchema from "../schemas/analysis.schema.json";
import reportSchema from "../schemas/report.schema.json";

export type Severity = "low" | "medium" | "high" | "critical";
export type DocumentType = "terms" | "privacy" | "subscription" | "mixed" | "unknown";

export interface RiskItem {
  category: string;
  severity: Severity;
  quote: string;
  explanation: string;
  action: string;
}

export interface Analysis {
  documentType: DocumentType;
  summary: string;
  risks: RiskItem[];
  uncertainty: string;
}

export interface RiskReport extends Analysis {
  riskScore: number;
  citationRejections: number;
  generatedAt: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateAnalysisSchema = ajv.compile<Analysis>(analysisSchema);
const validateReportSchema = ajv.compile<RiskReport>(reportSchema);

const SEVERITY_POINTS: Record<Severity, number> = {
  low: 5,
  medium: 12,
  high: 22,
  critical: 32
};

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportValidationError";
  }
}

export function parseModelAnalysis(raw: string): Analysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ReportValidationError("Model yanıtı geçerli JSON değil; rapor oluşturulmadı.");
  }
  if (!validateAnalysisSchema(parsed)) {
    const detail = ajv.errorsText(validateAnalysisSchema.errors, { separator: "; " });
    throw new ReportValidationError(`JSON şeması doğrulanamadı: ${detail}`);
  }
  return parsed;
}

export function buildEvidenceReport(
  analysis: Analysis,
  sourceText: string,
  generatedAt = new Date().toISOString()
): RiskReport {
  const risks: RiskItem[] = [];
  let citationRejections = 0;
  const seen = new Set<string>();

  for (const item of analysis.risks) {
    const verbatim = recoverVerbatimQuote(item.quote, sourceText);
    if (!verbatim) {
      citationRejections += 1;
      continue;
    }
    const key = `${item.category}\u0000${verbatim}`;
    if (seen.has(key)) continue;
    seen.add(key);
    risks.push({ ...item, quote: verbatim });
  }

  const riskScore = Math.min(
    100,
    risks.reduce((score, item) => score + SEVERITY_POINTS[item.severity], 0)
  );
  const uncertainty = citationRejections
    ? `${analysis.uncertainty} ${citationRejections} madde, kaynak metinde birebir alıntıyla doğrulanmadığı için rapora alınmadı.`
    : analysis.uncertainty;
  const summary = analysis.risks.length > 0 && risks.length === 0
    ? "Modelin belirttiği maddeler kaynak metinden doğrulanamadı; güvenilir bir risk özeti üretilemedi."
    : analysis.summary;
  const report: RiskReport = {
    documentType: analysis.documentType,
    riskScore,
    summary,
    risks,
    uncertainty,
    citationRejections,
    generatedAt
  };

  if (!validateReportSchema(report)) {
    const detail = ajv.errorsText(validateReportSchema.errors, { separator: "; " });
    throw new ReportValidationError(`Nihai rapor şeması doğrulanamadı: ${detail}`);
  }
  return report;
}

export function recoverVerbatimQuote(candidate: string, sourceText: string): string | null {
  const source = normalizeWithOffsets(sourceText);
  const normalizedCandidate = candidate.trim().replace(/\s+/g, " ");
  if (normalizedCandidate.length < 12) return null;

  const start = source.text.indexOf(normalizedCandidate);
  if (start < 0) return null;
  const end = start + normalizedCandidate.length - 1;
  const originalStart = source.starts[start];
  const originalEnd = source.ends[end];
  if (originalStart === undefined || originalEnd === undefined) return null;
  return sourceText.slice(originalStart, originalEnd);
}

function normalizeWithOffsets(value: string): {
  text: string;
  starts: number[];
  ends: number[];
} {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    if (/\s/.test(value[index])) {
      if (text && !text.endsWith(" ")) {
        text += " ";
        starts.push(index);
        ends.push(index + 1);
      } else if (text.endsWith(" ")) {
        ends[ends.length - 1] = index + 1;
      }
      continue;
    }
    text += value[index];
    starts.push(index);
    ends.push(index + 1);
  }
  return { text: text.trim(), starts, ends };
}

export function calculateScore(items: readonly RiskItem[]): number {
  return Math.min(100, items.reduce((score, item) => score + SEVERITY_POINTS[item.severity], 0));
}

export function parseJsonStrict<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ReportValidationError("Model yanıtı geçerli JSON değil; rapor oluşturulmadı.");
  }
}
