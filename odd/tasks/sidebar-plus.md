# Sidebar Plus implementation tasks

## Objective

Implement the confirmed sidebar design in `artifacts/sidebar-plus-design.md` through BB's public Plugin SDK. Projects behave as folders; threads are their contents, except in the requested flat grouping mode.

## Current layout and environment

- Plugin source is now at the repository root: `app.tsx`, `server.ts`, `package.json`, and `tsconfig.json`. The user moved it out of the original child directory; do not recreate that directory.
- Branch: `feat/sidebar-plus`, currently without commits. All project files remain untracked; preserve the user's moves and configuration changes.
- Installed SDK: 0.6.15. Root dependencies now include the missing Hono and better-sqlite3 type peers. Installed SDK declarations are available under `node_modules/@get-bb/plugin-sdk/bundled-types/`.
- Read-only BB inventory confirms `sidebar-plus` is enabled/running with `rootDir` equal to this repository and a local path installation.
- The user reports successful installation and supplied a screenshot showing a project, thread title, and local branch. This confirms visible baseline rendering, not all functional scenarios or independent verification.

## Scope

- Project-only pins, no duplication, and Hidden projects recovery.
- Saved project order; only By name and Manual, with new projects appended and name sorting applied only on explicit click.
- Only By project / None grouping; None is one flat thread list without individual project headers.
- Search matches project names only. Threads always use modification-time-descending order.
- Local branch and live working/attention indicators. Company from latest executed turn only when available; otherwise no label.
- GitHub PR/check UI is excluded from this version.

## Authorization and constraints

- The user authorized a dedicated implementation chat for SP-02 because the previous writer could not be recovered. This chat is the sole source writer; do not launch additional agents or chats without user authorization.
- The user's own installation and dependency commands are observed progress, not blanket permission for the assistant to execute installs, tests, typechecks, builds, lint, reloads, or plugin activation. Those commands remain withheld until explicitly requested.
- No commits, pushes, PRs, destructive Git operations, global tooling repair, or unrelated edits. Do not clean up user files or generated leftovers as a separate unrequested project.
- Do not run `bb plugin new` again: the installed generator implicitly runs npm install. No package-version substitution, SDK packing, global configuration changes, or registry workarounds.
- Use the installed SDK declarations, not upstream-only methods. Do not import private BB components or scrape host DOM.
- Technical artifacts in English; imports at the top; explicit types and parameters; no default parameter values or behavior-switching flag helpers.
- Validate inputs and stored state. Initial state is permitted only when no preference has ever been saved; corrupt state must raise an explicit error, not reset silently.
- Use project structured logging, surface actionable public failures, and do not claim a failed mutation was saved.
- Task size is a review heuristic, not a hard limit; do not minify code or omit required behavior to meet a line count.

## Tasks

- [x] **SP-00 — Diagnose the scaffold install incident.** Diagnosed. The first scaffold unexpectedly attempted npm install; the automatic command was not repeated. No commit was authorized.
- [ ] **SP-01 — Create the SDK-based plugin foundation.** Source authored; baseline rendering confirmed by the user's screenshot and running plugin inventory. Source supports titles, local branches, newest-modified-first threads, helper-hidden filtering, and concurrent work/attention indicators. Complete type/build scenario evidence and independent verification remain pending; no blanket completion claim.
- [ ] **SP-02 — Persist project pin/hide state and expose recovery.** Source integration authored in this dedicated chat: versioned Zod validation, `bb.storage.kv` persistence, typed RPC, serialized mutations, realtime snapshots, and Pinned/Projects/Hidden presentation with Show restoring ordinary unpinned Projects. Structural readback is complete; user-owned build/runtime acceptance and independent/native verification remain pending, so SP-02 is not marked complete. Manual acceptance still pending: pin/unpin/hide/show, restart persistence, and same-server two-window updates.
- [ ] **SP-03 — Complete header, ordering, grouping and search.** Pending. Add Sidebar options/Add project/New thread, saved order/manual drag, explicit name sort, By project/None, and project-name-only search. Preserve visibility behavior from SP-02. Resolve outstanding layout decisions before the affected work.
- [ ] **SP-04 — Resolve model metadata and verify the candidate.** Pending. Verify the supported latest-executed-turn company lookup; omit unavailable metadata. Perform permitted structural and native review, then applicable functional checks when authorized.
- [ ] **SP-05 — Resolve outstanding verification requirements.** Pending. Local source/dependency/path setup has been completed by the user; native review and additional independent verification remain unavailable or unauthorized. Request permission before extra verification agents or command execution. Global native-tool repair and commits remain excluded.

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
- Only By name / Manual sorting and By project / None grouping eventually exist. New projects append; manual positions persist; alphabetical reorder is explicit.
- Threads sort by latest modification, with live status independent from sorting. None globally sorts the visible result.
- Search matches only project names, including in None; hidden threads are not revealed by matching.
- Branches come from each thread's own environment. Latest-turn company metadata is not guessed or replaced with the configured model/agent provider.

## Verification evidence and limits

- Observed: root manifest, installed SDK/dependency files, `feat/sidebar-plus` without commits, and an enabled/running local `sidebar-plus` plugin pointing to this repository.
- Observed: user screenshot shows the installed baseline project/thread/branch layout. Exact typecheck/build output was not supplied; do not invent passing commands.
- Parent source readbacks previously confirmed registration, filtering, ordering, branches, dual work/attention display, and plain-click host action usage.
- No assistant-executed tests, builds, lint, typechecks, reloads, or installs are authorized. Applicable test-first execution is withheld; no RED/GREEN evidence exists. SDK declaration inspection confirmed KV get/set, RPC contract registration, realtime publish, app `useRpc`/`useRealtime`/connection-state hooks, and dispose hooks; no compile/runtime behavior is claimed.
- SP-02 structural readback: `server.ts` validates saved snapshots and queues mutations before KV writes; app code validates realtime snapshots and rejects stale revisions; project partitioning filters BB project records without rewriting their order. Zod 4.6.5 is declared as a runtime dependency because both backend and app import it.
- Native ASSESS previously returned unassessable / package-local-binary-missing and requires an independent verifier. No additional agent has been authorized.
- Native INSPECT returned blocked / native-status-package-binary-missing, with no lineage and no mutation. Do not install its recovery tooling or create a baseline commit automatically.
- Commit identities: none; user authorization withheld.

## Remaining decisions

- Pinned relative order/drag targets and scope of explicit name-sort actions.
- Location of project controls and hidden recovery in None without adding project groups to the flat thread list.
- Detailed project-name matching, hidden-section empty/expansion behavior, supported Add project flow, and optional custom split interaction.
- Supported latest-executed-turn metadata lookup.
- Do not reopen settled grouping choices, search fields, thread order, missing-company behavior, or restore destination.

## Progress and next step

SP-02 is the only active task. The user explicitly authorized this dedicated implementation chat after the earlier writer could not be recovered, replacing the prior writer-recovery block. Current structural source readback shows app/server integration and the visibility UI are now present. The user still owns running the permitted manual checks; no tests, typechecks, builds, plugin reloads, native review, or independent verification were executed. Preserve SP-02 as unfinished until the pending checks are resolved.
