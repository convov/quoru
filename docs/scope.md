# Quoru Scope

Status: living document. What's in, what's out, and why. The point of
this doc is to keep the project from drifting into "generic agent
framework" territory.

## The fit test

Before adding a feature or commissioning a reference pack, ask:
*does this meaningfully benefit from at least one of Quoru's
distinctive properties?*

- **Durable replay** — the conversation survives crashes and can be
  deterministically re-executed.
- **Audit chain** — every event records who acted, on what evidence,
  with what claim.
- **Multi-agent participation as a first-class concept** — many
  identified actors coordinating in one conversation, not one agent
  doing one task.
- **Federation across trust boundaries** — bridged conversations
  between independently-operated daemons.

If the answer is no — if it would work just as well as a script, a
single-agent loop, or a generic chatbot framework — it isn't
Quoru-shaped and shouldn't be Quoru's scope.

## The second filter — tooling-or-knowledge

A pack that passes the fit test also has to pass this filter: does
it offer either (a) **bespoke tooling** not available outside the
pack — specialized Fuse workflows, state machines, side-effect
primitives, integration points — or (b) **private knowledge** the
model doesn't have in its weights — org-specific policies,
runbooks, schema, prior decisions, internal vocabulary?

A pack whose value reduces to "system prompt + LLM" fails this
filter even if it passes the fit test. This is what distinguishes
Quoru-shaped packs from packs that would work just as well as a
prompt in any agent framework.

The two filters together: the fit test rules out work that
*doesn't need* Quoru's properties; the tooling-or-knowledge filter
rules out work that *would not be improved by* a pack at all
(prompt-only "personas" don't earn a pack).

## Pack shape: team

A pack defines a **team** — a set of roles (agent and human), the
verbs that team can perform, and the workflows that coordinate
them. The unit of distribution is the pack file; the unit of
meaning is the team it describes. See
[`packs/eng.md`](packs/eng.md) for the reference instance.

Most reference packs are team-shaped: one pack = one team's
coordination protocol with multiple roles inside it. Two
exceptions are called out separately below:

- **Meta packs.** No team; the pack is a tool for building other
  packs. Won't appear in feature-shipping conversations.
- **Sub-conversation primitives.** No standalone purpose; invoked
  from within other packs as typed sub-conversations.

## Features

### In scope (specified)

The current design docs. Listed here as the baseline.

- Daemon binary + sqlite/postgres storage + supervised workers
  ([`architecture.md`](architecture.md))
- Pack contract ([`pack-contract.md`](pack-contract.md))
- Native API + MCP server (dynamic, per-pack tools)
  ([`architecture.md`](architecture.md))
- Local web UI + BFF (loopback by default; primary surface for
  pack management, MCP client registration, conversation viewing,
  and pack-contributed views). *Why Quoru:* the UI is the only
  reasonable surface for humans to install packs, register MCP
  clients, and inspect live conversations. Without it, the
  on-ramp is "edit TOML by hand"; we'd lose every non-CLI user.
  ([`architecture.md`](architecture.md))
- Pack-contributed UI via typed widget DSL (slots). *Why Quoru:*
  packs need to surface domain views (ACP roadmap, claim/lock
  tables, etc.) without shipping arbitrary JS into the host. The
  typed DSL is the only path that preserves the
  defense-in-depth posture from
  [`pack-distribution.md`](pack-distribution.md).
- Assignment model ([`architecture.md`](architecture.md))
- Replay correctness, authority chain, schema enforcement, budget
  ([`threat-model.md`](threat-model.md))
- Federation (bridged conversations) ([`federation.md`](federation.md))

### In scope (candidate, not yet specified)

Features that pass the fit test and are worth specifying when v1
core ships. Roughly ordered by "would I miss this most in v1."

- **Human-in-the-loop checkpoint as a built-in worker.** Pause at a
  state, notify a human (Slack/webhook), wait for approval, resume.
  *Why Quoru:* the wait survives daemon restarts because the
  conversation is durable. Critical for compliance, SRE, and any
  pack where "no agent action without human sign-off here" is
  policy. Likely needs to be in v1 to make compliance-style packs
  credible.
- **Event-stream subscriptions (webhooks out).** External systems
  subscribe to "conversations of pack X reaching state Y." *Why
  Quoru:* how Quoru integrates into existing CI / PagerDuty /
  Datadog without adapters. v1.
- **Pack dev mode.** `quoru pack dev` with hot-reload, event
  injection, replay shortcuts. *Why Quoru:* adoption bottleneck is
  "can someone author a useful pack in an afternoon" — this answers
  yes. v1.
- **Conversation export bundle.** Single signed tarball with log +
  pack + bridge audit references. *Why Quoru:* the artifact you
  hand an auditor or send a partner org without giving them daemon
  access. v1 if compliance packs ship; otherwise v2.
- **Operator intervention.** Operator injects an event into a stuck
  conversation, audit-tagged as `OperatorIntervention`. *Why Quoru:*
  the audit-tag is what makes this safe — it's a documented escape
  hatch, not a silent override. v1 (production-recovery escape
  valve).
- **Conversation forking.** Branch an in-progress conversation, run
  variants in parallel, diff. *Why Quoru:* almost free given
  durable replay; high differentiator vs. generic agent frameworks.
  v2.
- **Scheduled / recurring conversations.** Cron for `quoru
  conversation start`. *Why Quoru:* pairs with the pack model.
  Useful but not load-bearing. v2.
- **Pack signing + signature policy.** Sigstore-style; operators
  set "only install packs signed by trusted publishers." *Why
  Quoru:* becomes load-bearing when a pack registry exists, and
  federation amplifies it (peer's "I have pack X" is more
  trustworthy if signed). v2, becomes v1 if pack distribution
  goes public. See [`pack-distribution.md`](pack-distribution.md)
  for the full distribution / trust / safety model.

### Explicit non-goals

These come up because the broader agent-framework ecosystem ships
them. They are *not* Quoru's job. Calling them out so the team
doesn't accidentally accept the work.

- **LLM router / model abstraction.** That's the agent's
  responsibility. Quoru never calls models.
- **Prompt library / template system.** Same.
- **Built-in vector store.** Same.
- **Arbitrary pack JavaScript executing in the host UI.** Pack-
  contributed views run through the typed widget DSL (slot
  mechanism). Packs do not ship React components, raw JS bundles,
  or `<script>` tags into the host shell. If a pack genuinely
  cannot be expressed in the DSL, the v2 escape hatch is
  iframe-with-postMessage-capabilities — not in-process scripts.
  Why-not: pack workers are sandboxed under
  [`pack-distribution.md`](pack-distribution.md); a hole in the
  browser layer would defeat the rest of the safety story.
- **General-purpose workflow engine.** Fuse is the workflow engine.
  Quoru's value is the *multi-agent conversation* layer on top, not
  reimplementing Fuse.
- **Generic message queue.** Quoru is conversation-shaped, not
  queue-shaped. If someone wants a queue, they want a queue.

## Reference packs

The first reference pack Quoru ships is **`eng`** — the engineering
team (see [`packs/eng.md`](packs/eng.md)). Other team-shapes will
follow as siblings under `docs/packs/`. Each pack proposal must
sketch its roles, its intent verbs (internal and cross-team), and
its human touchpoint inventory; a pack without those is a pack
without a contract.

### Team packs

Each pack represents a coordinated team with its own
producer/consumer graph of roles, intent verbs, and human
touchpoints. All earn their slot under both filters above.

- **`eng`** — software engineering team. **First reference, ships
  with v1.** Nine roles spanning research → strategy → design →
  carve → code → qa → ship. Long-running migrations are a workflow
  within `eng` (with an added `cutover-approver` human role), not
  a pack of their own. Code-change and design-RFC flows are also
  covered here. See [`packs/eng.md`](packs/eng.md).
- **`sre`** — site-reliability team. Incident commander +
  investigators + comms. Strongest score on both filters
  (bespoke runbook execution, status-page integration, pager
  primitives; private runbooks, escalation paths, service
  dependency maps). Federation amplifies it: cross-org SRE handoff
  during incidents is the canonical multi-daemon story.
- **`compliance`** — compliance team. Requester + policy-checker +
  approver + human compliance-officer. Knowledge-heavy (company
  policies, regulatory mappings, control catalog). *The audit
  chain IS the compliance evidence.*

### Meta packs

No team; not a unit of feature delivery. Tools that help users
build other packs.

- **`packwright`** — agents that help users design packs (state
  machines, bridge points, intent verbs, event schemas). Adoption
  multiplier: turns "you have to learn `.fuse`" into "talk to this
  agent for a draft." Won't appear in feature-shipping
  conversations.

### Sub-conversation primitives

Not standalone packs. Invoked from within other packs as typed
sub-conversations at high-stakes states.

- **`redteam`** — adversarial review. Other packs spawn redteam
  sub-conversations to stress-test a proposal before commitment
  (e.g., `eng.dev` spawns it before `eng.merge` on a high-risk
  PR; `eng.architect` spawns it before `eng.approve-design`).
  *Fails the second filter as a standalone pack* — "be adversarial"
  is a prompt, not bespoke tooling or private knowledge — but
  valuable as a primitive other packs can compose.

### Skip as flagship packs

These are popular agent-framework demos that don't pass the fit
test. Building them in Quoru is fine but they're poor
*demonstrations* of what Quoru is for — they'd dilute the story.

- **Customer-support chatbot triage.** Usually doesn't need durable
  replay, audit, or federation. Standard agent frameworks cover it.
- **Single-agent task automation.** If it's one agent doing one
  thing, you don't need conversation primitives.
- **Generic RAG search.** No multi-agent participation, no need for
  audit chain.
- **Personal assistant / coach.** Single-user, single-agent;
  durability is nice-to-have, not load-bearing.

## How to use this doc

When considering a new feature or pack:

1. Run the fit test (top of doc).
2. Run the second filter (tooling-or-knowledge). Both must pass.
3. If a pack: identify which team-shape it represents (or whether
   it's a meta pack / sub-conversation primitive). Pack proposals
   without a clear team shape are usually really features inside
   an existing pack.
4. If it passes, add it to one of the "in scope" sections with a
   one-line *why-Quoru* note. The note is required — if you can't
   write it, the fit test failed.
3. If it doesn't pass but keeps coming up, add it to the explicit
   non-goals section with a one-line *why-not*. This prevents the
   same conversation repeating every six months.
4. Both lists are revisable. The point isn't to freeze scope; it's
   to make scope changes visible.
