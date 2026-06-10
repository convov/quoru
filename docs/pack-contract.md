# Quoru Pack Contract

Status: draft. The pack contract is the single artifact that lets the
daemon install, validate, and run a pack. It is also the surface a
pack author must understand to ship a pack.

Quoru does not reimplement what the embedded Fuse engine already
provides. Workflows, entities, workers, timers, sagas, spawn, typed
side-effect contracts, and signed authority verbs are all Fuse
primitives the pack author uses directly. The Quoru pack contract
adds only what is conversation-specific: which workflows are
agent-startable, which roles agents can fill, which events admissible
at the conversation boundary, and which states can bridge to a peer
daemon.

## What's in a pack

A pack is a directory (distributed as a tarball or OCI artifact).
Layout:

```
my-pack/
  quoru.toml           # manifest — the contract
  workflows/
    review.fuse        # entry workflow (declares workers, timers,
                       # sagas, spawns inline using Fuse DSL)
    escalate.fuse      # internal workflow
  entities/
    document.fuse
  events/              # closed-world event schemas
    PlanDrafted.json
    ReviewRequested.json
    GitCommit.json
    ...
  workers/
    git_worker.ts      # source of worker processes referenced by the
    browser_worker.ts  # `worker` declarations inside the .fuse files
  README.md            # optional, for humans
```

The `quoru.toml` manifest is the contract. The daemon installs only
what the manifest declares; files outside the manifest are ignored
(but may be referenced from inside `.fuse` files or workers).

## Fuse primitives the pack contract relies on

The pack contract names these by reference; pack authors learn them
from Fuse documentation, not this doc.

- **`worker { }`** in `.fuse` files declares a worker's contract —
  timeout, retry, emitted events. Worker processes pull work from
  the engine, heartbeat, and execute through the typed side-effect
  channel. Replay correctness is enforced by the engine, not the
  worker.
- **`resource`** in `.fuse` files declares a long-lived capability
  the workflow holds (KMS, secret store, queue, blob, kv). Bindings
  map the resource to a concrete substrate per environment. This is
  how packs talk to credentials and external systems safely.
- **`saga { }`** declares compensation graphs the engine walks on
  failure. Failed workers are surfaced as events the workflow can
  transition on.
- **`after <duration> fire <Event>`** declares state-bound timers,
  auto-disarming on state exit.
- **`spawn`** declares child workflow runs from a transition;
  parent fans out and collects.
- **ACP signed authority verbs** (Ed25519-signed agent identity)
  give the runtime enforceable separation-of-duties checks via
  `require` guards on event fields.

Quoru's manifest references these primitives but does not duplicate
them. Where the manifest needs to list workers, it names them so the
daemon knows which processes to supervise — the contract details
already live in the `.fuse` file.

## Intents

A pack does not expose a freeform "talk to this pack" surface to
agents. Instead, the pack declares **intents** — named, typed entry
points for starting a conversation. Each intent has a verb name, a
payload schema, the workflow it starts, and a required capability.

The MCP server surfaces one tool per intent
(`quoru.<pack>.<intent>(payload)`), with the intent's payload schema
as the tool's parameter schema. To start a conversation against a
pack, an agent calls a typed intent tool. There is no untyped
equivalent.

Why typed-intents-only:

- **Authority gating.** Every intent declares a
  `required-capability`. An open chat surface has no meaningful
  capability gate — anyone permitted to talk to the pack at all
  could do anything.
- **Audit legibility.** Events record `agent-foo invoked
  coord.ship(milestone=42)`, not `agent-foo sent a message`. The
  intent verb is the operation's name forever.
- **Convergence and replay.** A named intent has a defined starting
  payload, target workflow, and success criterion. An open chat has
  none of these — there is no answer to "when is this done?" or
  "what was this for?"
- **Fit test.** Untyped agent-to-agent chat works just as well in a
  generic agent framework and would fail
  [`scope.md`](scope.md)'s fit test.

What is *not* an intent:

- **One-shot informational lookups** ("what packs are installed?",
  "fetch the schema of event X") are MCP **tool calls**, not
  conversations. Conversations are stateful, multi-turn, and
  durable; a one-shot question is a tool call.
- **Mid-conversation clarification** happens inside the existing
  conversation — the workflow may have an `AwaitingClarification`
  state — not as a new conversation.
- **Human-driven open-ended exploration** (a person designing
  something with their agent) is the human's conversation with
  their own agent. That agent may call typed intents on other packs
  to gather what it needs, but it does not start an open chat with
  another agent.

Multiple intents may target the same workflow (different verbs
mapping to different starting payloads). A workflow referenced by no
intent is internal-only and may only be reached via `spawn` from
another workflow.

## Cross-team intents

Packs that represent teams often need to receive requests from
*other* teams (peer daemons over a bridge, or other team-pack
instances on the same daemon). Cross-team requests are first-class
intents with their own pattern, distinct from internal intents.

### Paired-verb pattern

Every role that produces a typed artifact ships with **two** intents:

- An **internal verb** that the team's own role calls
  (`eng.carve`, gated to the `techlead` role).
- A **cross-team intake verb** that peer teams call
  (`eng.intake-request`, gated to an externally-grantable
  capability such as `external.eng.intake`).

The two verbs exist because:

- **Authority differs.** Externals don't get to call internal verbs;
  internal roles don't normally enter through the external intake
  path. Distinct verbs make the gate trivial.
- **Audit differs.** Events should read `aequa-techlead invoked
  eng.intake-request(...)` vs `fuse-techlead invoked eng.carve(...)`.
  Folding them into one verb destroys this distinction.
- **Triage differs.** An external intake always passes through a
  triage state on the receiving side (accept / reject / need more
  info); an internal carve does not.

### Cross-team verb catalog

The reference cross-team intake verbs every team pack should expose:

| Verb | Semantic | Typical sender role | Receiver role |
|------|----------|--------------------|---------------| 
| `<pack>.research-request` | "investigate Y, return artifact" | `researcher` | `techlead` (triage) → `researcher` |
| `<pack>.intake-request` | "consider doing this work for us" | `techlead` | `techlead` |
| `<pack>.deliverable-request` | "produce X and hand it back" | `techlead` | `techlead` → `dev` / `qa` |
| `<pack>.design-request` | "we need a design for X" | `architect` | `techlead` (triage) → `architect` |
| `<pack>.audit-request` | "review this artifact against policy" | `auditor` | `techlead` (triage) → `auditor` |

**The receiver is always `techlead` first**, even when the actual
work belongs to a downstream role. The receiving team's techlead
performs roadmap-fit triage and then routes internally. This keeps
roadmap authority with the team being asked, not the team asking.

### Clarification verb pair

Triage often needs a back-and-forth. To keep this lightweight
without reintroducing freeform chat, packs declare a typed
clarification pair:

- **`<pack>.request-clarification(question)`** — emitted by the
  receiver to the asker.
- **`<pack>.provide-clarification(answer)`** — emitted by the
  asker back to the receiver.

Clarification rounds are **agent-to-agent only** (no human in the
loop). They loop until the receiver has enough information to
decide. A pack-level `max-clarification-rounds` cap prevents
runaway loops; on exceeded, the workflow transitions to a "needs
human triage" state surfaced on the dashboard.

### Origin-linking

When a cross-team intake leads to an internal carve, the resulting
event records the **origin reference** — the peer conversation ID,
peer daemon ID, and originating intake event ID. This makes the
end-to-end audit chain navigable from either side:

- Inside the receiving team: "this milestone was carved because of
  external request X from peer Y."
- Inside the requesting team: "our request was accepted into peer
  Y's milestone Z; here's how it progressed."

The origin reference is a standard field on carve events that
originate from a cross-team intake; the daemon populates it
automatically from the bridge context.

### Gate-at-ship annotation

A team often ships a milestone with a follow-on that depends on
external input. The ship verb supports an optional `gate-on`
annotation so the receiving techlead can act on it:

```
eng.ship(milestone="M740",
         gate-on={ kind="external-deliverable",
                   from="aequa",
                   description="naming a consumer .fuse" })
```

After ship, the workflow enters a `GatedPostShip` state visible on
the dashboard. The next carve (e.g., `eng.carve` for `M740-impl`)
is blocked until the gate clears — either by an inbound
`deliverable-completed` event or by a techlead override.

This is the pattern that turns "we'll do the next phase once Aequa
gives us X" from an informal handoff into a typed, observable,
auditable contract.

## Manifest schema

```toml
[pack]
name = "coordination"
version = "1.0.0"
description = "Reference coordination conversation pattern"

# Which Quoru API version this pack expects. Daemons refuse to install
# packs whose required range they don't satisfy.
quoru-api = "^1"

# Which Fuse engine version was used to author the .fuse files.
# Daemons refuse to install if their embedded Fuse can't run these.
fuse-engine = "^0.4"

[[workflows]]
name = "review"
file = "workflows/review.fuse"
roles = ["author", "reviewer"]   # roles agents can hold in this workflow

  # Optional: states in this workflow that can bridge to a peer
  # daemon. See federation.md for the bridge contract.
  [[workflows.bridges]]
  when-state = "AwaitingExternalReview"
  emit = "BridgeRequested"
  target-pack = "design-collab"          # peer must have this pack...
  target-pack-version = "^1"             # ...with a compatible version
  target-role = "external-reviewer"      # ...and fill this role over there
  local-synthetic-role = "external-reviewer"  # how foreign participants
                                              # appear in this workflow
  admissible-events = ["DesignFeedback", "DesignApproved"]
                                              # only these cross from
                                              # peer to us

  # Fallback transitions when the bridge can't establish or stalls.
  on-reject  = "ReviewSkipped"
  on-timeout = "ReviewSkipped"
  timeout    = "30m"

[[workflows]]
name = "escalate"
file = "workflows/escalate.fuse"
# No intent references "escalate"; it is internal-only,
# reachable only via spawn from another workflow.

[[intents]]
name = "request-review"
description = "Request peer review of a document."
workflow = "review"
payload-schema = "events/ReviewRequested.json"
required-capability = "review.request"

[[intents]]
name = "request-escalated-review"
description = "Request review with senior-reviewer escalation eligible."
workflow = "review"
payload-schema = "events/ReviewRequested.json"
required-capability = "review.escalate"

# Cross-team intake. Callable by peer-team daemons over a bridge.
# Receiving role is always the team's techlead, which triages
# (accept / reject / clarify) and then routes internally.
# See § Cross-team intents.
[[intents]]
name = "intake-request"
description = "Peer team requests we consider doing work for them."
workflow = "intake"
payload-schema = "events/IntakeRequested.json"
required-capability = "external.review.intake"
cross-team = true
receiver-role = "techlead"

[[entities]]
name = "document"
file = "entities/document.fuse"

# Worker processes the daemon supervises. The actual contract
# (timeout, retry, emitted events, side-effect declarations) lives
# in the `worker name { }` block inside the .fuse files. The
# manifest only tells the daemon which processes to launch.
[[workers]]
name = "git"                              # matches `worker git { }` in some .fuse
exec = "workers/git_worker.ts"

[[workers]]
name = "browser"
exec = "workers/browser_worker.ts"

[roles]
# All roles agents can hold, with metadata. Workflows reference these
# by name. The daemon binds principals to roles at conversation join
# per the assignment model in architecture.md.
author = { description = "Original document author" }
reviewer = { description = "Peer reviewer" }

[events]
# Directory holding event schemas for events admitted at the
# conversation boundary (agent-emitted and bridge-incoming).
# Worker-emitted events and runtime-internal events do not live
# here — they are governed by their respective .fuse declarations
# and the runtime vocabulary.
schema-dir = "events/"
```

## Manifest rules enforced at install

The daemon validates these on `quoru pack install` and rejects the
pack on any failure. Fail-fast at install is the contract.

1. **API/engine version satisfaction.** Daemon's Quoru API and Fuse
   engine versions must satisfy the pack's declared ranges.
2. **File existence.** Every `file =` and `exec =` reference
   resolves to a file in the pack.
3. **Role closure.** Every role referenced by a `[[workflows]]`
   entry is declared in `[roles]`. Workflows that reference an
   undeclared role fail install.
4. **Worker-name closure.** Every `[[workers]]` `name =` matches a
   `worker <name> { }` declaration in at least one `.fuse` file in
   the pack. Workers declared in the manifest but not in any
   workflow fail install (dead supervision). Workers declared in
   `.fuse` files but not in the manifest fail install (the daemon
   wouldn't know which process to launch).
5. **Boundary-event closure.** Every event admissible at the
   conversation boundary (agent-emitted or bridge-incoming) has a
   schema in `events/`. Internal worker events and Fuse-internal
   events do not require manifest entries.
6. **At least one intent.** A pack with no `[[intents]]` is
   uninstallable — without intents, no agent can start a
   conversation against the pack.
7. **Intent well-formedness.** Every `[[intents]]` `name` is unique
   within the pack. Every `workflow` references a declared
   `[[workflows]]` `name`. Every `payload-schema` resolves to a file
   in `events/`. `required-capability` is a freeform string; the
   daemon does not validate it at install time (capability sets are
   configured per-deployment per the principal model in
   [`architecture.md` § Identity and authority](architecture.md#identity-and-authority)).
   For cross-team intents (`cross-team = true`), `receiver-role` must
   reference a role declared in `[roles]`; the daemon assigns the
   intake to that role on arrival.
8. **Workflow well-formedness.** Fuse-level checks (no overlapping
   transitions, type validity, worker contract sanity) run per
   `.fuse` file. The daemon refuses install on any Fuse-reported
   error.
9. **Bridge declaration well-formedness.** Every
   `[[workflows.bridges]]` entry must reference a `when-state` that
   exists in the workflow's `.fuse` file, a `local-synthetic-role`
   declared in `[roles]`, and `admissible-events` whose schemas
   exist in `events/`. If `on-reject` or `on-timeout` is set, the
   referenced state must exist in the workflow's `.fuse` file. If
   `on-timeout` is set, `timeout` must also be set (and vice versa).
   The daemon cannot validate `target-pack`, `target-pack-version`,
   or `target-role` at install time — those are checked when a
   bridge is actually attempted, against the matched peer.
10. **Bridge events not redeclared.** A pack must not define event
   schemas named `BridgeRequested`, `BridgeAccepted`,
   `BridgeRejected`, or `BridgeEvent` — these are runtime-internal
   per the threat-model resolution and the daemon owns the
   vocabulary.

## Versioning

- **Pack version is semver.** Major versions are independent
  installations; minor and patch upgrades are install-in-place.
- **Conversations pin to pack version at start.** A conversation
  started against pack `coordination@1.0.0` runs against `1.0.0` for
  its entire life, even after `1.1.0` or `2.0.0` are installed. See
  threat-model R6.
- **Event schemas are pack-versioned.** An event schema change
  requires a pack version bump. There is no independent event-schema
  version axis. See threat-model R5.
- **Side-by-side install for major versions.** `coordination@1` and
  `coordination@2` can coexist; the daemon disambiguates by version
  when starting conversations.

## Worker contract (deferred to Fuse)

A worker is a process. Its contract — what events it handles, with
what timeout and retry policy, what events it can emit, and what
side effects it is allowed to take — is declared in the `worker { }`
block inside the workflow's `.fuse` file using Fuse's typed
side-effect model. The Fuse engine handles:

- Dispatch (pull-based; workers connect and heartbeat)
- Retry and backoff per the `worker { }` declaration
- Idempotency keys on side effects
- Replay correctness via the typed effect channel (recorded inputs,
  recorded outputs, replay re-feeds rather than re-executes)
- Saga compensation when the workflow fails after the worker has
  already executed

The pack manifest's `[[workers]]` section exists only to tell the
Quoru daemon which processes to launch as worker hosts. The
business contract is Fuse's responsibility.

For deeper worker design (resources for credentials, typed
side-effect bindings, saga compensation graphs), see Fuse's
side-effects-as-typed-contracts documentation.

## What the manifest does *not* declare

Deliberately out of scope:

- **Worker timeout / retry / emitted events.** Inside `.fuse`, not
  the manifest.
- **Side-effect bindings per environment.** Inside `.fuse` (resource
  declarations) and resolved by the daemon's binding config, not
  the pack.
- **Transport.** Whether the daemon exposes MCP, native HTTP, or
  both is a daemon configuration choice, not a pack concern.
- **Identity.** Principals come from the transport (and from ACP
  signatures for cross-agent verbs). Packs declare roles; the
  daemon binds principals to roles at conversation join.
- **Storage.** The pack does not pick where its conversations are
  stored.
- **Observability.** Metrics and tracing are emitted by the daemon
  in a uniform shape across all packs.

This separation is what lets the same pack run unchanged on a
solo-dev laptop and on a multi-tenant platform deployment.

## Open questions

- **Distribution format.** Tarball, OCI artifact, both? `quoru pack
  install <ref>` should resolve from at least a local path, a Git
  URL, and an OCI registry — but the canonical format the daemon
  unpacks is a single decision worth committing to. (See also the
  pack-safety discussion: if all reference packs ship inside the
  Quoru OSS repo and are bundled with releases, the distribution
  question only matters for enterprise / third-party packs.)
- **Worker wire format.** Fuse's worker SDK pins this; the pack
  contract just inherits whatever Fuse uses. Not a Quoru-level
  open question.
- **Inter-pack composition.** Can workflow A in pack X spawn
  workflow B in pack Y? Fuse `spawn` supports cross-machine spawns
  via namespace trust; the Quoru-level question is whether the
  pack manifest needs to declare cross-pack dependencies for
  install-time validation. Forward-compatible; not v1.
- **Worker resource limits.** CPU, memory, concurrency. The daemon
  could enforce per-worker; Fuse may already cover some of this
  via the dispatch model. Forward-compatible.
- **Field-level sensitivity annotations.** Fuse's `data { }` typed
  payloads do not currently expose per-field sensitivity tags
  (PII, secret, public). Quoru's federation bridge filtering and
  audit-export redaction depend on these. This is either a Quoru
  extension on top of Fuse data blocks or a feature-request to
  Fuse. See [`use-cases/sre-incident-response.md`](use-cases/sre-incident-response.md)
  R6.
