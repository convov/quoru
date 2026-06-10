# Quoru

Durable conversation runtime for multi-agent systems.

Quoru runs multi-agent conversations as crash-safe, replayable, audited
state machines. Conversations are first-class artifacts: they survive
restarts, replay deterministically, and carry an authority chain across
every participant action.

Quoru sits above existing agent transports (MCP, A2A, AGP, plain HTTP) —
they move bytes between agents; Quoru owns the conversation lifecycle.

## Status

Design phase. Current deliverables: architecture (`docs/architecture.md`),
pack contract (`docs/pack-contract.md`), federation
(`docs/federation.md`), pack distribution & safety
(`docs/pack-distribution.md`), threat model (`docs/threat-model.md`),
user journeys (`docs/user-journeys.md`), scope (`docs/scope.md`),
reference packs (`docs/packs/`), and use cases (`docs/use-cases/`).
Initial release will include the runtime, SDK, CLI, and a
separately-distributed reference packs repo with the **`eng` team
pack** as the first reference (see `docs/packs/eng.md`).

## Architecture

Quoru is a daemon that hosts durable multi-agent conversations.
Conversations are [Fuse](https://github.com/convov/fuse) workflows;
pack-shipped workers perform side effects; external agents drive the
conversation over MCP.

- **Quoru Runtime** — the daemon. Embeds Fuse for durable execution,
  supervises pack workers, exposes a native API and an MCP server.
- **Quoru Pack** — distributable bundle of `.fuse` workflows and
  entities + worker code + a manifest declaring the contract. The
  unit of evolution. A pack defines a **team**: a set of roles
  (agent and human), the verbs that team can perform, and the
  workflows that coordinate them. Engineering is a pack. SRE is a
  pack. Compliance is a pack.
- **Conversation** — a running instance of a pack's entry workflow.
  Pinned to the pack version it started under.

Quoru is layered over Fuse and would in principle reuse a *Fuse App
SDK* (not yet extracted) for the daemon scaffolding, pack format, and
work-queue primitives that any Fuse-powered domain app would need.
See `docs/architecture.md` for the tier model.

Quoru aligns with the AGNTCY Agent Gateway Protocol (AGP) without
duplicating its surface: AGP handles transport-level identity, routing,
and authorization between agents; Quoru handles conversation-level
durable state, replay, and authority audit. See `docs/agp-alignment.md`.

## Why open source

Quoru's runtime is open source so you can self-host it, audit exactly
what moves through agent conversations, and never get vendor-locked.
The hosted version we run adds operating quality — multi-tenancy,
replay storage, observability — that we can't meaningfully ship in a
tarball. The runtime is the same in both.

## License

[BSL 1.1](LICENSE), converts to Apache 2.0 four years after first
publication of each version.

## Deployment

Self-host the runtime binary, or use the managed cloud tier (coming).
