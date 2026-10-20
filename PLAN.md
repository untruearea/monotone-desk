# Inline implementation plan

1. Save spec/API/fixtures and public API tests. Run actual SDK red before business implementation.
2. Implement strict inputs, hardened source capture and the dedicated mathematical core; run tests and inspect every failure.
3. Add different domain frontend tests before domain/UI implementation; reuse only actual SDK wallet infrastructure. Run receipt/dict/unknown lifecycle checks and TypeScript/Vite.
4. Run whole official SDK tests, exact v0.2.12 full semantic/schema; capture stdout and hashes. Write README/threat boundaries/null live metadata; independently review and allowlist ZIP.

Root explicitly authorizes design choice/inline implementation without repeated approval, scoped shared directory only; no worktree or git commits, new agents, browser/chain actions or central ledger writes. No UI lease or browser work is part of this local release.
