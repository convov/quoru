# Quoru

Durable conversation runtime for multi-agent systems.

Quoru runs multi-agent conversations as crash-safe, replayable, audited
state machines. Conversations are first-class artifacts: they survive
restarts, replay deterministically, and carry an authority chain across
every participant action.

Quoru sits above existing agent transports (MCP, A2A, AGP, plain HTTP) —
they move bytes between agents; Quoru owns the conversation lifecycle.

## Status

Design phase. The threat model (`docs/threat-model.md`) and architecture
spec (`docs/architecture.md`) are the current deliverables. Initial release
will include the runtime, SDK, CLI, and a coordination pack as the first
reference conversation pattern.

## Architecture

- **Quoru Runtime** — the durable conversation engine. Small, stable
  API, slow-changing.
- **Quoru Pack** — distributable bundle (conversation state machines +
  worker code + manifest). The unit of evolution. Coordination is a
  pack. SRE is a pack. Review is a pack.
- **Conversation** — a running instance driven by a pack.

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
