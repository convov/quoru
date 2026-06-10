# AGP Alignment

The AGNTCY Agent Gateway Protocol (AGP) covers transport-level concerns
for multi-agent systems: routing, identity verification, mutual TLS,
capability advertisement, and role-based access control between agents.

Quoru sits at a different layer: durable conversation state, replay,
authority audit, saga compensation, and conversation-scoped authorization.

## Alignment without dependency

Quoru is transport-agnostic by design. MCP is the default agent
transport — the daemon ships an MCP server so LLM agents (Claude,
etc.) can connect with zero custom client code. AGP, A2A, and plain
HTTP are also supported via the daemon's native API. Quoru consumes
whatever identity assertion the transport produces and adds its own
conversation-level authz on top.

## Non-overlap rules

Quoru does NOT:

- Define an identity scheme. Identity tokens are opaque input.
- Discover or route. Endpoints are configured by the application or AGP.
- Define transport-level access control.
- Advertise capabilities. Conversation schemas live in pack manifests;
  exposing them as AGNTCY OASF descriptors is an external-adapter concern.
- Define a wire protocol. Events serialize to whatever the transport
  accepts.

## Vocabulary discipline

To keep layers visibly distinct, Quoru avoids AGNTCY-claimed terms for
its own primitives: no `intent`, `squad`, `capability`, or `policy` in
Quoru-native vocabulary.

Quoru terms: conversation, participant, step, authority.
