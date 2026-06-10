# Quoru Threat Model

Status: draft / outline.

## Scope

Quoru is the durable conversation runtime for multi-agent systems.
This document covers concerns relevant to multi-agent collaboration
within a single trust boundary (one organization, or one operator's
fleet). Cross-organization trust establishment is the transport's
responsibility, not Quoru's.

## In scope

- Conversation-scoped authorization: who can send which event at which
  state of a given conversation.
- Authority chain: every step records who acted, on what evidence, with
  what claim.
- Recursion and budget control: hop count, path record,
  per-conversation token cap.
- Schema enforcement at the conversation boundary: events that don't
  match declared shape are rejected by the runtime, not just by
  application code.
- Replay correctness: deterministic re-execution against the durable
  log.

## Out of scope

- Peer-org snooping (single-trust-boundary product).
- Byzantine transports.
- Covert-channel hardening.
- Identity establishment (delegated to transport).
- Routing-layer access control (delegated to AGP or transport).

## Open questions

- TBD as the design develops. Threats will be enumerated against the
  pack contract once it stabilizes in [`architecture.md`](architecture.md).
