# Quoru Federation

Status: draft. Federation is a v1 feature: Quoru daemons can connect
into a graph and conversations can span multiple daemons through
bridged participation.

## Why federation

A single Quoru daemon is a useful local tool. Many real conversations
naturally span trust boundaries:

- A developer's local Quoru asks a team Quoru asks an org Quoru.
- A coding agent in one org needs to design against an API owned by
  another org; the conversation invites the second org's Quoru.
- An SRE agent investigating a failing call invites the SRE Quoru of
  the downstream service into the incident conversation.

These cross-boundary collaborations must preserve each side's data
sovereignty: my org's conversation log lives in my org's storage, and
yours lives in yours. Federation makes that possible.

## Layer split

Federation cuts across two layers (see
[`architecture.md`](architecture.md) for the full tier model):

- **Bridge primitive** — *future Fuse App SDK territory.* The
  mechanism for two Fuse-app daemons to establish a bidirectional
  event channel between two specific workflow executions, with
  foreign-principal binding and cross-log audit. Generic; any Fuse
  app could use it.
- **Conversation bridging** — *Quoru.* What bridging *means* in
  conversation terms: how roles map across the boundary, how
  MCP-connected agents see remote participants, how the assignment
  model handles bridge invitations, which events are bridge-eligible,
  the cross-org UX.

The split is drawn in this doc so the line is clear when the SDK is
eventually extracted. Today both halves are built inside the Quoru
daemon.

## What Quoru specifies vs. delegates

**Quoru specifies:**

- The **bridge contract** — how a bridged conversation looks on each
  side, the wire format for bridge events, how identity assertions
  cross, how each side's log links to the other for audit.
- **Pack-level bridge declarations** — which events in a pack are
  bridge-eligible, what the symmetry requirements are between the
  two sides.
- **Local policy hooks** — accept/reject decisions for incoming
  bridge requests live in the daemon and are configurable per peer.

**Quoru does not specify:**

- **Matching / discovery / routing.** How two quorus find each other
  is pluggable. Direct peer config works. A capability broadcast
  ("anyone who knows X?") works. AGP-mediated discovery works. A
  DHT works. The daemon consumes "a peer has been matched" as input;
  the matching mechanism is operator choice.
- **Identity issuance.** Each quoru issues principals within its own
  trust boundary. Federation consumes foreign identity assertions
  via whatever transport is configured (mTLS, OIDC federation, AGP
  identity, etc.).

This is the same non-overlap discipline as
[`agp-alignment.md`](agp-alignment.md): if AGP handles discovery and
identity, Quoru consumes its output. If something else does, Quoru
consumes that. The line is durable.

## The bridge contract

### Bridged, not unified

A bridged conversation is *two* conversations, one on each side,
linked through their event logs. There is no single canonical
conversation that spans both daemons.

- Side A has conversation `conv_A`. Side B has conversation `conv_B`.
- A bridge event in `conv_A` references an event in `conv_B` by
  `(peer-id, conversation-id, event-id, content-hash)` — the same
  evidence-reference shape as intra-conversation references, just
  with `peer-id` prepended.
- Each side's log is sovereign: side A's audit walks side A's log;
  evidence pointers into `conv_B` are verifiable by asking side B
  for the referenced event and checking the hash.
- Replay on side A re-runs `conv_A` without re-contacting side B —
  bridge events replay as recorded (the runtime does not re-call
  the peer), the same way agent-emitted events replay as recorded.

Unified (one log, remote write-through) was considered and rejected:
it requires the remote side to trust someone else's storage as
authoritative for their own conversation, which is a non-starter
across trust boundaries.

### Bidirectional, not directional

Once established, a bridge is a **bidirectional channel**. Either
side may emit a `BridgeEvent` carrying any event that is
admissible-from-the-other-direction per the pack's bridge
declaration. The initial `BridgeRequested` chooses who *opens* the
channel, but it does not pin who can send subsequently.

In practice this matters because cross-team work often flows in
both directions on the same bridge:

- Side A asks side B for work (`intake-request` flows A→B).
- Side B accepts, ships, and gates a follow-on on side A's
  delivering an artifact (`deliverable-request` flows B→A across
  the *same* bridge).
- Side A delivers; side B carves the follow-on.

This is why bridge admissible-events are *typed by direction*
(see [`pack-contract.md` § Cross-team intents](pack-contract.md#cross-team-intents)).
Each side's pack declares what events it admits from the peer; the
two declarations together define the bidirectional contract.

### Bridge events

Three event types govern the bridge:

- **`BridgeRequested`** — emitted on side A by the workflow when it
  wants external participation. Carries a target description
  (peer-id if direct, capability descriptor if broadcast), the pack
  to use, the role being requested, and any payload that should
  travel with the invitation.
- **`BridgeAccepted` / `BridgeRejected`** — recorded on side A when
  the matched peer responds. On accept, includes side B's
  `(peer-id, conversation-id)` so side A can address future bridge
  events. On reject, includes a reason code.
- **`BridgeEvent`** — wraps a payload event that crosses the
  boundary. Carries the foreign principal (side B's actor who
  emitted it), the foreign role they hold in `conv_B`, and the
  evidence reference into side B's log.

All three are runtime-internal events per the threat-model resolution
("Internal events: fixed runtime vocabulary, declared, not
extensible"). Packs can write transitions that handle them but cannot
redefine or extend the bridge vocabulary.

### Foreign principal binding

When a bridge is established, side A records a synthetic local
participant: `(peer-id, foreign-principal, foreign-role)` bound to
`conv_A`. Events arriving from side B are admitted under this
synthetic actor.

- Side A's authority chain shows: "event X, actor = (peer:acme,
  principal:alice, role:reviewer in their conv_B)." Audit can verify
  the foreign principal's authority by asking side B for the join
  event in `conv_B`.
- Foreign principals never gain native authority on side A. A
  foreign reviewer in `conv_A` cannot transition `conv_A` to a state
  that's reserved for native principals. Role mapping (see below)
  decides which side-A states accept foreign participation.

### Role mapping

A bridge does not magically make a `reviewer` on side A the same as
a `reviewer` on side B. Packs declare role mappings in the manifest:

```toml
[[workflows.bridges]]
when-state = "AwaitingExternalReview"
emit = "BridgeRequested"
target-pack = "design-collab"
target-role = "external-reviewer"
local-synthetic-role = "external-reviewer"
admissible-events = ["DesignFeedback", "DesignApproved"]
```

This says: when `conv_A` enters `AwaitingExternalReview`, request a
bridge. The peer's pack must be `design-collab`; we want them to
fill the role `external-reviewer` over there. Locally, foreign
participants will appear in `conv_A` as the synthetic role
`external-reviewer`. Only the two listed event types can cross from
side B into side A.

This declaration is the contract that admits foreign events without
opening the rest of `conv_A`'s state machine to remote influence.

### Cross-log audit

Audit across a bridge walks both logs:

1. Auditor pulls `conv_A`'s log from side A.
2. Every `BridgeEvent` in `conv_A` references `(peer-id,
   conv-id-on-B, event-id-on-B, content-hash)`.
3. Auditor asks side B for the referenced event in `conv_B`.
4. Auditor checks the returned event's hash matches the reference.
5. To verify the foreign principal's claim, auditor walks back to
   `conv_B`'s join event (recorded on side B) and verifies the
   binding.

Side B's cooperation is required (it's their log), but tampering on
either side is detectable independently.

## Stall visibility: no SLAs

Quoru does **not** specify SLAs for bridge progress (peer accepted
but is slow, intake stuck in triage, clarification round unanswered,
etc.). A stalled bridge means one of three things: the remote
agent is offline, the remote daemon is unreachable, or the remote
team is genuinely sitting on the request. The first two are
operational; the third is a human decision the remote team needs
to make.

In all three cases, the right surface is the **control tower**, not
a timeout in the pack contract:

- The receiving side's dashboard shows the intake sitting in its
  triage state with no activity since X.
- The sending side's dashboard shows its conversation in
  `AwaitingExternal` with no inbound bridge events since X.
- A human on either side can see the stall and act — chase the
  remote team out-of-band, restart agents, escalate, or proceed
  with a fallback.

See [`architecture.md` § UI and BFF](architecture.md#ui-and-bff) for
the control-tower requirements (must render with zero agents
connected; must outlive every agent; surfaces stalls without
timeouts).

The one timeout federation *does* specify is **bridge
establishment** — if no peer accepts a `BridgeRequested` within a
configurable window, the originating workflow may declare the
bridge failed and take an `on-timeout` transition (see the bridge
declaration in [`pack-contract.md`](pack-contract.md)). This is
about "can we connect at all," not "are they responding fast
enough."

## Matching is pluggable

How `BridgeRequested` reaches the right peer is *not* Quoru's
business. The daemon exposes a **matcher interface**; operators
configure which matcher(s) are active.

Reference matchers Quoru ships:

- **Direct-peer matcher.** Operator configures named peers
  (`peers.acme = "https://quoru.acme.com:9000"` with mTLS material).
  `BridgeRequested` events with a direct `peer-id` route to the
  configured peer. Simplest case; works without any discovery layer.
- **Broadcast-and-respond matcher.** `BridgeRequested` events
  without a direct `peer-id` are broadcast to the configured peer
  set (or some subset thereof per gossip policy). Peers respond if
  their installed packs and capabilities match the request. First
  acceptable response wins (or selection policy applies).

Beyond these, operators can plug in:

- AGP-mediated discovery (let AGP advertise capabilities and route).
- A registry service that maps capability descriptors to peers.
- A DHT for fully decentralized discovery.

The matcher's only contract: given a `BridgeRequested`, return zero
or more `(peer-id, peer-endpoint, credentials)` tuples that the
daemon then attempts to contact. Acceptance is still the remote
peer's decision.

## Trust and identity

For v1, three trust modes:

- **Manual mTLS** between named peers. Operator-provisioned client
  certificates; mutual TLS at the daemon's federation port. Most
  conservative.
- **Shared CA.** All peers in an org chain trust the same CA.
  Simpler for hierarchical deployments (dev → team → org).
- **External identity provider.** Both sides federate to a common
  OIDC issuer or equivalent. Principal assertions are signed by
  the IdP; peers verify the signature.

These are not mutually exclusive; a single daemon can use different
modes for different peers (mTLS to intra-org peers, OIDC to a
specific cross-org partner).

## Controlled gossip

Gossip propagates *who exists* and *what capabilities they expose*,
nothing about active conversations. Each peer link has a propagation
policy:

```toml
[[peers]]
name = "team-platform"
endpoint = "https://platform-quoru.acme.internal:9000"
trust = "mtls"

[peers.gossip]
# What we share with this peer about other peers we know:
share = ["org-quoru", "team-research"]
# What we accept from this peer about peers they know:
accept = "all"
# Capability advertisement we send to this peer:
advertise-capabilities = ["coordination", "code-review"]
```

Defaults are conservative: share nothing, accept nothing, advertise
nothing. Federation in a vacuum requires explicit opt-in per link.

Specifically *not* gossiped:

- Active conversation IDs.
- Per-conversation participants.
- Conversation contents or event logs.

Confidentiality of in-flight work stays inside each daemon. Gossip
is for "can I in principle reach Y" answers, not for surveillance.

## Pack symmetry

A bridge between two daemons works only if both sides understand the
events being exchanged. Two patterns:

- **Shared bridge pack.** Both daemons have the same pack installed
  (same name, compatible version). Bridge events are typed against
  that pack's event schemas. Simplest; the obvious starting point.
- **Adapter pack.** Each side has its own pack with adapter
  workflows that translate bridge events into / out of its native
  vocabulary. More flexible (lets each side evolve independently)
  but doubles the contract surface. Not v1.

v1 requires shared bridge packs. The manifest's bridge declaration
includes the expected peer pack name and version range; the daemon
refuses bridges where the peer's pack doesn't satisfy the range.

## Open questions

- **Pack distribution across the mesh.** If side A wants to bridge
  with side B but B doesn't have the required pack installed,
  does the daemon attempt to install it on B (with B's policy
  approval), or does the bridge just fail? v1 leans "bridge fails;
  install is out-of-band." Worth confirming.
- **Bridge cycles.** A → B → C → A. Should the runtime detect and
  refuse, or let cycles run? Cycles compose poorly with budget
  aggregation (which conversation is the "root"?). Probably refuse
  in v1.
- **Multi-peer bridges.** Can one `BridgeRequested` bring in
  multiple peers (e.g., asking three review boards simultaneously)?
  Cleaner to model as N separate bridges and let the workflow
  reason over the responses. v1 supports one peer per bridge
  request.
- **Bridge termination.** Either side can close; both closing is
  the normal path. A bridge closes implicitly when its originating
  workflow state on side A exits (the `when-state` no longer holds),
  and side B is notified via a bridge-close event so it can
  transition its own conversation accordingly. Forced close from
  side B (e.g., "we're abandoning this") is also allowed and
  surfaces on side A's dashboard as a bridge-terminated condition.

## Cross-reference

- Threats arising from federation (foreign principal impersonation,
  bridge event spoofing, gossip pollution, cross-boundary
  confidentiality, federated DoS) — to be added to
  [`threat-model.md`](threat-model.md) as a new section. The
  "single trust boundary" scoping of the current threat model is
  superseded by federation; the bridge becomes the explicit trust
  boundary.
- Pack manifest bridge declarations — to be folded into
  [`pack-contract.md`](pack-contract.md).
- A third user journey (cross-org collaboration through federation)
  — candidate addition to [`user-journeys.md`](user-journeys.md).
