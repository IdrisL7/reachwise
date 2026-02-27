# Reachwise Product Roadmap (Evidence-First Hooks)

This is a working roadmap for how Reachwise evolves from a live demo into a focused outbound tool that plays nicely with Clay and Apollo.

## 1. Evidence in the UI

**Goal:** Make the "provable" part of hooks visible, not just implied.

### 1.1 Hook evidence panel

- For each generated hook, expose:
  - `source_title`
  - `evidence_snippet`
  - `source_url`
  - (Optional) `confidence: high | med`
- UI pattern:
  - A small "View evidence" toggle under each hook that expands to show the above.
- Data source:
  - Use the existing `structured_hooks` and `citations` returned from `/api/generate-hooks`.

### 1.2 Internal consistency checks

- Ensure the UI renders only hooks that passed the server-side quality gate:
  - Signal → Implication → Question.
  - Confidence ∈ {`high`, `med`}.
  - Banned phrases filtered.

---

## 2. Batch mode (multi-URL hooks)

**Goal:** Let users paste a list of accounts and get hooks for each, without building a full Clay/Apollo clone.

### 2.1 MVP

- Input: Textarea or CSV upload with company URLs (one per line).
- Backend:
  - Queue `/api/generate-hooks` calls per URL.
  - Limit: start with 10–25 URLs per batch.
- Output:
  - Table: `URL | Hook 1 | Hook 2 | Hook 3 | Actions`.
  - Actions: copy row, download CSV.

### 2.2 Follow-ups

- Allow a simple "angle" field per batch (passed as `context`).
- Add progress indicators for long batches.

---

## 3. Outbound tool shortcuts

**Goal:** Make Reachwise the "hook layer" that plugs into whatever sending tool teams already use.

### 3.1 Copy presets

For each account row:

- Buttons like:
  - "Copy for Apollo"
  - "Copy for generic sequencer"
- Each button formats hooks into a snippet that matches that tool's variable style (text-only to start).

### 3.2 Docs / snippets

- Add a small "How to plug into Clay/Apollo" doc with:
  - Example columns.
  - Copy/paste snippets.

---

## 4. Hook review / autopsy mode

**Goal:** Help teams improve hooks they already write, using the Reachwise doctrine.

### 4.1 Hook reviewer

- Input:
  - Company URL.
  - One or more hooks written by the user.
- Output:
  - Score per hook (based on doctrine: evidence, specificity, question, banned phrases).
  - Suggestions: how to fix each hook.

### 4.2 Content tie-in

- This mode feeds social content:
  - "Hook autopsies".
  - Before/after examples.

---

## 5. Future: deeper integrations (optional)

Once the core is solid:

- Clay: simple bridge that takes Clay list exports and runs them through Reachwise.
- Apollo: copy/paste and basic API examples for pushing hooks into Apollo sequences.

---

*This file is meant to stay high-level and opinionated. Implementation details live in code comments and PRs; this document captures the direction so we do not drift back toward generic hooks.*
