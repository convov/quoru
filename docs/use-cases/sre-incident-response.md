# Use Case: SRE Incident Response

Status: draft. Written to stress-test the current architecture
([`../architecture.md`](../architecture.md),
[`../pack-contract.md`](../pack-contract.md),
[`../federation.md`](../federation.md),
[`../threat-model.md`](../threat-model.md)) against a concrete
incident scenario. The purpose is to surface requirements that the
runtime-only design doesn't yet address.

This is *not* a pack specification — the eventual **`sre` team
pack** (per [`../scope.md`](../scope.md)'s reference-packs list)
lives elsewhere, in the convov reference-packs repo. This doc
captures what the runtime must provide for that pack to be
possible, and reads in the team-as-pack model established in
[`../packs/eng.md`](../packs/eng.md) (one pack = one team with
multiple roles + typed verbs + human touchpoints).

## Scenario

3:47 AM. PagerDuty fires for Acme:

> `payments-api` p99 latency 8x baseline, error rate climbing.

Over the next ~40 minutes:

1. The alert starts a new incident conversation.
2. Acme's on-call SRE (human, mediated by a Claude agent) joins.
3. Three investigation threads run in parallel: metrics review,
   recent-deploy review, upstream dependency check.
4. The deploy thread finds a candidate cause: a 30-minute-old
   release. The agent proposes a rollback.
5. Rollback is high-stakes; a second human (incident commander)
   must approve before the rollback worker executes.
6. The upstream-dependency thread finds the failure mode is
   actually in Bigco's Payments API. Acme's pack bridges to
   Bigco's SRE quoru per Journey 3.
7. Bigco confirms a partial outage on their side; estimated recovery
   8 minutes. Acme pauses the rollback (the deploy turned out to be
   coincidental).
8. The status-page comms thread issues two updates (initial, then
   "investigating an upstream dependency, partial recovery
   expected").
9. Bigco recovers. Acme's metrics normalize. The conversation
   transitions to resolved.
10. A `postmortem` sub-conversation spawns automatically from the
    resolved state, picks up the incident's audit log, and starts
    the postmortem workflow.

By the end, the durable log contains: the alert that started it,
every diagnostic action and its result, the proposed rollback +
approval flow + cancellation, every bridge event with Bigco, every
status-page update, and the spawn of the postmortem.

## What the current design handles cleanly

These map 1:1 to existing design decisions; calling them out as
the baseline so the gaps are easier to see.

- **Durable conversation container.** The incident survives the SRE
  walking away and coming back, the daemon restarting, or any worker
  crashing. Per [`../architecture.md`](../architecture.md).
- **Multi-agent participation.** Responder, investigator(s),
  incident commander, status-comms agent — all distinct principals
  in one conversation. Per the assignment model.
- **Federation bridge to Bigco.** Per
  [`../federation.md`](../federation.md) and Journey 3 in
  [`../user-journeys.md`](../user-journeys.md).
- **Parallel sub-investigations with budget aggregation.** Per the
  threat-model **Budget aggregation** resolution; sub-conversations
  for parallel threads, root-aggregated.
- **Audit chain as postmortem source.** Per threat-model authority
  chain (A1–A5).
- **Replay survives daemon restart mid-incident.** Per threat-model
  replay correctness (R1–R6).

## Requirements surfaced

Each requirement below is grounded in a specific moment of the
scenario. Following the requirement: the gap it exposes, where it
lands, and a **Fuse status** line that records whether the embedded
Fuse engine already provides the primitive. Items where Fuse
already covers the mechanism are the cheapest to address (Quoru
just exposes / packages); items Fuse does not cover are the actual
new Quoru runtime work.

### R1. External triggers (webhooks in)

**Scenario moment:** Step 1 — the conversation is started *by an
alert*, not by `quoru conversation start`. No human is awake yet.

**Gap:** Nothing in the current design accepts inbound webhook
events from PagerDuty / Datadog / Slack. Without this, every
operational pack requires either a human to start each conversation
or a custom external script that calls the native API. The webhooks
*outbound* feature in [`../scope.md`](../scope.md) is the symmetric
twin and was already in scope; the inbound side was missed.

**Lands in:** [`../architecture.md`](../architecture.md) (new
"external triggers" section — daemon accepts inbound webhooks,
maps payloads to entry-workflow start with declared schema
validation); [`../scope.md`](../scope.md) (promote inbound webhooks
to in-scope v1).

**Fuse status:** *Partial.* Fuse already exposes REST + gRPC
endpoints and auto-generates REST surfaces for entities. The
inbound HTTP itself is solved. The Quoru-level work is the pack
convention: declaring an entry workflow as webhook-triggerable and
mapping payload → initial event with schema validation.

### R2. Worker secrets / credentials management

**Scenario moment:** Step 3 — the investigation worker calls
Datadog's API. It needs a Datadog API key. The rollback worker
needs kubectl context credentials. The Slack comms worker needs a
bot token.

**Gap:** Pack-contract has nothing about secrets. Today a pack
author would have to either bake credentials into the worker
binary (bad) or expect them in the worker process environment
(unspecified). For operational packs this is a hard blocker.

**Lands in:** [`../pack-contract.md`](../pack-contract.md)
(document the convention: secrets declared via Fuse `resource`
bindings; daemon configures bindings per environment);
[`../architecture.md`](../architecture.md) (secret-backend
interface alongside the storage interface);
[`../threat-model.md`](../threat-model.md) (secret exposure threats
— log redaction, replay handling, audit-export filtering).

**Fuse status:** *Solved.* Fuse's `resource` verb is exactly this
— a long-lived typed capability the workflow holds, with bindings
that map to concrete substrates (env, OS keychain, Vault, AWS
Secrets Manager, KMS) per environment. Cloud-api also ships
app-layer at-rest encryption for system secrets. No new runtime
primitive needed; Quoru just documents the convention.

### R3. First-class human participation

**Scenario moment:** Steps 2, 5, 6 — humans are in the loop
throughout. The on-call SRE, the incident commander, comms team.
None of these speak MCP directly.

**Resolution (since this doc's first draft):** Humans are
first-class participants typed as **human-typed roles in the pack
manifest**, alongside agent roles (see
[`../packs/eng.md`](../packs/eng.md) for the eng pack instance,
which declares `decider`, `approver`, `qa-owner` as human roles).
For the sre pack, expect roles like `incident-commander`,
`comms-officer`, `on-call-sre` to be human-typed (or
optionally-human, when an agent escalates to a human at high-stakes
moments).

Humans participate via the **dashboard control tower** (see
[`../architecture.md` § UI and BFF](../architecture.md#ui-and-bff)):
the UI shows pending-on-human assignments, the human clicks
through to act, and the daemon records the action as a typed verb
invocation. The web UI is no longer rejected; it is the primary
human surface.

What remains open: whether the **Slack/Teams adapter** for
notifications-out-of-band is v1 or v2. The dashboard satisfies
synchronous human participation; Slack/Teams covers the
asynchronous-notification case ("page someone whose dashboard isn't
open at 3am"). Likely v1 for SRE specifically (paging is
load-bearing for incident response in a way it isn't for eng).

**Lands in:** [`../architecture.md`](../architecture.md) (resolved
via control tower + human-typed roles); [`../scope.md`](../scope.md)
(Slack/Teams notifications-out-of-band: v1 decision still pending).

**Fuse status:** *Not addressed by Fuse, addressed by Quoru.* Fuse
doesn't model humans as workflow primitives. Quoru's extension is
the human-typed role + control tower combination, now specified.

### R4. Two-actor approval pattern

**Scenario moment:** Step 5 — agent proposes rollback, *different*
human must approve before the rollback worker executes. Separation
of duties.

**Resolution:** The team-as-pack model addresses this naturally.
The `sre` pack declares distinct roles (e.g., `mitigation-agent`
proposes a rollback via `sre.propose-mitigation`; `incident-
commander` human role approves via `sre.approve-mitigation`).
Different roles ≠ different principals automatically, so the pack
manifest plus a Fuse `require` guard
(`require event.approver != event.proposer`) gives separation of
duties enforced at admission.

This pattern is one entry in the sre pack's human touchpoint
inventory (the canonical pattern is in
[`../packs/eng.md` § Human touchpoint inventory](../packs/eng.md#human-touchpoint-inventory)).
For sre, expect at minimum: incident-commander approves
mitigation actions, qa-owner-equivalent (or postmortem-owner)
signs off resolved-state.

**Lands in:** [`../pack-contract.md`](../pack-contract.md) (the
human-typed role + `require` guard combination is the canonical
proposer-approver pattern; document as a reference recipe);
[`../threat-model.md`](../threat-model.md) (resolves a sub-threat
under S3 / authority chain — separation of duties enforced at
admission, not by application code).

**Fuse status:** *Solved by primitives.* ACP gives cryptographic
agent identity (Ed25519 signatures); Fuse's `require` guards
enforce admission conditions. The pattern itself
(proposer-approver convention) is now expressible directly in the
pack manifest via the human-typed-role mechanism.

### R5. Effect idempotency annotations

**Scenario moment:** Step 5 again — if the rollback worker calls
`kubectl rollout undo` and the daemon crashes after the call but
before recording success, replay would re-run the rollback. Some
effects can't be safely re-tried (paging another team, sending
customer comms, charging a card, executing a one-shot rollback that
the next pod-state makes nonsensical).

**Gap:** Currently the worker is responsible for idempotency. Some
effects are *fundamentally* non-idempotent. Workers need to declare
"this effect must not auto-retry; surface for confirmation on
replay."

**Lands in:** [`../pack-contract.md`](../pack-contract.md) (reference
Fuse's side-effect contract for the declaration; Quoru documents the
convention for incident-response packs);
[`../threat-model.md`](../threat-model.md) (replay-correctness
sub-threat: silent re-execution of non-idempotent effects).

**Fuse status:** *Solved.* Whitepaper 08 (side-effects-as-typed-
contracts) defines every effect as a typed contract; workers
recommend idempotency keys; the typed effect channel records inputs
and outputs so replay re-feeds rather than re-executes. Quoru
inherits this. No new runtime work.

### R6. Sensitive-field declaration

**Scenario moment:** Throughout — log lines contain customer email
addresses and request payloads. Stack traces leak service-internal
paths. The conversation log persists indefinitely; audit export
flows to Kafka; the bridge to Bigco crosses a trust boundary.

**Gap:** No way to declare event fields as sensitive. PII /
credentials / payloads end up in the durable log, in audit exports,
and across federation bridges with no filtering.

**Lands in:** [`../pack-contract.md`](../pack-contract.md)
(event-schema annotations: `sensitivity = "pii" | "secret" |
"public"`); [`../threat-model.md`](../threat-model.md) (new
section: sensitive-data handling — encryption at rest for tagged
fields, redaction in audit export, exclusion from bridge events
unless explicitly allowed); [`../federation.md`](../federation.md)
(bridge filtering: by default, sensitive fields are stripped from
`BridgeEvent`; bridge declaration can opt specific fields in).

**Fuse status:** *Genuine gap.* Fuse has typed `data { }` payloads
but does not currently expose per-field sensitivity tags. App-layer
encryption exists at cloud level for system secrets, not for
workflow event fields. This is either a Quoru extension on top of
Fuse data blocks or a feature request upstream to Fuse. Already
listed as an open question in [`../pack-contract.md`](../pack-contract.md).

### R7. Timer transitions

**Scenario moment:** Implicit throughout. "If the investigator
hasn't made progress in 5 minutes, escalate" is standard incident
response. SLA timers are first-class.

**Gap:** The pack contract has nothing about timer-driven
transitions. Fuse almost certainly supports them; the contract
needs to surface them so the daemon can validate and audit them.

**Lands in:** nothing new — already covered by Fuse and by
threat-model R3.

**Fuse status:** *Solved as-is.* Fuse's
`after <duration> fire <Event>` is GA and state-bound (auto-disarms
on exit). Quoru inherits it directly; pack authors use the Fuse
DSL. Threat-model R3 (clock drift) already covers replay
correctness via the logical-clock requirement.

### R8. Cross-conversation context queries

**Scenario moment:** Investigator agent: "have we seen this error
pattern before?" — wants to read prior incident conversations.

**Gap:** No documented API to query across conversations. Reading
the log of *this* conversation is implicit; reading another's is
unspecified.

**Lands in:** [`../architecture.md`](../architecture.md) (a
read-only conversation-search API with explicit permission model:
which principals can query which conversations, with what
projection). Defer to v2 explicitly rather than discover later.

**Fuse status:** *Solved.* Fuse SDKs already expose run/entity
queries; subscriptions provide cross-machine signals. The
Quoru-level work is the permission model (which principal can
read which conversation's log), not the query mechanism itself.

### R9. Worker failure as event

**Scenario moment:** Step 3 — the metrics worker calls Datadog and
Datadog itself is the dependency that's broken. The worker call
times out or fails.

**Gap:** The workflow needs to react to worker failures, not be
silently stuck. Worker errors must be runtime-emitted events the
workflow can transition on (e.g., a `MetricsUnavailable` fallback
path that uses a secondary source).

**Lands in:** nothing new — already covered by Fuse.

**Fuse status:** *Solved as-is.* Fuse `worker { timeout, retry }`
surfaces failures; saga compensation walks back over completed
effects on workflow failure. Pack authors handle these in the
`.fuse` file directly. No new Quoru runtime primitive needed.

### R10. Role handoff

**Scenario moment:** Implicit — incident commander role transfers
when the next on-call wakes up.

**Gap:** Assignment model handles *initial* role assignment;
explicit handoff between principals (with audit trail showing the
transfer and the reason) is unmodeled.

**Lands in:** [`../architecture.md`](../architecture.md) (assignment
model extension: explicit `RoleHandoff` event with from-principal,
to-principal, reason; new join event for the new principal under
the same role; the prior principal's binding is revoked).

**Fuse status:** *Partial.* ACP gives the signed-identity primitive
(transfer can be a signed verb the prior holder issues). The
role-binding-transfer semantics — revoking the prior binding,
creating the new one, recording the chain — are Quoru's assignment
model, which sits above Fuse. With the team-as-pack reframe, the
handoff is more naturally expressed: roles are first-class in the
manifest, and a `RoleHandoff` event becomes a typed verb the
outgoing principal calls (`sre.handoff-role`) that the dashboard
control tower surfaces to the incoming principal as a claimable
assignment.

### R11. Spawn sub-conversations from terminal state

**Scenario moment:** Step 10 — the postmortem sub-conversation
spawns automatically when the incident resolves, picking up the
audit log as input.

**Gap:** Workflows can spawn sub-conversations mid-flight (the
federation bridge is the only documented spawn pattern; there's a
hint about it in budget aggregation but no general spec). The
specific case of "spawn pack Y when this pack reaches terminal
state X, passing the audit log as input" needs to be addressed.

**Lands in:** nothing new — already covered by Fuse.

**Fuse status:** *Solved as-is.* Fuse `spawn` is GA: a transition
spawns child machine runs, parent fans out and collects. The
postmortem-on-terminal pattern is just `spawn` from a terminal
transition. The `[[workflows.spawns]]` manifest extension I
considered is unnecessary — Fuse already expresses this in the
DSL.

## Lower-priority gaps

Real, but pack-author concerns or v2 candidates rather than runtime
blockers:

- **Conversation status independent of workflow state.**
  (open/mitigating/resolved as an entity rather than a state). Pack
  design pattern; entities already support this if entity contract
  surfaces them.
- **On-call rotation as external state.** "Who's on call right now"
  is PagerDuty's truth, not Quoru's. Assignment-model needs a
  dynamic-lookup hook; could plausibly be expressed as a worker
  that resolves on demand.
- **Time-sensitive latency / event-level back-pressure.** Real
  concern, but mostly a pack-design problem (pick faster models,
  parallelize agent calls) rather than a runtime requirement.
- **Postmortem as a separate pack.** Composes via R11
  (sub-conversation spawn); not its own runtime requirement.

## Cross-cutting themes

Looking at the 11 requirements together, four themes emerge that
the design should address coherently rather than piecemeal. Mapped
against the Fuse status annotations above:

1. **External integration surface.** R1 (webhooks in), R8
   (cross-conv queries), R2 (secrets). Fuse covers most of the
   *mechanism* (REST/gRPC, SDK queries, `resource` bindings); the
   Quoru-level work is convention and packaging.
2. **Human participation.** R3 (humans as participants), R4
   (two-actor approval), R10 (role handoff). Resolved by Quoru's
   team-as-pack model: human-typed roles in the manifest +
   dashboard control tower + ACP-signed handoff verbs. Open
   sub-question: Slack/Teams notifications-out-of-band for paging
   (likely v1 for sre, v2 for eng).
3. **Effect safety.** R5 (idempotency), R6 (sensitive fields), R9
   (worker failure as event). Fuse's typed-side-effects model
   solves R5 and R9 outright; R6 (field-level sensitivity) is the
   one genuine extension request — either implemented in Quoru on
   top of Fuse data blocks, or pushed upstream to Fuse.
4. **Pack composition.** R7 (timer transitions), R11 (sub-conversation
   spawn), R8 (cross-conversation queries). All three are already
   Fuse primitives (`after ... fire`, `spawn`, SDK queries). The
   pack-contract should reference them by name rather than
   reinvent.

The headline (updated since this doc's first draft): **of 11
requirements, R6 (field-level sensitivity tags) is the only one
needing a Fuse extension; the other 10 are now either solved by
Fuse primitives or expressible on top of Quoru's team-as-pack,
human-typed-roles, and control-tower extensions.** Most of what
looked like Quoru work was Fuse work, already done; the rest was
absorbed into the team-as-pack reframe.

## Next moves

This doc supplies the *requirements*. Acting on them is a separate
step. Reordered by Fuse status — cheapest first:

**Already done by Fuse — Quoru just exposes:**
- R7 (timers), R11 (spawn), R9 (worker failure), R5 (idempotency
  via typed effects), R2 (resource bindings for secrets), R8 (SDK
  queries).

**Resolved by Quoru's team-as-pack reframe (this doc's session):**
- R3 (human-typed roles + control tower), R4 (proposer-approver
  via distinct human roles + `require` guard), R10 (role handoff
  as typed verb surfaced on dashboard).

**Pack-contract / convention work on top of Fuse primitives:**
- R1 (webhook entry convention — should be wired into the typed-
  intent surface from
  [`../pack-contract.md`](../pack-contract.md), so an inbound
  webhook resolves to a typed intent invocation, not an untyped
  event).

**Genuine Quoru-only design needed:**
- Slack/Teams notifications-out-of-band for paging (sub-question
  from R3): v1 for sre because paging is load-bearing; deferable
  for eng. Not a blocker for the sre pack to start.

**Fuse extension or Quoru wrapper:**
- R6 (field-level sensitivity tags on data blocks).

The previous "R1/R3/R2 are v1 blockers" framing is now stale —
R3 is largely resolved by team-as-pack + control tower, R2 is
existing Fuse, R1 is convention work atop the typed-intent
surface. The only genuine v1 design questions left are R6 (Fuse
extension) and the Slack/Teams paging sub-question.

## Related

- Future use-case docs in this directory (one per highest-fit pack
  in [`../scope.md`](../scope.md)) should follow the same shape:
  concrete scenario → what works → surfaced requirements → where
  each lands.
- Confirming requirements as cross-cutting requires running the
  same exercise on a second pack (compliance approval is the
  natural pairing). Requirements that surface in both are real
  runtime requirements; requirements that surface in only one are
  SRE-shaped.
