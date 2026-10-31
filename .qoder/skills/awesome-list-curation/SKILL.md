---
name: awesome-list-curation
description: Turns an awesome-* curated list (awesome-react, awesome-postgres, awesome-supabase, awesome-compose, awesome-python, …) into a governed library decision for an existing codebase, without treating list membership as approval. Produces a pinned-provenance note, a one-kit-per-capability table, a decision ladder, and a list-vs-repo disagreement table. Use when choosing or rejecting libraries for a surface, when authoring or refreshing a stack/architecture skill, when asked "should we add X", when auditing whether an existing dependency belongs, or when a repo needs a curated alternative to an unfiltered ecosystem survey.
---

# Curating a stack from an awesome-* list

An awesome list is a **catalogue of what exists**, not a budget and not an endorsement. The
sindresorhus `awesome` manifesto is explicit: *"it's a curation, not a collection"* and
*"only put stuff on the list that you … can personally recommend"*. A list entry says the project is
known and maintained enough to be listed; it says nothing about fit, cost, licence, or whether your
codebase already solved that problem.

The job is therefore **subtraction**: turn N candidates per capability into one approved pick plus a
recorded set of rejections.

## Workflow

Copy this checklist and track progress:

```
- [ ] 1. Inventory the actual surface (before opening the list)
- [ ] 2. Pin the list: clone, record commit + licence
- [ ] 3. Read only the sections whose capability you own
- [ ] 4. Classify every candidate: installed / own-rival / candidate / rejected
- [ ] 5. Write the decision ladder (first-hit-wins order)
- [ ] 6. Write the one-kit-per-capability table
- [ ] 7. Write the "list says vs repo does" disagreement table
- [ ] 8. Record provenance + a re-sync recipe
- [ ] 9. Verify: does every row name a file it can be checked against?
```

### 1. Inventory first

Never curate from the list alone. Read the consuming package manifest, the framework config, and the
module that already owns the capability. You are looking for:

- what is already installed (and paired with what),
- what the repo **hand-wrote** for that capability (this is the real rival),
- which gates are enforced (lint, typecheck, tests, CI) — a candidate that cannot pass them is out,
- the deployment shape (static SPA? server? mobile build? managed database?), which disqualifies
  entire list sections.

A section is only interesting if the capability is **missing or visibly failing**. Otherwise note the
owner and move on.

### 2. Pin the list

```bash
git clone --depth 1 https://github.com/<owner>/<awesome-list>.git /tmp/awesome-<topic>
git -C /tmp/awesome-<topic> rev-parse --short HEAD   # record this
ls /tmp/awesome-<topic>; head -3 /tmp/awesome-<topic>/LICENSE 2>/dev/null
```

Record the commit in the output, and the licence: most lists are CC0, some CC-BY-4.0, some ship no
LICENSE file at all (check `README.md` footer before assuming). The list's licence covers the
**list text**, not the projects it links to — each candidate has its own licence, which is the one
that matters when you install it.

Some lists are enormous. Do not read them end to end; grep the headings and read only the sections
whose capability you own:

```bash
grep -n '^#\{2,4\} ' /tmp/awesome-<topic>/README.md
```

### 3. Classify, in this order

| Class | Meaning | What to write |
| --- | --- | --- |
| `installed` | Already a dependency | Version from the manifest, plus its pairing constraint |
| `own-rival` | The repo already implements this capability | Name the module/file that owns it. The candidate is **rejected**, not deferred |
| `candidate` | Capability is missing and this is the pre-approved pick | Why this one, and what adopting it costs |
| `rejected` | Either an own-rival, or a hard mismatch with the repo's shape | The owner or the mismatch |

`own-rival` is the classification that does the work. Most rows in an ecosystem list are rivals to
something the repo already built — a second component kit, a second HTTP client, a second migration
tool. Installing one is not additive; it forks an existing contract.

### 4. Decision ladder

Order the options so an agent stops at the first hit, and make every rung concrete:

1. Language/runtime built-in (or the framework's own API).
2. Something already in the repo (own modules, existing wrappers, existing primitives).
3. A framework built-in / off-the-shelf feature of an installed dependency.
4. An already-installed dependency.
5. A row marked `candidate`.
6. Propose a new dependency — and record it in the table **and** in the repo's rule file in the same
   change.

The ladder is the part that prevents re-surveying the ecosystem on every request.

### 5. One-kit-per-capability table

One approved pick per capability, three statuses (`installed` / `candidate` / `rejected`), and a
column that says **why** — not a feature list. When a row is `rejected`, the "why" is the owner:
`rejected \| zustand \| TanStack Query + URL state`. That sentence is what stops the next agent from
re-proposing it.

Keep versions out of prose and in the table (or derive them from the manifest). A version in a
paragraph goes stale silently.

### 6. The disagreement table

Every list contains advice that is wrong *for this repo*. Write it down explicitly, because the
agent will otherwise read the list literally:

| List says | Here | Why |
| --- | --- | --- |
| Framework X is the default | Vite SPA + router | The deploy target is static; there is no server runtime |
| Library Y is standard | own `src/<module>` | Second kit forks the design tokens |

Add a row the moment a new disagreement is found. This table is the highest-value artifact: it
converts "the list disagrees with us" into a reviewable decision.

### 7. Provenance and re-sync

Record source URL, commit, licence, and either an "authored" marker or a re-sync recipe. If the
skill is **authored** (like this one's outputs), say so and point at the rule file that outranks it.
If it is **vendored** (byte-identical upstream), store the sync recipe and forbid hand-editing.
Never vendor an entire list into the repo; link to it and keep only the decisions.

### 8. Verify before finishing

- Every `own-rival` row names a real file or package.
- Every version in the table exists in a manifest or lock file.
- Every claim about the deploy shape is checkable (config file, not memory).
- The gaps section names the missing capability, not the missing library.
- No row says "considered but not needed" without naming what covers it instead.

## Anti-patterns

- **"Approved libraries" that are just the list's section.** A table of 40 React component kits is
  the list again, not a decision.
- **Adding a library because a section exists.** Sections are topics, not requirements.
- **Treating `candidate` as `installed`.** Candidates are pre-approved *if* the capability is needed;
  they are not a to-do list.
- **Silently installing next to an owner.** If the repo already has one, installing a second is a
  removal task first.
- **Curating from the list alone.** Without the inventory you cannot tell an upgrade from a fork.
- **Versions in prose.** They drift; keep them in one table sourced from the manifest.
- **Pinning a list by URL instead of commit.** The list moves; a decision recorded against "latest"
  cannot be audited.

## Output template

```markdown
# <Surface> stack

Curated against <list URL> (commit `<sha>`, <licence>). Approved table: `LIBRARIES.md` beside this file.
<Repo rule file> outranks this skill.

## The defining facts about this surface
<2–4 bullets: deploy shape, the one client/cache/engine that exists, what is hand-written>

## Decision ladder — run in order, stop at the first hit
1..6 as above

## Where <list> disagrees with this repo
| List says | Here | Why |

## Version floors and pairing
<which packages must move together, and why>

## Adding a dependency
<exact command(s), the consequences to state, where the decision gets recorded>

## Gates before finishing
<commands that must pass>

## Known gaps worth acting on
<ranked; one capability per commit>
```

## Worked example (shape only)

A repo with a hand-built HTTP client and a query cache is asked to adopt a fetching library that is
prominent in an awesome list. The curation records:

- `installed` — the existing client, because it owns auth refresh and the error contract.
- `rejected` — the listed library, owner = that client; adopting it would bypass the 401 path.
- `candidate` — nothing, unless a capability is genuinely missing.

That is a successful curation: the list was read, the answer was "no", and the reason is written
down where the next agent will find it.
