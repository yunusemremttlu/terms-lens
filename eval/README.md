# Mini evaluation protocol

`mini-corpus.json` names five official Terms pages and short expected evidence anchors. `npm run eval` downloads each full public page at run time, extracts its main text, and analyzes it with the configured OpenAI-compatible endpoint. Full Terms documents are not stored in this repository.

Metrics are category-level and measured against manually reviewed gold categories:

- **Detected:** expected risk category present in the schema-valid, citation-validated output.
- **Missed:** expected category absent from that output.
- **False alarm:** a reported category not in the gold set for that source. The Microsoft case is a scoped-enforcement control example with no expected category.
- **Citation rejects:** model risk items whose quote could not be found in the fetched document.
- **Gold quote in page:** whether the source still contains the short anchor selected during curation.

The gold labels reflect a small product evaluation judgment, not legal advice or a legal compliance determination. A single excerpt changing can affect the case; the full-document analysis reduces that risk but does not eliminate it. The live metrics require the user's own API key and are intentionally not inferred from mock Cypress output.
