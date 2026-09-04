# Automatic instruction import implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the existing preview branch.

**Goal:** Upload-to-instruction conversion, safety coverage and generated tests with source review.

**Architecture:** Persistent jobs, Azure background Responses requests, strict content validation and transactional publication.

**Tech stack:** JavaScript, Azure Functions/SQL/Blob, Azure OpenAI Responses REST, pdf-lib.

**Spec:** `docs/superpowers/specs/2026-09-02-document-intelligence-design.md`

## Tasks

- [x] Add failing analysis tests; implement schema, safety taxonomy, validation and provider adapter in `api/src/lib/instruction-analysis/`.
- [x] Add additive analysis schema migration and scoped schema installer. Implement tenant-scoped job creation/start/poll/publish and provenance-aware question selection.
- [x] Integrate upload creation, persistent progress, source review and publish UI; bind interactions without inline handlers.
- [x] Extend server-only runtime settings, deployment and configuration-presence diagnostics. Add setup documentation.
- [ ] Run full tests and independent review; deploy preview and verify schema, configuration and existing health gates.
