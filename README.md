# MonotoneDesk

A complete local GenLayer Project candidate for inspecting an exact monotone least-squares fit to declared **fictional, non-PII** binned observations. A source table, empirical/fitted curve, exact rational blocks and two losses explain the chain result. It does not certify sample truth, generalization, production models, calibration quality outside this sample or predictive benefit.

## Deterministic core

Input is strict `{version:1,bins:[{score,positives,count}]}`: 1..16 rows; exact integer score0..10000, count1..10000 and positives0..count; total count<=100000; raw body1..16384 bytes. Booleans, floats, extra fields, duplicate JSON keys and nonfinite constants fail. Duplicate scores first aggregate count and positives. Weighted PAVA compares rates using integer cross multiplication; adjacent non-increasing means merge, including equal means, to produce canonical maximal equal-rate blocks. All rates and losses are reduced rational pairs, with zero=0/1. There are no floating-point consensus decisions.

The objective `weighted_bin_sse` is over **original rows**, sum(count*(fit-positives/count)^2), including the constant contribution of rows sharing a score. `bernoulli_sse` is sum(positives*(1-fit)^2+(count-positives)*fit^2). The two objectives differ by a fixed within-row term and have the same minimizer. No extrapolated scores are returned. JavaScript divisions draw the curve only; displayed exact fractions and chain output are preserved.

The fixture fits scores1000/2000 to1/2 and3000/4000 to11/15, with weighted loss34/15 and Bernoulli loss163/15. Publication must preserve the exact LF bytes; see `fixtures/source.json`. Its test URL is an explicitly mocked synthetic locator, never a real published source. The fixture public URL remains null.

## Workflow and API

| Method | Effect |
|---|---|
| `open_fit(fit_id,source_url,source_sha256)` | Creator locks a strict sample; OPEN revision0 |
| `derive_fit(fit_id,expected_revision)` | Permissionless fresh full PAVA; DERIVED revision1, result and certificate |
| `confirm_fit(fit_id,expected_revision,certificate_id)` | Creator freshly recomputes and confirms; CONFIRMED revision2 |
| `revoke_fit(fit_id,expected_revision,reason)` | Creator terminal revocation, revision+1; trimmed reason1..160 chars |
| `get_fit(fit_id)` | Decoded dictionary with source, data, complete result, captures, certificate and history |
| `get_configuration()` | Bounds and declared-sample-only scope |

Demo: publish the byte-exact fixture to a real public GitHub commit; deploy `contract.py` with `[]`; enter its actual address, a unique fit ID, the real pinned URL and fixture SHA; open, read, derive, inspect the table/curve/blocks/losses, and creator-confirm the displayed certificate. Revoke separately if desired. Reusing the ID, stale revisions, other creators, cross-record certificates and repeated confirmation fail.

## Shared protocol and source boundaries

The constructor has **zero arguments**. A creator locks a never-reusable ID, source locator and exact byte SHA256; any participant may derive a result once. Only that creator can confirm the current certificate or revoke the record. Every subsequent write uses an expected revision, confirmation also requires the exact certificate ID, and revocation is terminal. Failed fetching, validation or computation changes no stored state. Offline revocation works even when the source is unavailable. Revoked results remain visible as historical evidence.

The source must be `https://raw.githubusercontent.com/OWNER/REPO/40-lowercase-hex-commit/PATH`. Owner boundaries, repository dot segments and every path segment are checked explicitly; query strings, encoded paths, credentials, empty segments, `.` and `..` are rejected. This grammar does not authenticate a publisher or attest DNS, redirects, TLS or GitHub transport behavior. HTTP200, exact body bounds, strict UTF8, exact SHA256 and strict duplicate-key-rejecting JSON are mandatory. Availability or changed bytes cause failure, not an inferred answer. Never publish personal data or secrets: input and chain records are public.

For opening, derivation and confirmation, leader and validators each fetch fresh bytes independently. At derivation/confirmation they each recompute the complete deterministic result. The validator compares the whole canonical packet: protocol, chain, contract, creator, ID, locked URL/hash, revision, operation, observation time, input and result. It rejects a non-return, exception or any disagreement. No LLM is used. A certificate is the SHA256 of the complete derivation packet; confirmation preserves that certificate and stores a new full capture. The observation time is chain-message time, not proof of when the publisher created the data. No ongoing freshness or real-world truth is promised.

## Frontend and receipt recovery

The complete frontend starts **unconfigured**: deployment, published fixture and hosting URLs are null. Enter an actual deployed address and a published commit-pinned source with its exact byte hash. Connect MetaMask through the SDK wallet provider on **Studio61999**. Incorrect networks require the normal wallet network switch; writes are zero-value and there is no backend, key custody or external effect.

A write submits once and saves the hash plus original sender, target and zero value in browser localStorage. It requests the real SDK `waitForTransactionReceipt({waitUntil:'finalized',fullTransaction:true})`, then independently inspects the exact public `eth_getTransactionByHash` receipt. Completion requires raw `FINALIZED`, matching hash/from/to/value0, `execution_mode:NORMAL`, `leader_only:false`, `result_name:MAJORITY_AGREE` and exactly one leader-mode receipt with `execution_result:SUCCESS`. Nonfatal validator `IDLE` votes do not imply leader failure. Multiple leader entries are conservatively unresolved because this adapter cannot prove their current-round identity.

Present SDK identity, value, finality and execution fields must agree. The pinned SDK Studio branch can omit train execution fields, and its viem formatter drops raw numeric zero `value`; actual non-mocked helper/formatter regressions reproduce both facts. Missing fields or an SDK observation exception are **not manufactured into SDK success**: only the independently strict raw receipt can complete that submission. Missing, failed, pending, conflicting or ambiguous evidence retains the exact hash and blocks further writes. The inspector can recover it without a second submission, using the original saved context even if the address/account fields change. The UI intentionally provides no discard/retry control for a failed tracked transaction; operator review is required. A broadcast that fails before the wallet/SDK returns a hash cannot be recovered automatically. Browser storage is a cooperative local recovery aid, not a tamper-resistant ledger; retain the ID if storage is unavailable.

Read occurs only after proven success. Dictionary-valued SDK views are consumed as decoded dictionaries, not JSON strings. Editing the visible record ID or deployment clears the loaded record; write gates and handler checks bind the visible ID to the loaded ID. Account/network changes disconnect the UI and clear its record. Old source data and results stay visible with their status; confirmation is not silently assumed.

## Run and verify

From this package directory, with the pinned Python requirements installed:

```powershell
python tools/verify.py
cd frontend
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

`tools/verify.py` selects exact GenVM **v0.2.12**, runs the actual deployed Python SDK contract tests and full semantic lint/schema, and writes stdout to `evidence/verification-*.log`. Use the package as cwd: upstream gltest clears its cwd `artifacts/`. The narrow Windows test fixture defers upstream message-file unlink until teardown and synchronizes upstream warp message datetime; it never replaces contract computation or validator logic. Test HTTP responses are mocked transport bytes; production code fetches public sources. `pnpm build` runs TypeScript checking and Vite. The nonfatal large SDK chunk warning is retained. `tools/verify_frontend.py` reproduces frontend checks and binds all input hashes.

Frontend transport adapter tests mock wallet/RPC calls and execute real production adapters; the public constructor receipt fixture additionally exercises the actual SDK helper and actual viem formatter. That receipt belongs to another publicly observed constructor and is **not either project's deployment or business-method success**. No browser UI test, live source capture, deployed business flow, usage, adoption, audit, reward, financing or production readiness is claimed.

## Release and provenance

MIT license. The dedicated algorithm, state API, fixtures, domain tests and product UI are original for this application. SDK connection/receipt infrastructure and the exact SDK verification scaffold are shared development infrastructure, not separate contributions. Each Project is counted once; its contract is not also submitted as an independent IC. `CONTRIBUTION.json`, `PUBLISH_MANIFEST.json`, `PACKAGE_CONTENTS.json` and evidence record the candidate hashes and null live metadata. ZIPs omit node_modules, dist, SDK caches, artifacts and all credentials. Public fixture URLs and deployment addresses must be recorded only after actual publication/deployment and verification.

Primary SDK references: [transactions](https://docs.genlayer.com/api-references/genlayer-js/transactions), [equivalence principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle), [execution and fee outcomes](https://docs.genlayer.com/developers/decentralized-applications/fee-outcomes-and-debugging), [SDK source](https://github.com/genlayerlabs/genlayer-js). Frontend pins genlayer-js2.0.0-rc.2; compatibility evidence is local and based on the public Studio constructor shape, not a live end-to-end attestation.

Verification at candidate freeze: **34 Python tests (33 actual contract/validator cases plus one exact fixture-metadata integrity case), 49 frontend tests; exact full semantic lint/schema and TypeScript/Vite exit0**. Source SHA256: `7f125508b8f743be9e9c4606fd40353429216d860065438e27ffddb1c0bf5434`. See raw logs for actual red/green history. Independent peer review is recorded separately; this is not an external security audit.

## Current minimal frontend receipt revision

The original reviewed 49-test frontend and its original 59-entry candidate ZIP remain historical. The latest local correction is `evidence/receipt-revision-2026-10-21/verification.json`: **55 frontend tests and TypeScript/Vite build pass**. Contract source, domain algorithms, domain UI, fixtures and Python SDK evidence are unchanged. The required regressions first produced 4 failed / 22 passed per package; final logs are preserved separately. This revision does not repeat Python tests or make a network transaction.

Before the SDK submitter is called, UNKNOWN_NO_HASH and the original public sender/target/value0 context are persisted. Network errors or invalid/missing hashes block another submission across same-origin reloads. Only explicit wallet rejection code4001 can clear an attempt without a hash. For a lost response, obtain the original transaction hash from wallet activity, enter it in the receipt field and explicitly inspect it. Attaching that user-supplied hash does not independently reconstruct lost calldata; use only the original transaction. Observation never resubmits. Known hashes and execution failures remain blocked until strict raw success evidence is available. Browser storage deletion, another origin/browser session or storage failure can remove a local replay guard; retain the original wallet activity and hash independently. No keys or secrets are stored.

Every provided SDK execution field must be consistent, including numeric-only errors and named/numeric contradictions; missing Studio fields are not synthesized. Raw proof still requires the exact hash/from/to/value0, FINALIZED/NORMAL/majority and exactly one leader SUCCESS. Real SDK helper/formatter tests use the captured public constructor of another contract, not a live Project business transaction.

Reproduce this frontend revision with `python evidence/receipt-revision-2026-10-21/verify_frontend.py` after installing locked frontend dependencies and configuring pnpm11.25.0 on PATH or PNPM_EXECUTABLE. Earlier `evidence/frontend-verification.json`, independent review, top-level PUBLISH_MANIFEST/PACKAGE_CONTENTS and the original candidate ZIP describe the prior revision. The current **RECEIPT_REVISION_MANIFEST.json** and separate receipt-revision ZIP bind current bytes; archived baseline copies preserve previous metadata. The workspace pair packager is `../tools/package_receipt_revision.py`. No browser QA, publication, deployment, hosting or full live business flow is claimed by this local revision.
