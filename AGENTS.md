# Quoru — Agent Context

Project context for any coding agent (Codex, Claude Code, Cursor, etc.) working in this repo. Same conventions apply regardless of which agent you are.

## TL;DR

- **Read [`CLAUDE.md`](CLAUDE.md) for the full version.** It is named for historical reasons but applies to every agent. Everything in this file is a thin pointer to a section there.
- This project spans **two repos** that must be worked on together: `/Users/sammy/github/quoru` (this one, public) and `/Users/sammy/github/quoru-internal` (private, strategy + roadmap + cloud crates). Make sure both are on your path.
- Roadmap source of truth is `../quoru-internal/docs/roadmap/roadmap.yaml`. Read it fresh before picking work; never trust a cached snapshot.
- Quoru is layered on [Fuse](https://github.com/convov/fuse). Fuse owns durable execution; Quoru owns conversation lifecycle + pack format.

## Where the load-bearing pieces live

- Full conventions: [`CLAUDE.md`](CLAUDE.md) in this repo + [`../quoru-internal/CLAUDE.md`](../quoru-internal/CLAUDE.md).
- Roadmap source of truth: `../quoru-internal/docs/roadmap/roadmap.yaml`.
- Roadmap conventions: `../quoru-internal/docs/roadmap/CONVENTIONS.md`.
- Glossary (pack / conversation / team / role / run / authority chain / verb / entity / worker / federation): `../quoru-internal/docs/glossary.md`.
- Reference pack (worked example of what a real pack looks like): `packs/eng/`.

## Concurrency

Quoru is single-author / single-session today. The fuse-style claim/ship/drain protocol (worktrees, `touches:`, merge queue) is not yet wired. Commit directly to `main` for now. See `CLAUDE.md` § "Concurrency model — not yet adopted" for why.

## Initial-prompt shape for non-Claude agents

If you are an agent that does not auto-load `CLAUDE.md`, include this in your system/initial prompt or session bootstrap:

```
Read /Users/sammy/github/quoru/CLAUDE.md and
/Users/sammy/github/quoru-internal/CLAUDE.md before doing anything else.
Roadmap source of truth is ../quoru-internal/docs/roadmap/roadmap.yaml.
Quoru is layered on Fuse — see https://github.com/convov/fuse.
```
