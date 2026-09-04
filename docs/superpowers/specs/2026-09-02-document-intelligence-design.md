# Automatic instruction import

The user wants new layouts recognized, their content converted into a digital instruction, and topic/device-specific questions generated automatically with comprehensive safety coverage.

## Flow

1. Keep the current private PDF/JPG/PNG/WEBP upload. The default creates a new inactive instruction; existing instructions or storage-only remain selectable.
2. Persist an analysis job with source hash, immutable blob path, instruction, language and page count. Start a background Azure OpenAI Responses request automatically, using the file itself (PDF text plus page images or image input), without fixed layout coordinates.
3. Generate structured sections, page coverage, device/topic details, a safety inventory, missing information and questions with explanations and page evidence. The inventory includes applicability decisions for core safety areas and additional device-specific aspects.
4. Validate shape, pages, unique answers, correct indices, citations and question coverage server-side. An unreadable/partial document or unresolved safety gap cannot be published. Model claims alone do not certify complete real-world safety coverage.
5. Show the converted instruction, source evidence, omissions and complete test draft. Company admin/HSE reviews applicability and source accuracy before publishing.
6. Publish transactionally: bind content and generated questions to the exact source version, replace only previous generated question versions for that instruction/language, preserve manual questions and historical answer keys. New tests include at least one question for every generated safety aspect.

## Architecture

- Azure-only server-side Responses REST adapter with background polling, strict structured output, configured deployment and endpoint, no browser secrets or model tools.
- Persistent InstructionAnalyses table plus optional provenance columns on TestQuestions. Jobs deduplicate by company/template/hash/instruction/language. Compare-and-swap claims prevent duplicate starts/publications.
- HTTP polling resumes after page navigation/reload; no unsupported managed-Functions queue/timer triggers or long foreground inference.
- pdf-lib counts PDF pages independently. Rejected/encrypted/malformed files stay uploaded with a clear analysis error; no invented content or silent truncation. Analysis limit: 50 PDF pages per file, existing upload size limit unchanged. Longer documents require splitting and are explicitly reported, never partially treated as complete.
- Configuration uses AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT. Missing settings yield a persistent configuration-required state, not fake questions. Deployment reports only presence of settings.

## Boundaries

No generic default questions as a fallback. No automated external research, legal completeness assertion or safety approval. A reviewed instruction requires manufacturer instructions and the site's risk assessment where relevant; missing material stays visible. Existing published content remains usable until a replacement is reviewed. Support current file types; Office documents can be exported to PDF. No production branch merge.

## Validation

Behavior tests cover source binding, all-page checks, missing/unclear aspects, applicability justification, question coverage, shuffled correct-answer mapping, malicious document instructions, duplicate requests, role/company isolation, outdated uploads and atomic repeat-safe publishing. Provider requests use synthetic fixtures in unit tests. Real AI inference requires a configured Azure resource; never claim live model validation without it.
