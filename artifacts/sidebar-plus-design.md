# Sidebar Plus — design for review

**Status:** Draft. Requirements are confirmed where stated; architecture and unresolved interactions are proposals, not implementation approval.

## Recommended starting point

Build one BB plugin that provides a custom sidebar thread list through the public Plugin SDK. Reuse BB's live project/thread data, environment branch metadata, navigation, and thread actions. Add a small backend only to persist plugin-owned layout preferences and synchronize open windows.

Start with project organization, local branch display, and the model's company name on each thread. Preserve BB's working spinner. GitHub PR state and checks are explicitly planned for a later version. Do not fork BB, modify its DOM, import private bundled-plugin components, or select additional libraries before a concrete need is established.

Model-company display is part of V1 when verified metadata from the latest executed turn is available. Otherwise, render no company label. The supported lookup still needs verification; the agent provider ID alone is not sufficient.

## 1. Confirmed requirements

Projects behave like folders; threads behave like files inside those folders.

| Area | Confirmed behavior |
| --- | --- |
| Project header | Display `Projects`, with `Sidebar options` and `Add project` on the right. |
| Project controls | Each project row has `New thread` and an overflow menu. |
| Project movement | Drag and drop sets a persistent manual order. Each new project is appended without moving existing projects. |
| Project pinning | Pin/unpin applies to projects, not threads. |
| Pinned placement | Move pinned projects into a `Pinned` section above `Projects`; never duplicate them in both sections. |
| Dynamic section | Create `Pinned` when the first project is pinned and remove it when the last is unpinned. |
| Visibility | Provide project show/hide controls. Hidden projects appear in a `Hidden projects` section below `Projects`, collapsed by default. |
| Hidden project rows | Show only the project name and one `Show` button on the right; no threads or additional row controls. |
| Show action | Remove the project from Hidden projects and return it to the ordinary Projects list. |
| Grouping menu | Exactly `None` and `By project`; default: `By project`. No grouping by status. |
| Flat grouping | `None` removes individual project names/headers and shows one flat list of visible threads, ordered most recently modified first. |
| Project sorting menu | Exactly `By name` and `Manual`. The initial menu choice remains `By name`; selecting `By name` explicitly reorders the current projects. It is not a continuously enforced alphabetical sort. |
| Order preservation | Keep the positions set by the user until another manual move or explicit name-sort action; inserting a project must not reorder existing ones. |
| Search | `Show search` is off by default. When enabled, match project names only, never thread titles, branches, model companies, or thread state. |
| Thread ordering | Most recently modified thread first, independently of project order or grouping. State categories do not determine list priority. |
| Thread presentation | Show the thread name, with its local branch on a secondary line. |
| Model company | Show only the company behind the model in the latest executed turn, such as `OpenAI`, `Anthropic`, or `xAI`. If that metadata is unavailable, show nothing. |
| Working indicator | Preserve the animated spinner while a thread is working; branch and company metadata must not replace it. |
| Future GitHub support | Add PR state and checks later; do not include them in the first version. |

Thread ordering is now explicitly **latest modification first**, not execution-state priority or agent-activity priority. The spinner and other live status indicators remain display information, not sorting controls. No new thread pinning UI is requested; existing native pin metadata must not be changed as a side effect of project pinning.

### Default project-grouped layout

```text
Pinned                              # Only while projects are pinned
  ▾ Pinned project        [+] [⋯]
      Thread name
      local-branch · Anthropic

Projects                  [Options] [+]
  Search projects…                  # Only when Show search is enabled
  ▾ Project A             [+] [⋯]
      [spinner] Working thread
      local-branch · OpenAI
  ▸ Project B             [+] [⋯]

▸ Hidden projects                   # Collapsed by default
```

When Hidden projects is expanded, its rows contain only:

```text
▾ Hidden projects
  Hidden project A                [Show]
  Hidden project B                [Show]
```

The branch/company placement is a layout proposal. Local branch information and the working spinner remain required; the company label appears only when latest-executed-turn metadata is available. This is the plugin-owned list area, not a replacement for BB's entire sidebar. BB's global navigation, header, and footer remain host-owned unless separate extension slots are deliberately used.

### Flat thread layout — Group by None

```text
[spinner] Most recently modified thread
local-branch · OpenAI

Next most recently modified thread
other-branch
```

The visible thread list has no individual project headers or status groups. Combine threads from matching, non-hidden projects and sort the entire result by latest modification, rather than concatenating separately sorted project lists. The example omits the second company label because latest-turn metadata is unavailable. The placement of project-management controls in this mode still needs a layout decision.

## 2. What the BB sources support

| Capability | Evidence and design implication |
| --- | --- |
| Custom list provider | Installed authoring references document `app.slots.experimental_threadList` as an exclusive slot. Users select a provider in Settings → Appearance → Sidebar. Only one list provider is active. |
| Existing official implementation | `plugins/thread-list` is already a bundled plugin, with separate frontend and backend entry points. Its behavior is a reference, not a private component library to import. |
| Live data | `experimental_useSidebarThreads()` exposes sidebar thread/project data. Keep BB as the source of truth instead of copying thread records into plugin storage. |
| Branch display | The checked SDK source exposes `thread.environment.branchName`. Resolve the branch from each thread's environment/worktree, not from the project's root directory. |
| State display | `indicator` and `indicatorLabel` are host-resolved display information; `status`, `runtimeStatus`, activity, and pending interactions are separate fields. Display precedence does not automatically define the desired list sort order. |
| Working UI | The official thread row renders its status through `ThreadStatusGlyph` and reads live row status. Preserve working animation and accessible status labels using supported data, without importing that private glyph component. |
| Model-company data | The consulted sidebar payload does not expose a model-company field. The official row resolves `providerId` against agent providers; that is not proof of the company behind a model. A supported model/execution metadata source still needs verification. |
| Native actions | `experimental_useSidebarThreadActions()` exposes thread navigation and mutations. Installed backend references also document `projects.reorder`; its installed declaration and ordering data still need verification. |
| Project pins | No project pin/hide fields or public project-pin API were found in the consulted references. Treat these as plugin-owned presentation preferences unless the installed SDK proves otherwise. |
| Preference synchronization | The official thread-list stores preferences in `bb.storage.kv`, exposes typed RPC, and publishes changes through `bb.realtime`. This is a useful pattern for the new plugin. |
| Header ownership | Replacing the list does not replace the host's global New Thread/search/navigation/footer controls. Separate header/navigation slots exist, but are not needed merely to put a `Projects` heading inside our list. |
| GitHub evolution | Current checked upstream SDK source includes PR state and `experimental_checks`. Older installed reference text describes a narrower PR payload. Verify installed compatibility before relying on those fields. |

### Evidence limitations

- The public guide was fetched, but readable extraction failed because the page is JavaScript-rendered. Its official source confirms that it renders the `plugin-api-docs` product map and directs implementers to authoritative SDK declarations. The interactive guide was not browser-verified.
- The official repository was accessed through the fetch tool. The checked snapshot is `16730475acb27f49612796107f0e76c66d79ae4d`; it is not proof of the API available in the installed app.
- Context7 returned an older `docs/plugin-sidebar-thread-list.md` reference that is absent from this snapshot. Do not rely on its `Original` prop example; the installed authoring reference does not list that prop.
- No build, installation, runtime compatibility check, or live UI verification has been performed.

## 3. Minimal architecture proposal

### Frontend: presentation and interaction

Use TypeScript and BB's supported React frontend runtime. Keep responsibilities small:

| Responsibility | Purpose |
| --- | --- |
| Sidebar entry | Register the list provider and connect BB data to plugin preferences. |
| Sidebar view model | Filter by project name, partition hidden/visible projects, and render By project or a flat None view. Use the saved project sequence; order threads by latest modification within each project or globally in None. |
| Projects header | Render the title, options menu, Add project action, and optional search input. |
| Project group | Render expansion state, project actions, New thread, and reorder interaction. |
| Hidden projects section | Render below Projects, initially collapsed; expanded rows contain only a project name and Show action. |
| Thread row | Render title, live status/working spinner, branch and model-company metadata, active selection, and supported navigation. |
| Model-company resolution | Derive a typed company label only from verified metadata in the latest executed turn; return no label when unavailable. Do not infer from agent identity or the currently configured model. |
| Preference hook | Load persisted preferences, submit validated changes, and apply cross-window updates. |

Keep grouping, project-name matching, and latest-modification thread ordering as simple, explicitly typed transformations. Project reordering is a separate action that updates the saved sequence; rendering must not repeatedly alphabetize projects. Do not introduce a generic rule engine, global state framework, or service layer for every component.

Preserve host navigation behavior: real thread links, supported split-view interactions, mobile drawer closing through `onNavigate`, and documented keyboard-target attributes. SDK hooks do not supply an entire reusable row/menu UI; those controls belong to this plugin.

### Backend: preference persistence only

The proposed backend should own validated reads/writes of the plugin's layout state and publish successful changes. It should not run Git commands, fetch GitHub, poll every thread, or duplicate BB's project/thread database in V1.

Verify whether supported frontend SDK data can supply latest-executed-turn model metadata. If a backend lookup is needed, revisit that boundary before implementation; do not assume a preference-only backend already supplies model history. When the metadata is unavailable, the confirmed behavior is to omit the company label, not substitute another source.

Proposed persisted state:

| Preference | Initial value / purpose |
| --- | --- |
| Schema version | Explicit version for future validation and migrations. |
| Grouping | `project`. |
| Project order choice | `By name` initially; `By name` and `Manual` are the only choices. The saved sequence, not a live alphabetical comparator, controls display order. |
| Project sequence | Preserve stable project IDs in user-defined order and append new IDs; verify whether native project order can be the authoritative store. |
| Show search | `false`. |
| Pinned project IDs | Empty collection; membership uses stable project IDs. |
| Hidden project IDs | Empty collection; hiding does not mutate project lifecycle. |
| Collapsed project IDs | Persist ordinary project expansion state; its initial policy remains open. |

The Hidden projects section is initially collapsed. Whether its later expanded state is remembered is still open; it is separate from ordinary project expansion preferences.

Keep search text transient initially. Use one authoritative project sequence for manual moves, appends, and explicit name-sort actions. Prefer BB's native project order/reorder contract if it supports the required semantics; verify this before choosing plugin-owned order storage. Do not maintain two competing order stores.

Persistence scope must be confirmed before implementation. The recommendation is one plugin-owned configuration synchronized across windows of the same BB server; per-user, per-window, or cross-server behavior is not assumed.

### Data flow

```text
BB live sidebar hook ──────┐
                          ├─> view model ─> project groups ─> thread rows
Plugin preference state ──┘

Thread/project action ────> supported BB SDK action
Project reorder action ───> one authoritative saved sequence
Layout preference change ─> validated plugin RPC ─> KV ─> realtime update
```

### Libraries and reuse

Use only the SDK/runtime and normal scaffold tooling to establish the first vertical slice. Reuse documented host APIs and allowed UI building blocks, not workspace-only packages from the official monorepo.

The bundled list uses a drag-and-drop library, but replacing its list does **not** inherit that implementation. The project-ordering behavior is now confirmed; evaluate drag-and-drop tooling only when implementing that behavior. Preserve keyboard and touch accessibility rather than choosing a mouse-only implementation to avoid a dependency.

## 4. Interaction rules

Confirmed rules are identified below. Other recommendations remain proposals for review.

### Project order — confirmed behavior

- Expose only By name and Manual; remove Agent activity and Recent.
- Append each new project to the saved project sequence without disturbing existing positions.
- A manual drag updates and persists that sequence and selects Manual.
- Selecting Manual preserves the current sequence; it does not restore an older arrangement.
- Selecting By name alphabetizes the current sequence at that moment and saves the result.
- Do not alphabetize again just because projects are rendered, updated, or added. The initial By name menu choice does not enable continuous sorting.
- Name sorting and manual moves affect project positions only, never thread order.

### Thread order — confirmed behavior

Use the BB thread's modification timestamp (`updatedAt` in the consulted sidebar payload), descending. Apply it within each project in By project mode and across the whole visible thread list in None mode.

Do not prioritize running, idle, unread, waiting, or error categories above a more recently modified thread. Keep those indicators and the spinner live independently. For equal timestamps, a stable thread-ID tie-breaker is a deterministic implementation recommendation.

### Grouping and search — confirmed behavior

- Group by offers only By project and None; remove By status.
- By project shows project groups in the saved project order, with threads ordered by latest modification inside each group.
- None removes individual project names/headers from the visible content and presents one globally ordered thread list.
- Search matches only project names. Matching a thread title, branch, company, or status cannot include a project.
- Search filters only the Projects section; Pinned and Hidden projects are never filtered.
- In None mode, still filter projects by their names first, then collect and order their visible threads. Do not change the matching fields because project headers are absent.
- A project-name match must not make a hidden project's threads visible. Recovery remains an explicit Show action.

### Pinning and visibility

- Pinned, ordinary visible, and hidden project sets are disjoint.
- Unpin returns the project to the ordinary Projects list under the selected project order.
- Hide affects sidebar visibility only: no archive, deletion, cancellation, or agent shutdown.
- Hidden projects must not remain visible under Projects or Pinned.
- If no visible pinned projects remain, the proposal is to hide the Pinned section rather than display an empty heading.

### Hidden projects — confirmed recovery flow

- Place the Hidden projects section below Projects and start it collapsed.
- Expanding it shows only hidden projects, with one project name and a right-aligned Show button per row.
- Do not render threads, branch/company metadata, New thread, overflow menus, or additional actions inside hidden project rows.
- Clicking Show removes the project from Hidden projects and returns it to the ordinary Projects list in the saved project sequence, without duplication.
- A formerly pinned project must always return to Projects, never Pinned. Clear its project pin no later than the Show transition; do not resurrect previous pinned placement.
- In None mode, restored threads participate in the flat list under the same name-search and modification-order rules, without reintroducing a project header.

This replaces the earlier proposal to restore projects through Sidebar options. Empty-section visibility and whether to remember expansion remain open.

### Branch presentation

Use the branch reported for the thread's environment. Two threads in one project may legitimately show different branches.

A missing environment or branch must not be replaced with an invented `main` branch or the project's branch. Non-Git, detached, remote, unavailable, and not-yet-created environments require explicit presentation rules; a null branch alone does not establish which case applies.

### Model-company presentation

Display only the company behind the model used in the thread: for example, OpenAI, Anthropic, or xAI. Do not substitute agent names such as Pi, Codex, or Claude Code, or display a full model/version identifier in place of the requested company label.

Use authoritative metadata from the latest executed turn. This is confirmed behavior, including threads that change models. A provider's currently configured model is not a substitute for the model that actually executed that turn.

If there is no executed turn, no usable model-company metadata, or no supported lookup available, render no company label or placeholder. Do not fall back to an older turn, a configured model, an agent provider ID, or a guessed company. The exact supported lookup remains a technical verification item, not an unresolved display policy.

### Working spinner — confirmed requirement

Preserve the animated working indicator in each working thread row, including threads inside Pinned projects. Drive it from BB's live execution/activity data, not from the company label, branch, selection, unread state, or an assumed timer.

Adding metadata must not hide the spinner. Preserve accessible status labels and attention/error indicators; the precise placement when working and attention states coexist remains a layout detail to verify. Reordering threads must not reset or replace their live working state.

### Persistence and errors

Validate RPC input and stored preference data. Distinguish first-use initialization from invalid/corrupt data; do not silently reset corrupt preferences or report a failed write as saved.

Show a concise, actionable user-facing error when an action fails. Use BB's structured logging for diagnostic details, without exposing internal errors or secrets in the sidebar.

## 5. Decisions still open

These questions do not prevent reviewing this draft. They must be resolved before implementing the affected behavior.

| Decision | Why it matters | Proposed review direction |
| --- | --- | --- |
| Project-order storage | The behavior is confirmed, but the installed native reorder contract has not been verified. | Choose one authoritative store that preserves manual placement, appends new projects, and persists explicit name-sort results. |
| Pinned ordering | Pinned is a separate project section, but its relationship with the shared saved sequence is not explicit. | Recommend preserving each section's relative order from one saved sequence; confirm the drag targets and scope of Sort by name. |
| Project-management controls in None | The visible content is confirmed to be a flat thread list without individual project headers. | Decide where project pin/hide/new-thread controls and hidden-project recovery remain accessible without adding project groups to that list. |
| Name-search matching details | The matching field is confirmed to be project name only. | Decide case sensitivity, substring/token matching, and diacritic handling; never broaden the search to thread metadata. |
| Latest-turn company lookup | Display policy is settled, but the public metadata lookup still needs verification. | Verify a supported latest-executed-turn source. If unavailable, show nothing; do not substitute configured-model or agent identity. |
| Hidden section empty/expanded behavior | The section starts collapsed, but empty visibility and subsequent expansion persistence were not specified. | Decide whether an empty section is shown and whether expansion is remembered. Restore location and row controls are already confirmed. |
| Project overflow menu | Pin/Unpin and Hide are needed, but other actions were not specified. | Keep the first menu minimal; add settings/rename/remove only if requested and supported. |
| Add project integration | The header action is required, but the exact host flow was not checked. | Verify and reuse a supported host action rather than implementing a second project-creation wizard. |
| Existing native thread pins and nested threads | BB has native thread pinning and parent/child relationships. | Avoid mutating native pins; decide how existing pinned, nested, archived, and helper-hidden threads appear in the replacement list. |
| Preference scope and expansion defaults | Multi-window/server behavior and initial collapsed state affect usability. | Confirm scope and default expansion before finalizing persistence. |

## 6. Future GitHub PR and checks

The intended later enhancement is a branch-associated PR badge and details popover showing PR state and check state, following the supplied visual reference.

BB exposes `experimental_useSidebarThreadPullRequest(threadId)`. In the checked upstream SDK source, PR state includes `draft`, `open`, `merged`, and `closed`; `experimental_checks.state` includes `passing`, `failing`, `pending`, `no_checks`, and `unknown`.

This means a custom GitHub client may not be necessary. First verify the installed SDK, the official GitHub plugin's availability/configuration, authentication boundaries, refresh behavior, and whether the existing hook satisfies the intended UX. Do not add credentials, GitHub requests, or PR polling to V1.

## 7. Review checklist and next step

### Requirements to preserve

- [ ] Pinning a project moves it into Pinned without duplicating it.
- [ ] Unpinning the last visible pinned project removes the Pinned section.
- [ ] Project sorting exposes only By name and Manual; neither changes thread order.
- [ ] New projects append without moving existing projects, including after a prior name-sort action.
- [ ] Manual positions persist; By name reorders only when explicitly selected and saves the result.
- [ ] Threads are ordered by latest modification first, regardless of execution-state category.
- [ ] Grouping exposes only By project and None; no status grouping exists.
- [ ] None shows one flat visible thread list with no individual project names/headers and global latest-modification ordering.
- [ ] Each thread shows its own environment branch, not a project-wide guess.
- [ ] Each thread displays only the model company from its latest executed turn when available; otherwise no company label or placeholder appears.
- [ ] Working threads retain an animated spinner alongside the added metadata, including inside Pinned projects.
- [ ] Hidden projects appear below Projects in a section collapsed by default.
- [ ] Expanded hidden rows show only the project name and one right-aligned Show button.
- [ ] Show returns a hidden project to Projects without duplicates and never restores Pinned placement.
- [ ] Search is initially hidden and appears only when enabled.
- [ ] Search matches project names only, including when None hides the project headers.
- [ ] Project actions do not accidentally archive/delete projects or change thread pin state.
- [ ] Reload and cross-window behavior match the agreed persistence scope.
- [ ] Navigation, keyboard interaction, mobile behavior, and project reordering remain usable.
- [ ] GitHub PR/check display remains outside the first version.

**Next step:** review the remaining layout/storage details, especially Pinned order and project-management controls in None. Then verify installed SDK compatibility and authorize the smallest implementation slice. Project ordering, latest-modification thread ordering, grouping options, search fields, model-label availability, and restoration destination are already settled. This document does not authorize scaffolding, dependency installation, app changes, or commits.

Only document readback and source comparison apply to this draft. No tests, builds, or lint commands were run; functional verification belongs to the implementation phase and remains subject to the user's instruction to request those commands explicitly.

## Sources

Official repository links below are pinned to the inspected snapshot, not assumed to match the installed app.

1. [BB Plugin Guide](https://getbb.app/plugin-guide) — readable fetch limited by JavaScript rendering.
2. [Official plugins](https://github.com/get-bb/bb/tree/16730475acb27f49612796107f0e76c66d79ae4d/plugins).
3. [Thread-list overview](https://github.com/get-bb/bb/blob/16730475acb27f49612796107f0e76c66d79ae4d/plugins/thread-list/PLUGIN_OVERVIEW.md).
4. [Thread-list manifest and dependencies](https://github.com/get-bb/bb/blob/16730475acb27f49612796107f0e76c66d79ae4d/plugins/thread-list/package.json).
5. [Thread-list preference backend](https://github.com/get-bb/bb/blob/16730475acb27f49612796107f0e76c66d79ae4d/plugins/thread-list/server.ts#L1-L111).
6. [SDK sidebar data and PR contract](https://github.com/get-bb/bb/blob/16730475acb27f49612796107f0e76c66d79ae4d/packages/plugin-sdk/src/app-contract.ts#L1038-L1267).
7. [Plugin Guide frontend source](https://github.com/get-bb/bb/blob/16730475acb27f49612796107f0e76c66d79ae4d/apps/web/src/plugin-guide/plugin-guide.tsx).
8. Installed `bb-plugin-authoring` references: `frontend-registration.md` (sidebar slot, hooks, payloads, ownership), `frontend-hooks-and-ui.md` (SDK/RPC), `backend-foundation.md` (storage), and `backend-sdk.md` (project reorder).
9. Installed `thread-list` skill — layout preference ownership and native thread pin behavior.
10. [Official thread row and live status integration](https://github.com/get-bb/bb/blob/16730475acb27f49612796107f0e76c66d79ae4d/plugins/thread-list/app/rows/ThreadRow.tsx#L27-L48) — agent provider hooks and status rendering; the private glyph import and render path are visible in [the same source](https://github.com/get-bb/bb/blob/16730475acb27f49612796107f0e76c66d79ae4d/plugins/thread-list/app/rows/ThreadRow.tsx#L95-L296).
