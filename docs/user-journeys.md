# Quoru User Journeys

Status: draft. Written to stress-test the architecture and surface
contract gaps. See [`architecture.md`](architecture.md) for the
decisions these journeys assume and [`pack-contract.md`](pack-contract.md)
for the pack format.

Three journeys, in sequence:

1. **Solo dev** — a developer with 2–3 LLM-driven agents on a laptop,
   wanting them to coordinate through Quoru.
2. **Platform team** — an infra team deploying Quoru as shared
   infrastructure for many agent workloads.
3. **Cross-org federation** — an incident on one team's service
   pulls in another org's SRE agents through a bridged conversation.

Each journey assumes everything its predecessors established.

---

## Journey 1: Solo dev

### Setup

Devin maintains a side project. He has one Claude-driven coding
agent in his IDE. He wants Quoru to coordinate the work so every
feature ships through a durable, replayable, audited conversation —
without the ceremony of a real team.

The trick is that the [`eng` pack](packs/eng.md) is designed for a
real engineering team (nine roles), but a solo dev can instantiate
it with **one agent wearing several agent roles** (`architect`,
`dev`, `qa`) and **himself wearing several human roles**
(`techlead`, `approver`, `qa-owner`). Same pack, smaller cast.

### Step 1 — Install and start the daemon

```
brew install quoru
quoru install-service    # writes a launchd plist; daemon survives reboot
# → daemon running. UI: http://127.0.0.1:7180
```

The daemon runs in the background. State at `~/.quoru/`, control
socket at `~/.quoru/control.sock`, sqlite log at
`~/.quoru/quoru.db`, web UI on loopback. Devin opens the URL —
the UI is his **control tower** (see
[`architecture.md` § UI and BFF](architecture.md#ui-and-bff)) and
the surface most of this journey happens on.

### Step 2 — Install the `eng` pack (in the UI)

Devin opens the UI's **Packs** tab. There are no packs installed
(zero bundled, per [`pack-distribution.md`](pack-distribution.md)).

He adds the convov reference source via the built-in shortcut, then
installs the eng pack:

- **Sources** → "Add source" → picks the `convov` shortcut → confirms.
- **Browse packs** → `convov/eng` → "Install" → reviews the
  capability summary (declared network access, secrets, resources,
  worker source paths, declared intents) → confirms.

The daemon validates the manifest (per the install rules in
[`pack-contract.md`](pack-contract.md)), registers the workflows
and entities, and launches the pack's workers. The Packs tab now
shows `eng` as **Active**, with its intent tools — `eng.draft`,
`eng.carve`, `eng.propose`, `eng.signoff`, etc. — listed as
available MCP tools.

### Step 3 — Register the coding agent (in the UI)

The UI's **MCP** tab shows the local MCP server endpoint and offers
a generated config snippet per supported agent client (Claude
Desktop, etc.). Devin clicks **"Add principal"** once — for his
coding agent — and grants it three roles in the `eng` pack:
`architect`, `dev`, `qa`. (Granting multiple roles to one principal
is supported; the agent can act in any of them, the daemon
enforces which role a given verb requires.)

The UI emits a config snippet:

```jsonc
{
  "mcpServers": {
    "quoru": {
      "command": "quoru",
      "args": ["mcp"],
      "env": { "QUORU_PRINCIPAL": "coding-agent" }
    }
  }
}
```

He pastes it into Claude and starts the agent. The daemon sees the
MCP session, visible in the **MCP** tab.

Devin himself is implicitly a principal (the OS user running
`quoru`) and the UI grants him the human roles `techlead`,
`approver`, and `qa-owner` automatically — he's the operator, and
these are the human-typed roles in the eng pack.

> **Gap 1.** Local-dev principal trust model. Self-asserted
> principals are accepted on the UDS listener (OS perms already
> authenticated the user) and never on a TCP listener — the daemon
> refuses to start without `auth = "..."` on TCP, and refuses
> non-loopback binds without an explicit `expose = "public"`. Trust
> mode is therefore a property of the listener, not a flag the user
> can flip wrong. A first-use TOFU check binds each self-asserted
> principal to a connection fingerprint and warns on mismatch. The
> UI persistently shows the current listener / trust posture so an
> operator who later opens a TCP port understands what changed. See
> [`architecture.md` § Identity and authority](architecture.md#identity-and-authority).

> **Gap 2.** Principal-string registration UX. "Add principal" does
> two things: it names the principal (the string the agent must
> self-identify as via `QUORU_PRINCIPAL`) and it grants the
> principal a capability set (which packs, which roles). The
> copy-paste contract is the *name*; authority is what registration
> grants. Self-assertion is safe because an agent claiming a name it
> wasn't registered for, or a role it wasn't granted, is refused at
> the MCP boundary. Per-principal API tokens (where the token *is*
> the credential) remain a v2 hardening option for shops that want
> to remove self-assertion entirely; the capability machinery is the
> same in both cases.

### Step 4 — Start a feature (typed intent, agent-initiated)

Quoru is passive — the daemon does not start conversations on its
own, and there is no `quoru conversation start ...` CLI verb.
Conversations begin when an agent calls a typed intent over MCP.

Devin tells his agent what he wants:

```
You: I want to add debounce to the search input. Walk it through
the full eng flow — design first, then implementation.
```

The agent calls the typed intent:

```
quoru.eng.start-feature(
  description = "Add 300ms debounce to search input",
  initial-role = "architect"
)
```

The daemon creates `conv_01HW...`, assigns the calling agent
(`coding-agent`) to the `architect` role, and enters the
`DesignPending` state. The conversation ID is returned.

Note the contract here: there is no untyped `quoru.eng.send_message`
or `quoru.eng.chat` — see
[`pack-contract.md` § Intents](pack-contract.md#intents). Starting
a conversation requires a typed verb with a typed payload.

### Step 5 — The lifecycle runs

The conversation flows through eng's state machine. At each step,
either the agent or Devin acts via a typed verb. The dashboard
shows whose turn it is.

**Design phase.** Agent (in `architect` role) calls
`eng.draft(...)` to produce a design artifact. State transitions
to `AwaitingDesignApproval`. The dashboard now shows a pending
assignment for `approver` — Devin reviews the design in the UI and
clicks **Approve**, which calls `eng.approve-design(...)` under
the hood.

**Carve phase.** State transitions to `RoadmapPending`. Pending
assignment for `techlead` shows on dashboard. Devin clicks **Carve
milestone**; UI calls `eng.carve(...)`.

**Implementation phase.** State transitions to
`ImplementationPending`. Pending assignment for `dev` shows up.
The agent's MCP session sees the new assignment via
`quoru.list_assignments()`, claims it with `quoru.join(conv_id,
"dev")`, then runs `eng.propose` → `eng.review` → `eng.merge` →
`eng.deploy`. Each verb is recorded; deterministic side effects
(git, build, deploy) run through pack-shipped workers via the Fuse
effect channel.

**QA phase.** State transitions to `AwaitingQA`. Agent picks up the
`qa` assignment, runs `eng.plan-tests` and `eng.execute-tests`,
emits results.

**Signoff and ship.** State transitions to `AwaitingSignoff`.
Dashboard shows pending `qa-owner` assignment. Devin reviews test
results in the UI, clicks **Sign off** → `eng.signoff(...)`. State
transitions to `ReadyToShip`; Devin clicks **Ship** →
`eng.ship(...)`. Conversation completes.

End-to-end one agent + one human, **3 human touchpoints** (approve
design, carve milestone, sign off + ship — the last two grouped
on the dashboard).

### Step 6 — The dashboard as control tower

Throughout the flow, Devin's primary surface is the UI. It shows:

- **Conversations tab.** Every conversation, its current state, the
  role assignment that's pending. Devin can spot stalled work
  ("agent's been quiet for 30 minutes — is Claude offline?")
  without any SLA notification, because the dashboard renders engine
  state directly. The dashboard works even when *every* agent is
  disconnected.
- **Conversation detail.** Streams every admitted event — actor,
  role, verb, payload summary, evidence pointer. Pack-contributed
  slot views (e.g., the eng pack's roadmap-table, design-diff,
  test-results panels) render through the typed widget DSL.
- **Pending-on-you queue.** A combined view of every assignment
  waiting on Devin (approve this design, sign off this release,
  triage this incoming intake). One place to see what needs his
  attention.

For scripting and audit, the same content is available via the CLI:

```
quoru conversation tail conv_01HW...
quoru conversation log conv_01HW... --format jsonl
quoru conversation replay conv_01HW...
```

Replay re-runs workers against the recorded effect log.
Agent-emitted events are replayed as-recorded (the runtime does not
re-call the LLM); workers re-execute deterministically against
captured effects. Divergence is a runtime error.

### Step 7 — Iterate on the pack

Devin wants to tweak the eng pack — add a `notify` worker that
posts to his personal Discord when a milestone ships. He clones
the pack source, edits, and re-installs from the UI ("Install
local" → points at `./eng`, version `1.1.0`).

The daemon validates, hot-installs, and launches the new worker.
The MCP server's tool list and pre-matter regenerate; the
connected agent receives a `notifications/tools/list_changed` and
refreshes. Existing conversations stay pinned to `1.0.0`. New
`eng.start-feature` calls use `1.1.0` by default.

### Solo-dev gaps surfaced

- **Gap 1.** Local-dev principal trust model (see above). The
  listener-typing rule and TOFU check are specified; the UI's
  trust-posture indicator is the remaining UX piece.
- **Gap 2.** Principal-string registration UX (see above). Today's
  copy-paste name + operator-granted capability set is sufficient
  for the laptop case; v2 hardening pass should consider
  per-principal API tokens that remove self-assertion entirely.
- **Gap 3.** Right-sizing the eng pack for solo dev. Nine roles is
  honest for a real team but heavy for a one-person side project.
  Open question: should the pack support a "lightweight mode"
  that elides phases (skip strategic and research; skip qa for
  small changes), or do we expect solo devs to fork the pack with
  fewer roles? Working assumption: pack supports declared role
  subsets at conversation start ("this conversation skips qa")
  rather than ship a separate "solo" pack.

Everything else from the previous draft is now answered by
[`architecture.md`](architecture.md), [`pack-contract.md`](pack-contract.md),
and [`packs/eng.md`](packs/eng.md).

---

## Journey 2: Platform team

### Setup

Priya runs platform infra. Five product teams are each building
agent workflows. She wants to deploy Quoru once as shared
infrastructure so every team gets durable conversations, audit, and
replay without building it themselves.

This journey assumes Journey 1 works.

### Step 1 — Deploy the daemon

```
helm install quoru ./charts/quoru \
  --set storage.backend=postgres \
  --set storage.dsn=$QUORU_DB_DSN \
  --set transport.auth=oidc \
  --set transport.oidc.issuer=https://auth.company.internal
```

The daemon runs as a service backed by Postgres. Identity is
delegated to the company's OIDC issuer; every join event records the
OIDC subject as the principal (so the local-dev gap from Journey 1
is closed automatically here — there's a real transport in front).

> **Gap 3.** Horizontal scaling. Is the daemon single-node or
> horizontally scalable in v1? Horizontal scaling pushes a lot of
> complexity (conversation ownership, leader election, log
> coordination) into v1. The Helm chart above assumes a single-node
> deployment per tenant; clarify whether that's the v1 scope.

### Step 2 — Multi-tenant pack registry

Each product team installs its own packs into its own tenant:

```
quoru tenant create team-research --owner research-team@company
quoru tenant create team-content  --owner content-team@company

quoru pack install ./our-research-pack --tenant team-research
```

Conversations are tenant-scoped; the daemon refuses cross-tenant
joins. Workers are launched per-tenant (one set of workers per
installed pack per tenant) so a misbehaving worker in one tenant
cannot affect another.

> **Gap 4.** Is multi-tenancy a daemon-native concept or a deployment
> pattern (one daemon per tenant)? Daemon-native means the same
> daemon process enforces tenant isolation; per-tenant means Helm
> just runs N copies. Daemon-native is more efficient but adds
> isolation complexity; per-tenant is simpler but more expensive at
> the platform layer. Either is defensible; pick one.

### Step 3 — Observability

```
GET /metrics    # Prometheus format
```

Per-tenant counters: conversations started, events admitted, events
rejected by reason (schema, role, budget), replay successes,
divergences, log write latency, per-conversation token consumption.

For audit:

```
quoru log export --tenant team-research --since 24h --format jsonl \
  | kafka-publish audit.agent-conversations
```

> **Gap 5.** Observability contract. Metric names, log export format,
> event-stream subscription API — all still need explicit shapes.
> The journey assumes Prometheus + JSONL because conventional, but
> these are real interface commitments.

### Step 4 — Capacity and budget

```
quoru tenant set-quota team-research \
  --max-conversations 1000 \
  --max-tokens-per-conversation 100000 \
  --max-events-per-second 50
```

Per the threat-model resolution, budgets aggregate to the
conversation root, tenants are operator-declared aggregation scopes,
and per-actor sub-accounting prevents one bad agent from exhausting
the tenant cap.

### Step 5 — Pack-version upgrades

team-research ships v1.1.0 of their pack. Side-by-side install,
existing conversations pinned to v1.0.0:

```
quoru pack install ./our-research-pack --tenant team-research --as 1.1.0
```

Priya monitors replay-divergence metrics on v1.0.0 conversations to
confirm the v1.1.0 install didn't affect them (it shouldn't —
conversations pin per R6). Once v1.0.0 conversations drain, she
removes that version.

### Step 6 — Audit on demand

```
quoru conversation verify-chain conv_01J7...
```

Walks the authority chain, verifies every evidence pointer's content
hash matches the referent, confirms no log tampering. Output is
suitable to hand to an auditor.

> **Gap 6.** Where does the verify-chain tool live — in the daemon,
> or as a separate CLI that consumes exported logs? Separate is
> better for audit credibility (an auditor can verify without
> trusting the daemon binary). The journey assumes a separate verify
> tool that ships with the CLI but reads exported logs, not the live
> daemon.

### Platform-team gaps surfaced

- **Gap 3.** Horizontal scaling in v1: yes/no?
- **Gap 4.** Multi-tenancy daemon-native or per-tenant deployment?
- **Gap 5.** Observability contract (metrics shape, export format).
- **Gap 6.** Where chain-verification runs.

---

## Journey 3: Cross-org federation

### Setup

team-research at Acme is debugging an incident: their `recommender`
service is failing intermittently. The failing calls are to Bigco's
public Payments API. Acme's SRE quoru already has the incident
conversation open; they want to pull in Bigco's Payments SRE quoru
to jointly diagnose.

Acme operates Quoru per Journey 2. Bigco operates their own Quoru
independently. The two organizations have a pre-existing partnership
with the **`sre`** team pack (`sre@v2`) installed on both sides
(see scope's reference-packs list and the analog of
[`packs/eng.md`](packs/eng.md) for the SRE team).

### Step 1 — Configure the cross-org peer (one-time)

Acme's platform team configures Bigco as a known peer:

```toml
# acme-quoru config
[[peers]]
name = "bigco-sre"
endpoint = "https://quoru.bigco.com:9000"
trust = "mtls"
client-cert = "/etc/quoru/peers/bigco-sre.crt"
client-key  = "/etc/quoru/peers/bigco-sre.key"
trusted-ca  = "/etc/quoru/peers/bigco-ca.crt"

[peers.gossip]
share = []                     # don't tell Bigco about our other peers
accept = []                    # don't accept Bigco's peer list
advertise-capabilities = ["sre"]
```

Bigco's platform team mirrors the configuration on their side
(Acme's cert pinned, capabilities mutually advertised). This is the
one-time admin handshake — agents and incident responders never see
it.

### Step 2 — Acme's incident conversation hits a bridge point

The Acme `sre` workflow includes a `[[workflows.bridges]]`
declaration on the `AwaitingExternalDiagnosis` state, targeting
the `sre` pack with `receiver-role = "incident-commander"`. Acme's
investigator agent, working the failure, decides external help is
needed and triggers the transition. The workflow emits a
`BridgeRequested` wrapping a typed cross-team intent call:

```
sre.investigate-request(
  question     = "which payment intents are failing 5xx since 03:30 UTC?",
  scope        = "merchant-id=acme-recommender",
  urgency      = "active-incident",
  context-ref  = "<evidence pointer into acme conv_A>"
)
```

(See [`pack-contract.md` § Cross-team intents](pack-contract.md#cross-team-intents)
for the paired-verb pattern.)

The daemon hands the `BridgeRequested` to the configured matcher.
If Acme uses the direct-peer matcher and the agent specified
`bigco-sre`, the request goes straight there. If
broadcast-and-respond is in use, the request fans out to peers that
advertise `sre`; Bigco's quoru is the only one that says "I handle
Payments."

### Step 3 — Bigco's daemon evaluates and accepts

Bigco's daemon receives the `BridgeRequested`. Local policy:

```toml
[[bridge-policies]]
from-peer = "acme-sre"
pack = "sre"
intent = "investigate-request"
auto-accept = true
notify-channel = "#payments-oncall"
```

The daemon auto-accepts (per policy), creates a corresponding
conversation `conv_B` on Bigco's side from the `sre` pack, assigns
the `incident-commander` role to Bigco's on-call agent for triage,
and replies with `BridgeAccepted` carrying `(peer-id=bigco-sre,
conv-id=conv_B)`.

Acme's daemon records the acceptance in `conv_A` and now has a
synthetic local participant for Bigco's responder. Both daemons'
dashboards (the human's control tower per
[`architecture.md` § UI and BFF](architecture.md#ui-and-bff)) now
show the active bridge alongside the conversation.

### Step 4 — Joint diagnosis

Bigco's incident-commander triages (auto-accept already happened;
in higher-stakes intakes a human would commit here) and routes the
investigation internally to Bigco's `investigator` role. Bigco's
investigator agent picks up the assignment, runs whatever its
workflow allows — invoking local workers (Bigco's logs, traces,
metrics queries) — and emits:

```
sre.diagnosis-response(
  finding = "merchant rate-limit triggered at 03:34 UTC due to a
             config rollback that lowered the cap",
  evidence-ref = "<pointer into bigco conv_B>"
)
```

Acme's investigator receives the response (as a `BridgeEvent`
delivered into `conv_A`) and continues. If they need a follow-up,
they use the standard clarification pair:

```
sre.request-clarification(question="when did the new cap take effect?")
sre.provide-clarification(answer="03:34:18 UTC, deploy id abc123")
```

Clarification rounds are agent-to-agent; no human-in-the-loop
gate, no SLA timeout — if the responding agent goes silent, the
stalled bridge surfaces on both sides' dashboards and a human
investigates (see [`federation.md` § Stall visibility](federation.md#stall-visibility-no-slas)).

Each side's log records:

- All locally-originated events at full fidelity.
- All cross-boundary events as `BridgeEvent`s carrying the foreign
  principal, foreign role, and an evidence reference into the
  peer's log (`peer-id, peer-conv-id, peer-event-id, content-hash`).

Crucially, neither side's log lives in the other's storage.

### Step 5 — Audit across the boundary

After the incident, Acme's compliance team wants to verify the
authority chain on actions taken during the incident.

```
quoru conversation verify-chain conv_A
```

The verify tool walks Acme's log; for every `BridgeEvent`, it
contacts Bigco's daemon to fetch the referenced event from `conv_B`
and checks the hash. Bigco's daemon serves the referenced events
per its audit-cooperation policy.

Per the threat-model resolution for **F10** (cross-log audit
unavailability), v1 requires live peer cooperation for audit. If
Bigco's daemon is unreachable, audit can verify Acme's side
independently but cannot cross-verify the bridge references until
Bigco is reachable again. This is a documented v1 limitation;
v2 may add cached signed peer events.

### Step 6 — Bridge closes

The Acme workflow reaches a terminal state. Acme's daemon emits a
`BridgeClosed` notification to Bigco. Bigco's `conv_B` continues
independently (their incident workflow has its own terminal logic)
or terminates per their own state machine.

Both conversations are now closed and durably logged on their
respective sides. The bridge link in each log is permanent and
auditable.

### Cross-org gaps surfaced

> **Gap 7.** Peer onboarding UX. Cert provisioning and config
> exchange between two orgs' platform teams is currently an
> out-of-band process. A "bridge-bootstrap" command that automates
> the mutual handshake (cert signing, capability publication, policy
> agreement) would reduce the friction for two orgs that want to
> federate but don't already have a trust relationship.
>
> **Gap 8.** Discovery scope for capability broadcasts. If
> broadcast-and-respond is the matcher and Acme advertises
> capabilities to many peers, which peers see the broadcast? The
> answer is "whatever the matcher does" by current design, but
> there's no `[[workflows.bridges]]` field that says "broadcast only
> within trust-tier N" or similar. May be a v2 refinement.

(The previous draft's Gap 8 — bridge fallback transitions — has
been folded into [`pack-contract.md`](pack-contract.md) as
`on-reject` / `on-timeout` fields on `[[workflows.bridges]]`.)

---

## Resolved gaps

The previous draft listed 11 gaps; six were resolved by the daemon /
Fuse / MCP / assignment-model decisions captured in
`architecture.md`. For the record:

| Old gap | Resolution                                            |
|---------|-------------------------------------------------------|
| 1       | Daemon binary; native API + MCP server; both exposed  |
| 2       | Pack format specified in `pack-contract.md`           |
| 3       | Workers are pack-shipped effect performers, not agent proxies. Agents are MCP clients. |
| 5       | Long-lived MCP connection from agent to daemon        |
| 6       | Replay re-runs workers; agent events replay as-recorded |
| 7       | sqlite default at `~/.quoru/quoru.db`, postgres optional |

## Remaining gaps

Eight gaps across the three journeys. Cross-references:

- **Gap 1** (local-dev principal trust) overlaps with the threat-model
  **Actor binding** open question for the local-dev case.
- **Gap 4** (multi-tenancy model) interacts with the threat-model
  **Budget aggregation scope** resolution; if multi-tenancy is
  per-deployment rather than daemon-native, tenant-level aggregation
  is not a daemon concern at all.
- **Gap 7** (peer onboarding UX) is operational, not architectural;
  v1 ships with manual config and a documented procedure.
- **Gap 8** (broadcast scope) is a matcher concern; pluggable matchers
  can implement their own scoping. Not blocking v1.

Everything else is contained to the architecture, the operational
surface, or v2.
