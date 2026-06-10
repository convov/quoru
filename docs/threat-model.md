# Quoru Threat Model

Status: draft.

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

## Open questions

Each item below is a question the pack contract must answer before
the corresponding threats can be made precise.

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
  `Error`, `BudgetExhausted`, `JoinComplete`, ...). Packs may
  write transitions that handle these events but may not redefine
  or extend the set. Open extension would let pack authors shadow
  runtime behavior.
