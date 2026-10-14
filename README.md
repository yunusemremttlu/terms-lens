# Terms Lens

Terms Lens is a Manifest V3 Chrome extension for reviewing visible terms of service, privacy policies, and subscription terms. It uses Alibaba Page Agent with a user-configured OpenAI-compatible LLM, then validates the answer locally before showing a Turkish, evidence-backed report.

> **This tool does not provide legal advice.** It can miss important clauses, misunderstand context, or produce an incomplete report. Read the original document and consult a qualified lawyer when needed.

## Quick start

Requirements: Node.js 22.22+ or 24+, npm 11+.

```powershell
npm install
npm test
npm run build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the generated `dist` directory. Open the extension's **LLM settings** and enter your provider's OpenAI-compatible API base URL, model name, and your own API key. Grant the requested host permission for that provider. Reload the terms page; on a detected legal page, select **Metni analiz et**.

Alibaba Page Agent's demo LLM is only for testing and is not configured or used. The extension requires a user-supplied model endpoint and key. A JEV endpoint can be used if it implements the OpenAI-compatible `/chat/completions` interface. Alibaba DashScope/Qwen, OpenAI, and other compatible providers can be configured.

### Cypress demo and recorded video

```powershell
npm run demo:video
```

Cypress runs the local, deterministic demo in Electron and records `artifacts/videos/terms-demo.cy.ts.mp4`. The demo does not call a model or send data to a provider. It shows a supported risk citation, then an unsupported quotation being rejected and described as uncertainty.

## Architecture

```text
Terms page
  └─ content script detects a likely legal document
       └─ user clicks "Metni analiz et"
            ├─ extract visible text from main/article (hidden and UI elements excluded)
            ├─ Page Agent observes the page with all action tools disabled
            ├─ isolated service worker sends one request to the configured model endpoint
            └─ local JSON Schema + exact-citation validation + deterministic scoring
                 └─ Shadow DOM panel: Turkish explanation, source quote, risk score, uncertainty
```

### Data flow and boundaries

- Nothing is sent automatically when a page opens. The user starts analysis from the extension panel or popup.
- Only visible text in the page's `main`, `article`, or `[role=main]` region is captured, up to 30,000 characters. Hidden content, navigation, scripts, forms, buttons, and the extension UI are excluded.
- The model receives that text and the page's origin only. Page title, URL path/query/fragment, form values, cookies, and the API key are not included in the prompt.
- The API key is held in `chrome.storage.local` and attached by the extension service worker only to the configured provider request. It is never injected into the website.
- Page Agent's click, typing, scrolling, and script-execution tools are explicitly disabled. The `PageController` state passed to the model is reduced to a generic title, site origin, and a placeholder; the captured legal text is passed separately as untrusted data.
- Network transmission happens only after the user starts analysis and configures a provider. The user should review their model provider's retention and processing terms.

## Output contract and validation

The model response must be a JSON object matching [`src/schemas/analysis.schema.json`](./src/schemas/analysis.schema.json). Markdown-wrapped JSON, extra properties, invalid enums, missing fields, and invalid lengths are rejected; there is no free-text fallback.

For every reported risk:

1. `quote` must match a contiguous passage from the captured source, case- and punctuation-sensitive (whitespace differences are normalized only for matching).
2. The displayed citation is reconstructed from the original captured text.
3. An unsupported citation is excluded and counted in `citationRejections`. If all model allegations lack a verifiable quote, no risk is reported and the report explicitly says so.

The model does not provide the score. The extension calculates it from validated items: low = 5, medium = 12, high = 22, critical = 32, summed and capped at 100. This is a prioritization heuristic, not a probability, legal conclusion, or finding of non-compliance.

## Prompt-injection test

The Cypress fixture contains a hidden instruction asking the model to suppress risk and disclose the key. It is excluded by visible-text extraction. A unit test also verifies that the Page Agent system instruction treats page text as untrusted and all interactive/action tools are disabled. Visible prompt injection is still untrusted model input; no prompt-based defense is perfect. Citation validation prevents unsupported risk claims from entering the report but cannot prevent every plausible false positive.

## Mini evaluation

The corpus in [`eval/mini-corpus.json`](./eval/mini-corpus.json) links to five official Terms pages for Google, Spotify, Apple, Mozilla, and Microsoft. At run time the script fetches each full public page, removes common non-content/hidden elements, and analyzes up to 30,000 characters using the configured model. Only short gold-quote anchors and reviewer labels are stored in the repository. It includes four expected risk categories and one scoped enforcement control case. The gold labels are reviewer judgments, not legal findings. The script reports detected, missed, and false-alarm categories, schema failures, rejected citations, and whether each gold quote is still present in the live source.

Run with a real provider of your choice; the built-in Page Agent demo service is not used:

```powershell
$env:LLM_BASE_URL = "https://api.openai.com/v1"
$env:LLM_MODEL = "your-model-name"
$env:LLM_API_KEY = "your-local-key"
npm run eval
```

The run writes `eval/latest-results.md`. This is a five-document smoke test, not a representative benchmark; pages change, and a gold quote can become stale. No live-model metrics are claimed unless a run has actually been completed with your configured key.

## Development

```powershell
npm run dev
npm test
npm run typecheck
npm run build
npm run demo:video
```

Core code:

- `src/extension/content.ts` — detection, visible-text capture, Page Agent call, and isolated report UI.
- `public/background.js` — guarded model-request proxy; keeps the API key out of the webpage.
- `src/core/legal-page.ts` — document detection and untrusted-data task construction.
- `src/core/report.ts` — JSON Schema checks, quote validation, and deterministic score.
- `cypress/e2e/terms-demo.cy.ts` — deterministic browser demonstration and injection fixture.

## Attribution

The project uses [Alibaba Page Agent](https://github.com/alibaba/page-agent), licensed under MIT. Terms Lens is an independent project and is not endorsed by Alibaba. Short evaluation quotations are linked to the respective rights holders' official Terms pages.
