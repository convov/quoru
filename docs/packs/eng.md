# `eng` — Engineering Team Pack

Status: draft. Reference pack implementing the software-development team
as a Quoru pack. First pack shipped against the contract in
[`../pack-contract.md`](../pack-contract.md). Other team-shapes (SRE,
compliance, ops) will follow as siblings under `docs/packs/`.

## One-line summary

`eng` is the pack that turns a software-development team into a Quoru
conversation: nine roles (six agent, three human-typed), a verb surface
covering the full vision → research → design → carve → code → ship
lifecycle, and typed cross-team intake so other team packs can request
research, design, work, or deliverables without freeform chat.

## Why one team = one pack

We considered shipping each persona (techlead, dev, qa, etc.) as a
separate pack. The team-as-pack reframe (see [`../scope.md`](../scope.md))
beat per-persona on every dimension:

- **One conversation per feature**, not nine chained. A feature like
  "ship MS-13h" lives in one durable, replayable, auditable
  conversation that moves from research → design → carve → code →
  qa → ship → operate, with different roles acting at different
  states. Under per-persona packs that'd be nine conversations
  with brittle handoffs.
- **Roles are the team composition.** The manifest's `[roles]`
  section literally is the team. Adding a role to the team is a
  manifest edit, not a new pack.
- **Federation = team-to-team bridging.** "Eng team bridges to
  compliance team for security review" reads naturally. "Techlead
  pack bridges to auditor pack" did not.

## Team composition (roles)

| Role | Kind | Description |
|------|------|-------------|
| `researcher` | agent | Investigates topics, gathers prior art, synthesizes findings with citations |
| `strategist` | agent | Frames decisions, weighs options, drafts strategy proposals |
| `architect` | agent | Produces designs, RFCs, and architectural decision records |
| `techlead` | agent | Owns the roadmap; carves milestones; triages intake from other teams |
| `dev` | agent | Drives code changes (proposes, reviews, merges, deploys) |
| `qa` | agent | Plans test suites, executes runs, reports defects, verifies fixes |
| `auditor` | agent | Reviews artifacts against policy; produces attestations |
| `decider` | **human** | Commits strategic calls the agent strategist drafted |
| `approver` | **human** | Approves designs the architect drafted |
| `qa-owner` | **human** | Signs off release readiness |

Three human-typed roles are the minimum-viable HITL surface for the
team. More may be added per pack instance (e.g., a `compliance-officer`
human role when the team operates under regulatory constraints, a
`cutover-approver` human role when migrations are involved).

Two roles defined in scope but **not standalone in this pack**:

- **`packwright`** is a meta-pack (helping users build packs); it
  doesn't appear in feature-shipping conversations.
- **`redteam`** is a sub-conversation primitive that other packs
  invoke (e.g., `dev` spawns a redteam sub-conversation before
  `merge` on a high-risk PR), not a standalone role here.

## Producer / consumer graph

Each role is typed by what it consumes and what it produces. The
graph is the team's coordination protocol:

| Role | Consumes | Produces |
|------|----------|----------|
| `researcher` | vision/topic, prior research | market analysis, prior art, citations |
| `strategist` | vision + research | strategy decisions, priorities, positioning |
| `architect` | requirements (from `decider` or external intake) | designs, RFCs, decision records |
| `techlead` | requirements + designs + intake | roadmap, milestone carves, ship gates |
| `dev` | designs + milestone claims | code changes, deploys, rollbacks |
| `qa` | requirements + designs (not code) | test plans, test runs, defect reports, signoff |
| `auditor` | policy + artifact under review | attestations, approvals, denials |

This graph is the federation contract too: when one `eng` pack
sends events to another over a bridge, the receiving role is
determined by the consume column.

## Verb surface

### Internal verbs (intra-team)

Internal verbs are gated to the role that owns them. Calls flow
within one team's conversation.

| Verb | Caller role | Effect |
|------|------------|--------|
| `eng.commission` | `techlead` | Assign a research topic to `researcher` |
| `eng.synthesize` | `researcher` | Produce a research artifact |
| `eng.frame` | `strategist` | Frame a strategic decision (draft) |
| `eng.decide` | `decider` (human) | Commit a strategic call |
| `eng.draft` | `architect` | Produce a design draft |
| `eng.approve-design` | `approver` (human) | Approve a design for implementation |
| `eng.carve` | `techlead` | Carve a milestone into the roadmap |
| `eng.claim` | `dev` / `qa` / etc. | Claim an assigned milestone |
| `eng.propose` | `dev` | Open a code change |
| `eng.review` | `dev` | Review a peer's change |
| `eng.merge` | `dev` | Merge an approved change |
| `eng.deploy` | `dev` | Deploy a merged change |
| `eng.plan-tests` | `qa` | Author a test plan |
| `eng.execute-tests` | `qa` | Execute a test run |
| `eng.report-defect` | `qa` | Report a defect |
| `eng.signoff` | `qa-owner` (human) | Sign off release readiness |
| `eng.ship` | `techlead` | Mark a milestone shipped (optionally with `gate-on`) |
| `eng.drain` | `techlead` | Retire a stale or abandoned milestone |
| `eng.attest` | `auditor` | Record an attestation |

### Cross-team intake verbs (peer-callable)

Each is `cross-team = true` with `receiver-role = "techlead"` (see
[`../pack-contract.md` § Cross-team intents](../pack-contract.md#cross-team-intents)).
The receiver is always the techlead; routing to the role that
actually does the work happens intra-team after triage.

| Verb | Semantic | Eventually handled by |
|------|----------|----------------------|
| `eng.research-request` | "investigate X, return artifact" | `researcher` |
| `eng.design-request` | "we need a design for X" | `architect` |
| `eng.intake-request` | "consider doing this work for us" | `techlead` → assigned downstream |
| `eng.deliverable-request` | "produce X and hand it back" | `dev` / `qa` / etc. |
| `eng.audit-request` | "review this artifact against policy" | `auditor` |

### Clarification verb pair

Used during triage of any cross-team verb. Agent-to-agent only;
no human in the loop:

- `eng.request-clarification(question)` — receiver asks
- `eng.provide-clarification(answer)` — sender responds

## Human touchpoint inventory

Quoru's value depends on humans being load-bearing, not
omnipresent. The minimum for a cross-team feature flowing through
this pack:

| # | Touchpoint | Role | Why human-only |
|---|-----------|------|----------------|
| 1 | Cross-team intake commit (accept / reject) | `techlead` (human override) | Accepting external commitment affects roadmap; needs a name |
| 2 | Design approval | `approver` | Bad design = expensive; humans catch what agents miss |
| 3 | Release signoff | `qa-owner` | Customer-impacting; named accountability |

Things **explicitly not human touchpoints** (by design):

- Clarification rounds during triage (agent ↔ agent)
- Internal carve once intake is accepted (triage already happened)
- Propose / review / merge / deploy (agent-driven; signoff is the
  gate before customer impact)
- Status updates across bridges (no decision; propagation only)

Touchpoints added for higher-stakes variants:

- **Prod cutover** if the change requires a migration (4th touchpoint)
- **Compliance attestation** if the change touches regulated data
  or auth surfaces (5th touchpoint)
- **Strategic commit** if the work is strategy-level, not just
  roadmap (6th touchpoint, at the front)

## Worked example 1 — Aequa needs work from Fuse

The story: Aequa's team identifies a dependency on Fuse code,
needs research on what Fuse provides, then needs Fuse to build
something new.

**Step 1 — Aequa-side research.** Aequa's `researcher` identifies
a knowledge gap. They cannot read Fuse's code directly — instead
they call `eng.research-request(question, scope, deadline)` across
the bridge to Fuse. Aequa-side conversation enters
`AwaitingExternalResearch`.

**Step 2 — Fuse-side research triage.** Bridge fires. Fuse
`techlead` is assigned the research-request. Triage: clarification
loop if needed (agent ↔ agent), then accept/reject. On accept,
techlead calls `eng.commission` internally to assign Fuse's
`researcher`. Fuse `researcher` calls `eng.synthesize`, emits the
artifact across the bridge.

**Step 3 — Aequa-side design.** Aequa receives the research
artifact. Aequa's `architect` calls `eng.draft` to produce a
design citing the Fuse dependency. Aequa's `approver` (human)
approves the design.

**Step 4 — Aequa-side roadmap carve.** Aequa `techlead` calls
`eng.carve` for an Aequa milestone that's blocked on Fuse work.
That Aequa milestone enters state `AwaitingExternal`.

**Step 5 — Cross-team intake to Fuse.** Aequa-side
`AwaitingExternal` is a declared bridge state. Bridge emits
`BridgeRequested` wrapping an `eng.intake-request` invocation.
Fuse `techlead` receives the intake assignment.

**Step 6 — Fuse-side triage.** Fuse `techlead` (human) triages.
Four outcomes:
- **Reject** → `eng.reject-intake` flows back; Aequa pivots
- **Need more info** → clarification loop fires
- **Accept + direct carve** → `eng.carve` on Fuse side
- **Accept + needs design first** → `eng.carve` with design-pending state

**Step 7 — Fuse-side design (if needed).** Fuse `architect` calls
`eng.draft`, then Fuse `approver` (human) approves the design.

**Step 8 — Fuse-side implementation.** Fuse `dev` claims the
milestone. Runs `eng.propose` → `eng.review` → `eng.merge` →
`eng.deploy`. Fuse `qa-owner` (human) calls `eng.signoff`. Fuse
`techlead` calls `eng.ship`.

**Step 9 — Aequa unblocks.** `MilestoneShipped` flows across the
bridge. Aequa-side `AwaitingExternal` transitions to
`ExternalDone`. Aequa team proceeds.

End-to-end: **3 human touchpoints** (Fuse techlead intake commit,
Fuse approver design approval, Fuse qa-owner release signoff).
Two durable conversations (one per team), each with a complete
audit chain linked through the bridge.

## Worked example 2 — Fuse gates a follow-on on an Aequa deliverable

Inverse of example 1: Fuse just shipped milestone M740 and
declared the follow-on (`M740-impl`) gated on Aequa naming a
concrete `.fuse` consumer.

**Step 1 — Fuse-side ship with gate.** Fuse `techlead` calls
`eng.ship(milestone="M740", gate-on={kind="external-deliverable",
from="aequa", description="naming a consumer .fuse"})`. The
workflow enters `GatedPostShip` — the next `eng.carve` for
`M740-impl` is blocked until the gate clears.

**Step 2 — Cross-team deliverable request.** The
`GatedPostShip` state is bridge-eligible. Bridge emits
`BridgeRequested` wrapping an `eng.deliverable-request(spec,
what-we-need, why)` invocation toward Aequa. Aequa `techlead`
receives.

**Step 3 — Aequa-side triage.** Same triage pattern as example 1.
On accept, Aequa `techlead` calls `eng.carve` for an Aequa
milestone: "Deliver consumer .fuse to Fuse, gated on M740-impl
carve."

**Step 4 — Aequa-side implementation.** Aequa `dev` claims, runs
`eng.propose` through `eng.deploy`. Skipping design approval here
because the deliverable is a small artifact, not a new feature.

**Step 5 — Deliverable returns.** Aequa `techlead` calls
`eng.deliverable-completed(artifact-ref, location)` across the
bridge. Fuse-side `GatedPostShip` gate-clears.

**Step 6 — Fuse proceeds.** Fuse `techlead` calls `eng.carve` for
`M740-impl`, citing the Aequa consumer as validation target.
Normal Fuse-side cycle from here.

End-to-end: **2 human touchpoints** (Aequa techlead intake
commit, no design approval because deliverable-only). One bridge,
events flowing both directions on it (intake request out,
clarifications back, deliverable-completed out).

## Bridge contract sketch

Per [`../federation.md`](../federation.md), each team's pack
declares its bridge admissible events per workflow state. For the
`eng` pack:

```toml
[[workflows.bridges]]
when-state = "AwaitingExternal"
emit = "BridgeRequested"
target-pack = "eng"                       # peer must run the eng pack
target-pack-version = "^1"
target-role = "techlead"                  # peer's techlead receives
local-synthetic-role = "external-peer"    # how peer participants appear locally
admissible-events = [
  "IntakeAccepted",
  "IntakeRejected",
  "ClarificationRequested",
  "ClarificationProvided",
  "MilestoneAdvanced",
  "MilestoneShipped",
  "DeliverableCompleted",
]
```

The symmetric declaration on the peer side admits the
mirror-direction events (the originating request, the responses,
status pulls, etc.).

## Open questions

- **Which `eng` roles ship in the v1 reference pack?** Working
  assumption: all nine. Smaller teams instantiate the pack but
  leave some roles unassigned — the workflow tolerates absent
  optional roles. Worth confirming the optional/required split.
- **Multiple-pack-instance-per-daemon.** A single org may run
  `eng` separately for multiple teams (`eng@platform`,
  `eng@growth`). The pack distribution model supports this; the
  cross-team bridge model needs to handle "intra-org but
  cross-team-instance" cleanly. Falls out of the multi-tenant
  pack-scoping open question in [`../pack-distribution.md`](../pack-distribution.md).
- **Where do product requirements come from?** Working assumption
  is "humans inject via the control tower; `pm` is not a separate
  role here." If a real `pm` role emerges with bespoke tooling or
  private knowledge (i.e., passes the second filter in
  [`../scope.md`](../scope.md)), add it.
- **Sub-conversation invocation surface.** `redteam` is meant to
  be invoked from `dev.review` or `architect.draft`. The pack
  contract doesn't yet specify how a workflow spawns a typed
  sub-conversation from another pack. Likely a Fuse `spawn`
  extension; design pass needed.
