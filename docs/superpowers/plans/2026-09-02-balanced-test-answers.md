# Balanced test answers implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the existing preview branch.

**Goal:** Correct the all-A default question bank and ensure varied correct-answer positions in external tests.

**Architecture:** Extract the existing default-question generator, deterministically distribute its answer keys across A–D, and give corrected questions new stable IDs. Keep the original inactive rows and answer keys for already-open tests and past results. Hide replaced versions in the management response. External test selection distributes visible correct-answer positions while preserving the stored answer index attached to each option.

**Tech stack:** Existing JavaScript, Azure Functions, SQL, Node tests and GitHub Actions.

**Spec:** User's screenshot and instruction: the correct answer must not always be A.

## Constraints

- Do not rewrite question text, correct answer text, manually edited questions or completed results.
- No deletion of existing questions; old IDs remain gradable for already-open tests.
- Corrected defaults use deterministic IDs/order; reruns preserve subsequent manual changes.
- Database correction is scoped to company-essentra, transactionally verified, rehearsed with rollback, then applied and audited.
- Keep the PR as a preview; do not merge to main.

## Tasks

- [x] Reproduce the generator defect: distribution was [20,0,0,0] instead of [5,5,5,5].
- [x] Implement answer placement in `api/src/lib/question-order.js` and extract/update the seed generator in `scripts/lib/default-test-questions.js`.
- [x] Add scoped replacement planning and the transaction script `scripts/rebalance-default-test-questions.js`.
- [x] Update external test selection and management version filtering without changing scoring or historical rows.
- [x] Test generator integrity, grading after shuffling, old-version grading, custom/inactive preservation and idempotence; run full tests and independent review.
- [ ] Deploy preview, run dry-run then apply database correction, and inspect distribution and health reports.

## Review refinements

- Normal default seeding refuses active legacy IDs before its first write, with guidance to run the scoped balance repair and review preserved custom legacy questions. This avoids duplicate active questions when upgrading an older database.
- Management resolves replacements using immutable IDs across the entire company before applying type/language filters, so moving a current version cannot resurrect its retired predecessor.
- Full local npm test and targeted grading/version/filter/seed-preflight regressions pass.
