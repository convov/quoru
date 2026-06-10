# Quoru Threat Model

Status: draft.

## Scope

Quoru is the durable conversation runtime for multi-agent systems.
Conversations live inside a single Quoru daemon's trust boundary;
[`federation.md`](federation.md) describes how conversations span
multiple daemons through bridged participation.

This document covers two scopes:

- **Single-daemon scope.** Concerns within one Quoru daemon's trust
  boundary (one organization, or one operator's fleet). This was
  the original scope and remains the bulk of the threat surface.
- **Federation scope.** Concerns introduced when a daemon bridges to
  a peer daemon under different operational control. The bridge is
  the explicit trust boundary; each side's threat model continues to
  apply within itself, plus new threats arise at the bridge.

Identity establishment within a daemon is still delegated to the
transport. Federation does not change that — each daemon issues
principals in its own trust boundary; bridges consume foreign
identity assertions but do not issue them.

## In scope

Single-daemon:

- Conversation-scoped authorization: who can send which event at
  which state of a given conversation.
- Authority chain: every step records who acted, on what evidence,
  with what claim.
- Recursion and budget control: hop count, path record,
  per-conversation token cap.
- Schema enforcement at the conversation boundary: events that don't
  match declared shape are rejected by the runtime, not just by
  application code.
- Replay correctness: deterministic re-execution against the durable
  log.

Federation:

- Bridge contract integrity: bridged events carry verifiable foreign
  identity, cross-log references are tamper-evident, foreign
  participants are scoped to roles their bridge declaration admits.
- Cross-boundary confidentiality: gossip propagates only declared
  capability metadata, not active conversation state.
- Peer authentication: a daemon claiming to be peer X must
  authenticate as peer X under the configured trust mode.

## Out of scope

- Byzantine transports.
- Covert-channel hardening.
- Identity establishment within a daemon (delegated to transport).
- The matching / discovery / routing layer between peers (delegated;
  see [`federation.md`](federation.md) — Quoru consumes matched
  peers from a pluggable matcher).
- Pack distribution security (how packs get installed on a peer is
  the operator's responsibility; bridges fail closed if the peer
  doesn't have the required pack).

## Threats

Threats below are written against pack-contract concepts that are not
yet fully defined in [`architecture.md`](architecture.md). Each threat
names the runtime invariant it violates; precise mitigations land once
the manifest schema and event format stabilize.

### Authority chain

The authority chain is the per-conversation record of who acted, on
what evidence, with what claim. Consumers (audit, billing, compliance,
downstream policy engines) treat it as ground truth.

- **A1. Forged actor claim.** A worker writes an event tagged with an
  actor identity it was not authorized to speak as. Runtime must bind
  the actor field to the transport-supplied principal at admission
  time, not trust the worker payload.
- **A2. Missing or dangling evidence pointer.** An event claims
  authority derived from a prior event ("approved by E42") but the
  pointer targets a non-existent, wrong-conversation, or
  later-in-the-log event. Runtime must validate evidence references
  at admission and refuse forward references.
- **A3. Log tampering after the fact.** The durable log is mutated
  out-of-band (operator, storage compromise, replication divergence)
  so the recorded chain no longer matches what was admitted. Runtime
  must produce a hash chain or equivalent integrity envelope that
  downstream consumers can verify independently of the log store.
- **A4. Cross-conversation authority replay.** An evidence pointer
  valid in conversation C1 is presented as justification in
  conversation C2. Evidence scope must be the (conversation-id,
  event-id) pair, not event-id alone.
- **A5. Claim/grant mismatch.** A worker presents a claim ("acting on
  behalf of role R") that the conversation machine did not grant it
  in the current state. State-machine admission must check claim
  against the state's grant set, not just event schema.
- **A6. Ship-gate forgery or premature clearance.** A workflow gate
  set by `<pack>.ship(gate-on=...)` (per
  [`pack-contract.md` § Cross-team intents](pack-contract.md#cross-team-intents))
  is cleared by an event whose actor was not authorized to clear it —
  e.g., a local participant emits a synthetic `deliverable-completed`
  event without the cross-team origin reference, or a foreign
  participant clears a gate they had no part in. Conversely, a
  malicious participant sets a spurious gate to indefinitely block
  legitimate follow-on work. Runtime must require gate-set events
  to originate from the ship event's authority chain (only the role
  that called `ship` can attach a `gate-on`); gate-clearance events
  must carry an origin reference matching the gate's declared
  external dependency (i.e., the cross-team request the gate was
  waiting on). A `gate-override` verb exists for the local techlead
  to clear a gate manually, but it is its own authority-chained verb
  and audit-distinct from a real gate-clearance.

### Replay correctness

Replay re-executes a conversation deterministically against the
durable log. If replay diverges from the original execution, the log
no longer represents what happened, and every downstream consumer
that trusts the log is wrong.

- **R1. Nondeterministic worker code.** A worker consults
  wall-clock, system RNG, environment, or process-local state during
  event handling. Runtime must inject time, randomness, and any
  ambient inputs through a recorded effect channel so replay can
  feed the original values.
- **R2. External-call leakage.** A worker makes a network or disk
  call during handling whose response is not captured in the log.
  Runtime must require external effects to go through a recorded
  effect API, and must refuse to replay events whose effects were
  not captured.
- **R3. Clock and ordering drift.** Replay reconstructs event
  ordering from log position, but worker logic depended on
  wall-clock comparison ("if more than 5 minutes since X"). Runtime
  must expose a logical clock derived from the log, not the host
  clock, to worker code.
- **R4. Log truncation or compaction loss.** A retention or compaction
  policy removes events that later replays still need. Runtime must
  treat replay-from-genesis as a first-class operation; any
  compaction must produce a checkpoint that replay can resume from
  without loss of meaning.
- **R5. Schema migration changing past meaning.** An event recorded
  under schema v1 is replayed under schema v2 and now deserializes
  to a different value (or fails). Runtime must record the schema
  version with each event and either replay under the original
  schema or guarantee migration is value-preserving.
- **R6. Pack version drift.** A conversation started under pack v1
  is replayed under pack v2 whose state machine has different
  transitions. Runtime must pin a conversation to the pack version
  it started under, even if a newer version is installed.

### Schema enforcement

The pack manifest declares, per state, which events are admissible
and from which roles. The runtime — not application code — is the
enforcer. If enforcement is bypassable, the conversation machine is
advisory rather than authoritative.

- **S1. Direct log write bypassing admission.** A component with
  storage access appends events directly to the durable log,
  skipping the admission path. Runtime must treat unauthenticated
  log writes as integrity violations and surface them on read.
- **S2. Role spoofing within a conversation.** A participant
  authorized to send events as role R1 sends an event tagged as
  role R2 within the same conversation. Runtime must bind role
  membership at conversation join, not per-event.
- **S3. State-transition violation.** An event is admitted that the
  current state does not list as legal, because admission checked
  schema but not state. Admission must be the conjunction of (schema
  valid) AND (state permits this event from this role).
- **S4. Ambiguous machine definition.** A pack declares overlapping
  transitions (two transitions both legal for the same event in the
  same state) that resolve nondeterministically. Pack loader must
  reject ambiguous machines at install time, not at conversation
  time.
- **S5. Open-world event extension.** A worker appends fields not
  declared in the event schema, and downstream consumers begin to
  rely on them. Runtime must enforce closed-world schemas: unknown
  fields are rejected at admission.
- **S6. Schema enforcement only on the happy path.** Error,
  cancellation, and timeout events bypass schema checks because
  they originate inside the runtime. Internal events must be
  declared in the manifest and checked on the same path as
  worker-originated events.

### Budget and recursion

A conversation can spawn sub-conversations, call out to other
agents, and accumulate token cost. Without runtime-enforced bounds,
a single conversation can fan out unboundedly.

- **B1. Hop-count evasion via fan-out.** Hop count is enforced per
  linear chain but a conversation spawns N sub-conversations at hop
  K-1, each of which spawns N more. Bound must be on total
  descendant count, not just depth.
- **B2. Token-cap circumvention via sub-conversations.** A
  conversation near its token cap spawns a child conversation with
  a fresh cap and delegates work. Caps must aggregate up the
  parent chain, not reset at conversation boundaries.
- **B3. Worker side-effect runaway.** Budget tracks tokens and
  events but a worker performs unbounded external side effects
  (API calls, storage writes, message sends) per event. Effect API
  must accept a budget scope and refuse effects past it.
- **B4. Missing budget on replay.** Budget counters live outside
  the log and are not reconstructed on replay; a replayed
  conversation appears to have unlimited budget. Budget state must
  be derivable from the log alone, like every other piece of
  conversation state.
- **B5. Path-record forgery.** A worker writes its own path-record
  entry rather than letting the runtime append it, so hop count
  understates actual depth. Path record must be runtime-appended
  and immutable to workers.
- **B6. Budget exhaustion as DoS.** An adversarial participant
  drives a conversation to its cap intentionally to deny service
  to legitimate participants. Caps and admission must distinguish
  per-actor consumption so one actor cannot exhaust a shared
  budget.

### Federation

Federation introduces a new threat surface at the bridge. The
single-daemon threats above still apply within each side; the
threats below are specifically those that exist *because* two
daemons under different operational control are exchanging events.

- **F1. Foreign principal impersonation.** A peer claims a foreign
  principal/role binding that the peer cannot actually substantiate
  (no corresponding join event on their side). Bridge events must
  carry a verifiable reference into the peer's log; receiver must
  refuse bridge events whose claimed binding is not backed by an
  inspectable join event on the peer side.
- **F2. Bridge event spoofing.** A third party with network reach
  injects bridge events tagged as coming from a configured peer.
  Peer authentication (mTLS, IdP, or shared CA — whichever trust
  mode is configured) must be applied to every bridge event, not
  just to bridge setup.
- **F3. Role-mapping evasion.** A peer sends events that the local
  bridge declaration's `admissible-events` list does not permit, in
  states the declaration does not allow. Admission must check the
  bridge declaration as strictly as it checks intra-daemon role
  grants — foreign actors get *exactly* the surface their bridge
  declaration grants, no more.
- **F4. Cross-conversation bridge replay.** A bridge event valid
  in bridge instance B1 is replayed as if it belonged to a
  different bridge instance B2. Bridge event references must include
  the bridge-instance identity (peer-id, peer-conv-id, peer-event-id,
  content-hash); admission rejects mismatched references.
- **F5. Gossip pollution.** A peer advertises capabilities or peer
  references that mislead recipients (claims to handle events it
  cannot, points at peers that do not exist or are hostile).
  Gossip-accepted information must be marked as advisory; matchers
  must verify capability claims when bridges are actually attempted,
  not trust gossip alone.
- **F6. Confidentiality leak via gossip.** Gossip is configured
  loosely and ends up propagating information about active
  conversations, participants, or even payload fragments. Gossip
  payload schema must be a closed vocabulary that admits only
  capability metadata; active conversation state has no gossip
  representation.
- **F7. Federated DoS via bridge fan-out.** An adversarial workflow
  emits many `BridgeRequested` events to exhaust local matcher
  bandwidth or to amplify against a peer. Per-conversation and
  per-tenant rate limits on bridge requests; matcher must apply
  back-pressure rather than blocking the local conversation.
- **F8. Confused-deputy across bridge.** A foreign participant in
  `conv_A` causes the local daemon to take an action against a
  third party that the foreign participant could not have taken
  directly (e.g., causes `conv_A` to bridge to a peer the foreign
  side could not reach itself). Bridge invitations originating from
  foreign-participant-driven transitions must be marked as such in
  the authority chain; receivers can refuse bridges whose chain
  shows foreign causation if their policy requires it.
- **F9. Trust mode downgrade.** A configured peer initially
  authenticates via mTLS, then a man-in-the-middle convinces the
  daemon to accept a weaker mode for subsequent events. Peer trust
  mode must be pinned per-peer at config time; downgrade is not a
  runtime choice.
- **F10. Cross-log audit unavailability.** Audit walking a bridge
  requires asking the peer for referenced events; if the peer
  refuses or is offline, audit cannot complete. Each side should
  optionally cache enough of the peer's referenced events
  (signed/hashed by the peer) to allow audit without live peer
  cooperation. Out of v1 if too expensive; document as a known
  limitation.
- **F11. Reverse-direction admission overreach.** Bridges are
  bidirectional once established (see
  [`federation.md` § Bidirectional, not directional](federation.md#bidirectional-not-directional)).
  A peer may attempt to send events back that the originating pack's
  bridge declaration does not list as admissible-from-peer — for
  example, the peer attempts to inject an `<pack>.carve` event over
  a bridge originally opened for an `intake-request`, expecting it
  to ride the established channel. Admission must check
  direction-typed admissible-events lists; events arriving from a
  peer are matched only against the local side's
  "events I admit from peer" list, never against the verbs the
  local side calls outward. The two directions are independent
  contracts.
- **F12. Clarification loop amplification.** A peer floods the
  bridge with `<pack>.request-clarification` events to amplify load
  on the local side, or drives infinite clarification ping-pong by
  always responding with another question. Pack-declared
  `max-clarification-rounds` cap must be enforced by admission;
  on exceeded, the workflow transitions to a `NeedsHumanTriage`
  state surfaced on the control tower and the auto-clarify path
  is closed for that conversation. Per-peer rate limits apply to
  clarification requests independently of bridge-setup limits.
- **F13. Cross-team verb authority confusion.** A peer calls an
  internal verb (e.g., `<pack>.carve`, gated to local techlead)
  hoping the cross-team channel grants it elevated authority. The
  paired-verb pattern requires that internal verbs and cross-team
  intake verbs are distinct entries in the manifest with distinct
  capabilities; bridge admission must refuse to admit any event
  whose verb is not declared `cross-team = true` in the local
  manifest, even if the peer has a bridge open.

### Control tower integrity

The dashboard is the human's authority surface — humans take
actions through it and trust it as the truthful display of
conversation state. Its integrity is a class of threats distinct
from authority/schema/replay. See
[`architecture.md` § UI and BFF](architecture.md#ui-and-bff) for
the control-tower requirements.

- **C1. Spoofed action button.** A pack-contributed slot renders
  content designed to mimic a host action (e.g., a button that
  looks like "Approve design" but actually invokes a different
  verb). Host shell must own the canonical action surface (approve,
  sign-off, ship, etc.); pack-contributed widgets cannot render
  host-shaped action buttons, only their declared widget types
  (table, timeline, form, etc.) from the slot DSL vocabulary in
  [`pack-distribution.md`](pack-distribution.md). Action buttons
  rendered by the host always display the workflow + verb they
  will invoke as visible provenance.
- **C2. Dashboard staleness during stall.** A conversation has
  stalled but the dashboard caches an old state and appears
  active. With no SLAs (per
  [`federation.md` § Stall visibility](federation.md#stall-visibility-no-slas)),
  humans rely on the dashboard to *see* stalls — staleness defeats
  detection. Dashboard must show "last activity" timestamps
  prominently on every conversation and assignment row, derived
  from engine state (not cached), and must refresh on engine-state
  change without requiring agent connectivity.
- **C3. Pending-on-you queue starvation.** A noisy pack floods the
  human's pending queue with low-importance assignments, drowning
  out high-stakes ones (approve-design, signoff-release, accept-
  intake). Pack-declared importance hints are advisory; the host
  shell controls grouping, ordering, and surfacing. High-stakes
  human-typed-role assignments (the ones in the pack's human
  touchpoint inventory) get host-defined prominence regardless of
  pack-supplied hints.
- **C4. UI authority drift.** UI-originated events bypass the
  daemon's admission path (e.g., a renderer bug causes direct
  state mutation). UI must always go through the native API; the
  authority chain treats UI-originated events identically to
  CLI- and agent-originated events. Any UI render path that
  modifies engine state without an admission round-trip is a
  runtime bug, not a feature.

## Open questions

Each item below is a question the pack contract or federation design
must answer before the corresponding threats can be made precise.

- **Actor binding.** How does the runtime map a transport-supplied
  principal to a pack-declared role at conversation join? (Blocks
  A1, S2.)
- **Evidence format.** Is an evidence pointer a (conversation-id,
  event-id) pair, a content hash, or both? (Blocks A2, A4.)
- **Effect API surface.** Which effects must go through the recorded
  channel — only network, or also time, randomness, storage, message
  send? (Blocks R1, R2, R3, B3.)
- **Compaction model.** Does Quoru support log compaction at all in
  v1, and if so what is the checkpoint format? (Blocks R4.)
- **Pack and event versioning.** Are pack versions and event-schema
  versions independent, or coupled? (Blocks R5, R6.)
- **Budget aggregation scope.** Do budgets aggregate to the root
  conversation, to an operator-defined scope, or both? (Blocks B1,
  B2, B6.)
- **Internal-event declaration.** Are runtime-originated events
  (errors, timeouts, cancellations) part of the pack manifest or a
  fixed runtime vocabulary? (Blocks S6.)
- **Cached peer-event audit.** Should each side cache signed copies
  of referenced peer events to allow audit without live peer
  cooperation? Cost/value tradeoff unclear pre-deployment. (Blocks
  F10.)
- **Foreign-causation marking.** What exactly does the authority
  chain record when a bridge invitation is caused by a foreign
  participant's actions? (Blocks F8.)
- **Gate-clearance authority.** Which roles can clear a
  `<pack>.ship` gate? Working assumption: only an event whose
  origin reference matches the gate's declared external dependency
  (closing it normally), or a local-techlead-issued `gate-override`
  (closing it explicitly with audit trail). (Blocks A6.)
- **Max-clarification-rounds ceiling.** Pack declares its own cap,
  but should there be a runtime ceiling above which the daemon
  refuses regardless of pack value? Likely yes (prevents a hostile
  pack from declaring 10^6 rounds). Value TBD. (Blocks F12.)
- **Slot action provenance display.** What's the canonical visible
  provenance for a host-rendered action button (just the verb name,
  or verb + pack + workflow)? (Blocks C1.)

## Recommended resolutions

These are the working proposals for each open question, pending
ratification by [`architecture.md`](architecture.md). They are
recorded here because the threat enumeration above assumes them; if
the pack contract diverges, the affected threats need to be
re-checked.

- **Actor binding → explicit join event.** Runtime records
  `(principal, role, conversation-id)` as a join event in the log
  when a participant joins; the binding is immutable for the
  conversation lifetime. Application-supplied join policy decides
  the mapping, but the binding itself lives in the log so replay
  reconstructs role membership without consulting external state.
- **Evidence format → pointer and content hash.** An evidence
  reference is `(conversation-id, event-id, content-hash)`. The
  pointer enables traversal; the hash enables integrity verification
  independent of the log store. A3 and A4 need different properties
  of the same reference, so covering both is the minimum honest
  answer.
- **Effect API surface → broad and mandatory.** Time, randomness,
  storage, network, and message-send all go through recorded
  effects. No escape hatches for "cheap" effects like wall-clock —
  any escape hatch becomes a replay correctness bug eventually.
- **Compaction → defer to v2.** v1 ships append-only with no
  compaction. The checkpoint contract has to be designed against
  real replay traces, which only exist after v1 is deployed.
  Premature compaction silently breaks replay.
- **Pack and event versioning → coupled.** A pack version pins its
  event schemas; an event-schema change requires a pack-version
  bump. Conversations pin to the pack version they started under
  (already required by R6). One version axis per conversation
  instead of a combinatorial matrix.
- **Budget aggregation → root by default, operator-declared
  additional scopes, per-actor sub-accounting inside each.** Root
  aggregation is the only scope the runtime can enforce on its own
  (parent-id chain is already in the log). Operator scopes (per
  user, per tenant) need configuration. Per-actor sub-accounting
  within each scope is what defeats B6.
- **Internal events → fixed runtime vocabulary, declared, not
  extensible.** Runtime ships a closed set (`Timeout`, `Cancel`,
  `Error`, `BudgetExhausted`, `JoinComplete`, `BridgeRequested`,
  `BridgeAccepted`, `BridgeRejected`, `BridgeEvent`, ...). Packs
  may write transitions that handle these events but may not
  redefine or extend the set. Open extension would let pack
  authors shadow runtime behavior.
- **Cached peer-event audit → deferred to v2.** v1 audit requires
  live peer cooperation. Document the limitation; revisit once
  real audit workflows exist and the storage cost of cached
  peer events can be sized. Mitigation in v1: peers that go
  offline permanently are a known audit-availability hazard.
- **Foreign-causation marking → authority-chain field.** The
  authority chain entry for any event admitted because of a
  bridge transition carries a `caused-by-bridge = <bridge-id>`
  marker. Downstream policy (including receiving peers) can choose
  to refuse actions whose chain shows foreign causation. Cheap to
  record; expensive enforcement is operator policy, not runtime.
