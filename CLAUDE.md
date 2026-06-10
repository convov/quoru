# Quoru — Claude Context

## Two-repo setup

This project spans two repos that must be worked on together:

- `/Users/sammy/github/quoru` — public repo: runtime, SDK, CLI, reference packs, public docs
- `/Users/sammy/github/quoru-internal` — private repo: strategy, roadmap, commercialization, cloud-only crates

Always launch Claude Code with both:
```bash
claude --add-dir ../quoru-internal
```

Or mid-session: `/add-dir ../quoru-internal`

## What Quoru is

Quoru is a durable conversation runtime for multi-agent systems. Conversations run as crash-safe, replayable, audited state machines. The runtime is layered on [Fuse](https://github.com/convov/fuse) — Fuse provides the durable execution engine; Quoru owns the conversation lifecycle, pack format, and authority chain across participants.

Distribution unit is the **pack**: a bundle of `.fuse` workflows + entities + worker code + manifest declaring a team's roles and verbs. Engineering is a pack. SRE is a pack. Compliance is a pack.

## Codebase structure

```
crates/             Rust crates (planned — currently empty)
  quoru-runtime     Daemon: embeds Fuse, hosts conversations, supervises workers
  quoru-sdk         Pack-author SDK
  quoru-cli         Discover / install / run packs
docs/               Public docs (architecture, pack contract, federation, threat model, AGP alignment)
  packs/            Per-pack reference docs (eng.md is the first)
  use-cases/        Worked examples
packs/              Reference packs distributed with the runtime
  eng/              Engineering team pack (10 entities + 11 workflows + 31 hermetic tests + Vite/React inspector)
examples/           Standalone usage examples
```

## License

All current code is BSL 1.1, converts to Apache 2.0 four years after first publication of each version. There is no OSS/paid crate split today — the eventual cloud tier lives in `quoru-internal/cloud/` and never ships in the public repo.

## Roadmap

All phase / workstream / milestone state lives in **`../quoru-internal/docs/roadmap/roadmap.yaml`** — read this first when you need to know what's shipped, planned, or active. Conventions in `../quoru-internal/docs/roadmap/CONVENTIONS.md`.

Current phase as of 2026-06: **P0 shipped** (design + first reference pack), **P1 active** (runtime skeleton).

### Concurrency model — not yet adopted

Quoru is currently single-author / single-session. The full claim/ship/drain protocol that fuse and regent use (worktrees, `touches:`, merge queue, parked branches) is **not yet wired** here. The roadmap.yaml schema is ready for it, but:

- There is no `claim-next.sh` / `drain-queue.sh` / `ship-milestone.sh` shim into `~/github/dotfiles/scripts/agent-coord/` yet.
- The canonical checkout is not yet guarded by a pre-commit hook.
- Direct commits to `main` are fine for now.

This is intentional: the **Quoru-native coordination pack** (planned for P2) is meant to replace the shell-script + roadmap.yaml machinery that fuse / regent / aequa use. Adopting the heavy fuse protocol here now would just create work to throw away. When P1 ships and multiple sessions are realistic, revisit.

### Pack contract changes — read the checklist first

(Placeholder — analog of fuse's DSL change checklist. Any change to the pack manifest schema, worker contract, conversation API surface, or federation wire format has a wide downstream surface — SDK, CLI, examples, eng pack, docs. Checklist will live at `../quoru-internal/docs/pack-contract-checklist.md` once the pack contract stabilizes.)

### Terminology

Glossary of pack / conversation / team / role / run / authority chain / verb / entity / worker / federation terms lives in [`../quoru-internal/docs/glossary.md`](../quoru-internal/docs/glossary.md). When a term is renamed, update the glossary in the same commit. If you find yourself coining a new term twice, add it instead.

### Decision delegation — what's autonomous, what needs confirmation

**Autonomous — proceed without confirmation:**

- Fix lint, format, typo, import-order.
- Add a missing unit test for behavior that's already specified.
- Update a stale memory entry (verify by re-reading the referenced file first).
- Append to `CHANGELOG.md` from milestone notes during ship.
- Update `glossary.md` when a rename is in the milestone scope.
- Edit reference pack `.fuse` files when behavior changes are local to the pack.

**Requires explicit confirmation:**

- Change the **pack contract** (manifest schema, worker contract, conversation API surface) — has downstream impact on SDK, CLI, examples, all reference packs.
- Modify any `pub fn` / `pub struct` / `pub enum` exported from a crate's `lib.rs` (once crates exist).
- Change CI gates or `.github/workflows/` content.
- Modify license headers.
- Add a new top-level crate or pack.
- Resolve a merge conflict in shared design docs.
- Cross the public/internal boundary in either direction.

**When in doubt:** lean confirmation if hard-to-reverse or crosses a published boundary (public API, license, pack contract). Lean autonomous if local to a single doc / file / pack.

## quoru-internal layout

```
docs/
  glossary.md             Term definitions
  roadmap/
    roadmap.yaml          Source of truth: status, dates, ship gates, milestones
    CONVENTIONS.md        ID scheme + editing rules
cloud/                    Multi-tenant managed hosting code (planned)
commercialization/        Pricing, GTM positioning, launch playbook (planned)
```

Never include quoru-internal content in public-facing docs, PRs, or commit messages.

### Public/internal content boundary — enforced in CI

`ci/check-content-boundary.sh` (wired in `.github/workflows/boundary-check.yml`) fails the build if any tracked public file contains:

- Strategy vocabulary: `moat`, `GTM`, `TAM`/`SAM`/`SOM`, `pricing tier`, `competitive advantage`, `go-to-market`, `north star`, `ARR target`, `MRR target`, `burn rate`, `fundrais*`, `revenue projection`
- Any path reference to `quoru-internal/`

Scoped to `*.md`, `*.mdx`, `*.rs`, `*.fuse`, `*.toml`, `*.yml`, `*.yaml`. `CHANGELOG.md`, this file, and `AGENTS.md` are intentionally exempt — they legitimately reference the structure.

When writing public docs, code comments, or commit messages, describe **what the system does**, never **how it competes**. If a framing feels natural here, that's a signal it belongs in `quoru-internal/`, not the public repo.

When adding new banned vocabulary, update both `ci/check-content-boundary.sh` (the regex) and this list.

## Tech stack

- **Runtime**: Rust, Tokio async, embeds [Fuse](https://github.com/convov/fuse) for durable execution
- **Pack format**: `.fuse` workflows + entities + worker binaries + JSON/YAML manifest
- **Transport**: MCP (primary), AGP-aligned where it makes sense, native gRPC for runtime API
- **UI**: React + TypeScript + Vite (the eng pack ships a reference inspector)

## How to run things

```bash
# Run the eng pack's inspector UI (fixture mode — no runtime needed)
cd packs/eng/ui && npm install && npm run dev

# Runtime: not yet implemented (Phase 1)
```
