# Sidebar Plus implementation tasks

## Objective

Implement the confirmed sidebar design in `artifacts/sidebar-plus-design.md` through BB's public Plugin SDK. Projects behave as folders; threads are their contents, except in the requested flat grouping mode.

## Current layout and environment

- Plugin source is now at the repository root: `app.tsx`, `server.ts`, `package.json`, and `tsconfig.json`. The user moved it out of the original child directory; do not recreate that directory.
- Branch: `feat/sidebar-plus`. The user created the first commit, `9a7a97c` (`First commit`), containing the plugin foundation, visibility integration, and sidebar styling. Preserve the user's moves and configuration changes.
- Installed SDK: 0.6.15. Root dependencies now include the missing Hono and better-sqlite3 type peers. Installed SDK declarations are available under `node_modules/@get-bb/plugin-sdk/bundled-types/`.
- Read-only BB inventory confirms `sidebar-plus` is enabled/running with `rootDir` equal to this repository and a local path installation.
- The user reports successful installation and supplied a screenshot showing a project, thread title, and local branch. This confirms visible baseline rendering, not all functional scenarios or independent verification.

## Scope

- Project-only pins, no duplication, and Hidden projects recovery.
- Saved project order: Projects supports only By name and Manual, with new projects appended and name sorting applied only on explicit click. Sort by name affects Projects only. Pinned supports manual ordering only; alphabetical sorting must not change its order.
- Only By project / None grouping; None is one flat thread list without individual project headers.
- Search matches project names only. Threads always use modification-time-descending order.
- Local branch and live working/attention indicators. Company from latest executed turn only when available; otherwise no label.
- GitHub PR/check UI is excluded from this version.

## Authorization and constraints

- The current request authorizes completing SP-03 through SP-05, deciding remaining product details, and one Conventional Commit per completed task on `feat/sidebar-plus`.
- Complete local type/build and isolated integration checks as part of SP-05. Do not install dependencies, reload or activate the installed plugin, repair global tooling, push, or create PRs.
- This chat remains the sole source writer. No additional agents or chats are authorized. Execution is inline under this existing single-writer restriction.
- Use the installed SDK declarations, not upstream-only methods. Do not import private BB components or scrape host DOM.
- Preserve unrelated files, user edits, package versions, and root source layout.
- Technical artifacts in English; explicit types and parameters; no default parameters or behavior-switching helpers.
- Validate stored state and RPC inputs. Migrate validated version 1 preferences without losing pin/hide membership; never reset corrupt state.
- Use structured plugin logging and actionable public errors. Do not claim unobserved checks passed.
- Delivery strategy: `single-pr` for this feature, with one coherent commit per task; no PR is authorized. SP-03 is forecast at approximately 800 authored lines because persistence, accessible ordering, and UI must work together. Keep this coherent unit rather than artificial file-type commits; report its size.

## Tasks

- [x] **SP-00 — Diagnose the scaffold install incident.** Diagnosed. The first scaffold unexpectedly attempted npm install; the automatic command was not repeated. No commit was authorized.
- [x] **SP-01 — Create the SDK-based plugin foundation.** Source authored; baseline rendering confirmed by the user's screenshot and running plugin inventory. Source supports titles, local branches, newest-modified-first threads, helper-hidden filtering, and concurrent work/attention indicators. Implementation accepted by the user. Outstanding type/build scenario evidence and independent verification are tracked under SP-05; completion does not imply those checks passed.
- [x] **SP-02 — Persist project pin/hide state and expose recovery.** Source integration authored in this dedicated chat: versioned Zod validation, `bb.storage.kv` persistence, typed RPC, serialized mutations, realtime snapshots, and Pinned/Projects/Hidden presentation with Show restoring ordinary unpinned Projects. Structural readback is complete; the user reports that the logic works and requested implementation completion. Pinned now precedes Projects without uppercase styling, More is right-aligned, and project-group borders are removed. Restart persistence, same-server two-window updates, and independent/native verification remain tracked under SP-05; no unobserved check is claimed as passed.
- [x] **SP-03 — Complete header, ordering, grouping and search.** Implemented Sidebar options/Add project/New thread; independent saved Projects/Pinned ordering with pointer/touch/keyboard handles; explicit Projects-only name sort; By project/None; project-name-only search; persistent project collapse; strict v1 migration; realtime and mutation-error handling. Verified local typecheck, SDK build, and six isolated SQLite-backed integration scenarios. Native review preflight failed before mutation; no approval is claimed. Commit: `feat(sidebar): complete ordering grouping and project controls` (this task's work unit).
- [ ] **SP-04 — Resolve model metadata and verify the candidate.** Pending. Verify the supported latest-executed-turn company lookup; omit unavailable metadata. Perform permitted structural and native review, then applicable functional checks when authorized.
- [ ] **SP-05 — Resolve outstanding verification requirements.** Pending. Local source/dependency/path setup has been completed by the user; native review and additional independent verification remain unavailable or unauthorized. Request permission before extra verification agents or command execution. Track outstanding type/build evidence, restart persistence, and same-server two-window updates here. Global native-tool repair and assistant-created commits remain excluded.

## SP-02 implementation boundary

- Keep BB as the source of truth for project names and thread records. Persist stable project IDs only for pin/hide membership; do not copy project/thread data or mutate BB's native thread pin/archive state.
- Follow the bundled thread-list's plugin storage/realtime scope: one plugin-owned layout state shared by open windows of the same BB server. Do not introduce cross-server or per-window identity layers.
- Use `bb.storage.kv` with an explicit schema version, typed RPC, and realtime notifications using verified SDK signatures. Validate disjoint membership and serialize updates so concurrent requests cannot lose another window's changes.
- Implement distinct pin, unpin, hide, and show actions rather than a flag-driven multi-mode function. Hide clears pinned membership; Show also guarantees an unpinned visible destination.
- Pinned visible projects appear only in Pinned; ordinary visible projects appear only in Projects; hidden project rows appear only in Hidden projects and contain no thread rows, branch metadata, overflow menu, or New thread action.
- Keep current relative project order for this unit. Saved order/name-sort/drag behavior belongs to SP-03; do not add hidden sorting modes.
- Preserve thread rendering, live spinner/attention signals, modification ordering, host navigation, and unavailable-company omission.
- Use only required SDK/runtime dependencies. If typed RPC requires Zod, declare the already installed matching package as a direct runtime dependency and reconcile the existing lockfile without installing packages or changing versions. No additional UI/state/DnD library in this unit.
- Use small plugin-owned controls rather than importing moved scaffold components with broken alias/dependency assumptions. Do not perform unrelated physical cleanup of `ui/`, `hooks/`, or `lib/`.

## Acceptance criteria

- Exactly one custom thread-list provider uses supported APIs.
- Project pinning moves to Pinned without duplication; the section disappears when no visible pinned projects remain.
- Hidden projects appear below Projects, initially collapsed, with only name and a right-aligned Show button when expanded.
- Hide changes presentation only; Show never returns a project to Pinned.
- Pin/hide mutations persist and synchronize open windows; invalid stored data and failed writes are explicit, not silently discarded.
- Projects offers only By name / Manual sorting; Sort by name explicitly reorders only ordinary visible projects and leaves Pinned unchanged. Pinned can be reordered manually only. New projects append; manual positions persist. Grouping offers only By project / None.
- Threads sort by latest modification, with live status independent from sorting. None globally sorts the visible result.
- Search matches only project names, including in None; hidden threads are not revealed by matching.
- Branches come from each thread's own environment. Latest-turn company metadata is not guessed or replaced with the configured model/agent provider.

## Verification evidence and limits

- Baseline rendering/install evidence belongs to the user's original `9a7a97c`; the new candidate has not been installed or reloaded into the user's running BB.
- SP-03 `npm run typecheck`: passed. `npm test`: SDK build passed; six integration scenarios passed, zero failures.
- Integration runs the actual built backend and its Zod RPC schemas with real isolated SQLite storage and a minimal host adapter. It is not a live BB end-to-end test or an independent reviewer.
- Covered: first-use native order, append after manual moves, Projects-only name sorting and Pinned independence, hide/show placement, validated v1 migration, corrupt-state preservation, invalid inputs, and section-boundary moves.
- Native review is enabled globally. Current selectorless STATUS returned `gentle-ai.review-integration.failure/v2`, `operation_failed`, phase `pre_native`, cause `operation not permitted`, mutation `not_started`. No lineage, review, or approval exists. Do not repair global tooling or infer PASS.
- SP-05 will add restart/concurrent-window/error-path proof with the same isolated host boundary and record remaining live UI limits. No install, reload, plugin activation, lint, remote command, or independent agent has run.
- Generated CodeGraph data is ignored rather than committed. No dependency installation or version changes occurred.

## Resolved decisions

- Drag handles reorder within their current section only; Pin/Unpin explicitly change membership. Pinned appends newly pinned projects. Unpin/Show retain the ordinary saved position.
- Keep one plugin-owned ordinary sequence and the pinned membership sequence. Native project reordering is global and cannot independently own both section orders; do not change BB's native order.
- None renders a single flat thread list. A collapsed Manage projects area inside Sidebar options contains project controls, not thread-list headers. Hidden recovery remains below the list.
- Search uses trimmed, case-insensitive substring matching against project names only. Hidden recovery is not search-filtered. Empty Hidden projects is absent and expansion is transient.
- Project groups start expanded; persist collapsed IDs. Hidden recovery starts collapsed on each mount.
- Add project uses the supported project creation SDK with explicit name, host, and absolute folder path. New thread uses the supported project-scoped compose action. Use host-owned thread split gestures, not a custom split implementation.
- Metadata must prove the latest executed model's company or remain absent; verify this boundary in SP-04.

## Progress and next step

SP-00 through SP-03 are complete. SP-04 is next, followed by SP-05. Route: inline under the single-writer restriction. SP-03 has no existing deterministic pre-change runner, so no RED/GREEN claim is made; its six integration scenarios now form the regression suite. Rollback boundary: revert the SP-03 work unit for layout/RPC/v2 preferences together; preserve the original foundation commit and user changes. Native review remains unavailable, not approved.
