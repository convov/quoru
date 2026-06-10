# Quoru Architecture

Status: draft. Reflects current design decisions; load-bearing details
(pack contract) are specified in [`pack-contract.md`](pack-contract.md).
Threats and runtime invariants are enumerated in
[`threat-model.md`](threat-model.md).

## One-line summary

Quoru is a passive daemon that hosts durable multi-agent conversations.
Conversations are Fuse workflows; pack-shipped workers perform side
effects; external agents drive the conversation over MCP; a local web
UI manages packs and surfaces pack-contributed views.

Passive means the daemon never originates a conversation. Conversations
are started by agents calling into the MCP server, never by the daemon
itself or by a CLI verb. The daemon is a host, not an orchestrator.

## Layer model

Three tiers, from bottom to top:

1. **Fuse (core engine)** — durable execution: workflows, entities,
   the durable log, worker supervision, replay machinery, storage
   backends. Quoru embeds Fuse; it does not duplicate any of it.
2. **Fuse App SDK** — *proposed, not yet extracted.* The reusable
   scaffolding that any Fuse-powered domain application would want:
   daemon binary conventions, pack/bundle format, native API server,
   principal-scoped work queues. Today, these surfaces live inside
   the Quoru daemon; the SDK extraction happens if and when a second
   Fuse app is on the roadmap. This doc identifies which surfaces
   would move there.
3. **Quoru (the app)** — conversation domain model, role and event
   manifest extensions, the MCP server, the assignment model, and
   the reference coordination pack.

The split exists so this doc can be honest about which Quoru surfaces
are "domain logic" vs. "generic Fuse-app plumbing." It does not yet
imply a separate `fuse-app-sdk` crate.

## Three primitives

- **Runtime** — the Quoru daemon. Long-lived, per-user by default.
  Embeds Fuse, supervises pack workers, exposes a native API, an MCP
  server, and a local web UI.
- **Pack** — a distributable bundle of one or more `.fuse` files
  (workflows + entities), worker binaries, an event-schema directory,
  and a `quoru.toml` manifest declaring the contract. See
  [`pack-contract.md`](pack-contract.md).
- **Conversation** — a running instance of a pack's entry workflow.
  Identified by an opaque ID. Pinned to the pack version it was
  started under for the rest of its life.

## Daemon model

`quoru serve` starts a single long-lived daemon process.

- **Per-user by default.** State directory is `~/.quoru/`. A
  per-machine or per-tenant daemon is a deployment choice, not a
  separate binary.
- **Listeners.** The daemon exposes its surfaces (native API,
  UI/BFF) over typed listeners declared in config. A `unix-socket`
  listener (default: `~/.quoru/control.sock`) admits self-asserted
  principals because filesystem permissions already authenticate
  the OS user. A `tcp` listener *requires* an explicit `auth = "..."`
  field; the daemon refuses to start without it. A non-loopback bind
  requires a second explicit `expose = "public"` field so exposing
  the daemon to a network is always a deliberate act. The wrong
  configuration is structurally hard to express; "trust mode" is a
  property of the listener, not a flag. See
  [Identity and authority](#identity-and-authority) for the
  principal-layer semantics and [UI and BFF](#ui-and-bff) for the
  renderer.
- **Service install.** `quoru install-service` writes a launchd plist
  (macOS) or systemd unit (Linux) so the daemon survives reboot, and
  prints the URL of the local UI for the user to open.
- **Worker supervision.** When a pack is installed, the daemon
  launches and supervises its workers per the lifecycle declared in
  the manifest. Crashed workers restart per supervision policy;
  per-invocation workers are spawned on demand.
- **Embeds Fuse.** Workflows and entities are Fuse artifacts;
  Quoru does not implement durable execution itself.

*App SDK surface:* daemon scaffolding, control socket, service
install, worker supervision, state directory conventions.

## Pack model

A pack is the unit of distribution and the unit of version pinning.
Quoru ships with **zero packs bundled**; users explicitly add pack
sources and install packs from them. See
[`pack-distribution.md`](pack-distribution.md) for the trust model
and safety layers.

- Multiple workflows per pack. Agent-facing entry points are
  declared as typed [intents](pack-contract.md#intents); a workflow
  not referenced by any intent is internal-only (reachable only via
  `spawn` from another workflow). There is no untyped "talk to this
  pack" surface.
- Multiple entities per pack (long-lived stateful Fuse objects).
- Workers live in the pack. The daemon supervises them; they perform
  deterministic side effects (git, file I/O, API calls) on behalf of
  the state machine.
- Closed-world events. The manifest's event-schema directory is the
  *only* set of events admissible at the conversation boundary.
- Roles are declared centrally in the manifest; workflows reference
  them by name. Install fails if a workflow references an undeclared
  role.

Full schema in [`pack-contract.md`](pack-contract.md).

*App SDK surface:* bundle format, manifest schema (extensible),
install/version/side-by-side machinery, pack registry. Quoru-specific
extension: the `[roles]` and event-schema sections.

## Worker lifecycle

Two modes, declared per-worker in the manifest:

- **`per_invocation` (default).** Worker process spawned per event,
  exits when done. No retained state. Safe under replay.
- **`long_lived` (opt-in).** Worker process supervised across many
  invocations; restarted on crash. Holds in-memory state. The pack
  author must explicitly attest that the worker's state is
  reconstructible from the durable log; otherwise replay diverges.

Default is `per_invocation` because replay correctness is easier to
defend. Long-lived is the power-user mode for workers where spawn
cost is meaningful (browser sessions, model loads).

*Fuse core surface.*

## Storage

- **Default: sqlite** at `~/.quoru/quoru.db`. WAL mode. Single file,
  movable, backupable. Sufficient for solo-dev and small teams.
- **Optional: Postgres** via config. Same `Log + Store` interface.
  The choice for shared/production deployments.
- Object/blob storage for large payloads is deferred to v2.

Both backends implement the same Fuse-core storage interface; the
swap is config-only.

*Fuse core surface.*

## External surface

Three surfaces, all served by the daemon, all wrapping the same
underlying operations:

### Native API

HTTP/gRPC. Source of truth. Used by:

- The `quoru` CLI (over the Unix socket locally, HTTP remotely).
- Custom agents in any language.
- Platform integrations (audit pipelines, observability).

The CLI exposes operational verbs only: pack source management, pack
install/activate/deactivate/uninstall, conversation inspection
(`tail`, `log`, `replay`, `verify-chain`), assignment helpers for
scripting. It does **not** expose a `conversation start` verb —
conversations are agent-initiated via MCP.

*App SDK surface:* API server scaffolding, routing, auth hooks.

### MCP server (dynamic)

A thin adapter exposing the same operations as MCP tools. The
agent-facing tool list is **dynamic**: it reflects the set of packs
currently installed and active in the daemon.

- Always-present tools: `quoru.list_assignments`, `quoru.join`,
  `quoru.send_event`, `quoru.await_events`,
  `quoru.get_conversation`.
- Per-pack intent tools: when a pack is activated, the MCP server
  adds one tool per declared intent —
  `quoru.<pack>.<intent>(payload)` — with the intent's payload
  schema as the tool's parameter schema. Cross-agent and cross-pack
  conversation starts are typed-intent-only; there is no untyped
  "send into this pack" surface. See
  [`pack-contract.md` § Intents](pack-contract.md#intents). When a
  pack is deactivated or uninstalled, its intent tools are removed.
- **Pre-matter.** The MCP server's `instructions` field is
  regenerated on every pack-state change to describe which packs are
  active, the roles each defines, and how an agent should discover
  pending assignments. Agents see an up-to-date orientation without
  hard-coding per-pack knowledge in their prompts.
- **Change notifications.** Tool-list and instructions changes are
  surfaced via the MCP `notifications/tools/list_changed`
  notification so connected agents refresh their view without
  reconnecting.

Because conversations are agent-initiated, MCP is the *only* entry
point for starting a conversation. This is intentional — passivity
is a design property, not an omission.

*Quoru-specific surface.* A different Fuse app would expose
webhooks, a different protocol, or its own dynamic tool registry on
top of the same App SDK MCP-server scaffolding.

### UI and BFF

The daemon serves a local web UI for human operators. It is the
human's **control tower** — the single surface through which a
person directs and observes the conversations running on their
daemon.

The four things a human does at the control tower:

1. **Watch progress** — see live state of every conversation, every
   role's current assignment, every cross-team bridge.
2. **Triage what needs attention** — pending-on-human assignments,
   stalled conversations (no activity since X), failed bridges,
   escalated clarification loops.
3. **Inject new ideas / requests** — start new conversations (which
   under the hood is calling typed intents on installed packs),
   refine in-flight ones via the workflow's declared
   human-input slots.
4. **Test and sign off features** — review designs, approve
   migrations, sign off releases. Each is a typed transition the
   workflow paused for; the UI surfaces the choice and records the
   signed action.

Two non-obvious requirements fall out:

- **Must render with zero agents connected.** The BFF projects
  engine state, not agent state. If every agent is offline, the
  dashboard still shows what's pending, what's stuck, and what
  conversations exist. Stalls are visible to the human without any
  agents running. This is also why Quoru does not specify
  agent-response SLAs: a stalled conversation surfaces on the
  dashboard regardless of *why* the agent isn't acting (offline,
  crashed, slow, broken) — humans investigate through the control
  tower, not via timeouts in the pack contract.
- **Must outlive every connected agent.** The daemon stays up
  across agent restarts; the UI is the persistent observation
  surface. If an agent crashes mid-conversation, the UI keeps
  showing the conversation's last known state and the now-stalled
  assignment.

Beyond the control-tower role, the UI is also where packs are
installed and managed, MCP clients are registered, and
pack-contributed views are rendered.

- **Tech pattern: Fuse BFF.** Quoru runs its own BFF instance
  co-located with the daemon (same process), following the pattern
  established by Fuse Studio. The BFF projects engine state plus
  `.fuse`-declared view metadata into typed view-specs over JSON +
  SSE. The renderer (React, served by the daemon) consumes
  view-specs and never queries the engine directly.
- **View-kinds.** Inherited from Fuse: `entity_detail`,
  `entity_list`, `action_form`, `dashboard`, `slot`. Quoru's
  first-party views map cleanly — installed packs as `entity_list`,
  pack install/MCP-register flows as `action_form`, conversation
  tail as `entity_detail` or `dashboard`.
- **Pack-contributed UI via slots.** A pack declares the
  `slot_kind`s it contributes (e.g., `roadmap_table`, `lock_panel`).
  When a pack workflow's view-spec includes a slot, the renderer
  looks up the slot-kind in its registry and renders it with the
  pack-provided context. This is how an ACP-style pack surfaces its
  own roadmap / claims / locks UIs inside the host shell.
- **Slot safety.** Pack-contributed UI is restricted to a **typed
  widget DSL** (the slot context is plain JSON; widgets are drawn
  from a host-defined vocabulary — table, timeline, form, kanban,
  log-tail, json-viewer, action-button, etc.). Packs do not ship
  arbitrary JavaScript that runs in the host UI process. See
  [`pack-distribution.md`](pack-distribution.md) for the rationale
  (defense-in-depth in the browser layer mirrors the worker-sandbox
  story). Iframe-with-postMessage-capabilities is a v2 escape hatch
  if a pack legitimately needs a custom interactive widget.
- **Loopback by default.** The UI port binds to `127.0.0.1` for
  local installs; production deployments bind it behind whatever
  transport-level auth the platform team supplies (same shape as
  the native API).
- **Read-only at first connect.** The UI never bypasses the daemon —
  every write goes through the same native API path the CLI uses.
  Authority chain and audit log treat UI-originated events
  identically to CLI- and agent-originated events.

*App SDK surface:* BFF scaffolding, view-kind primitives,
slot-registry plumbing, React shell. *Quoru-specific:* the
conversation/pack/assignment view-specs and the per-pack slot
catalog.

## Agent assignment model

Agents do not need to know conversation IDs in advance.

- Agent registers Quoru as an MCP server (Claude config, etc.).
- Agent's MCP credentials identify it as a principal.
- Agent calls `quoru.list_assignments()` → daemon returns pending
  conversation slots assigned to that principal.
- Agent picks one and calls `quoru.join(conversation_id, role)`.
- Join is recorded as an event in the log: `(principal, role,
  conversation-id)`. The binding is immutable for the lifetime of
  the conversation (per threat-model A1/S2 resolution).

Assignments come from:

- CLI: `quoru assign <conversation-id> --to <principal> --role <role>`
- Another agent in a parent conversation (delegating sub-work).
- A pack's startup logic when the conversation is created.

*App SDK surface:* principal-scoped work-queue primitive.
*Quoru-specific:* the assignment-UX semantics layered on top.

## Identity and authority

Quoru separates two things that are often conflated: *who is acting*
(identity assertion) and *what they are allowed to do* (authority).
Quoru does not define an identity scheme; it defines how asserted
identity gets gated.

### Identity assertion

The principal is the string recorded as the actor for an event. How
it gets there depends on the listener (see
[Listeners](#daemon-model)):

- **Transport-authenticated** (TCP listener with `auth = "..."`).
  The configured auth scheme (mTLS subject, OIDC sub, signed token,
  etc.) supplies the principal. See
  [agp-alignment.md](agp-alignment.md) for the non-overlap discipline.
- **Self-asserted** (UDS listener). The MCP client config asserts
  the principal name. Safe because the OS has already authenticated
  the user; the assertion just labels which of the user's agents is
  acting. Never accepted over TCP.

On UDS, a first-use TOFU check binds each self-asserted principal to
a connection fingerprint (process credentials, MCP client metadata).
Later connections claiming the same principal from a different
fingerprint surface a warning in the UI. This catches intra-laptop
impersonation without requiring real auth.

### Authority

Self-asserted identity is not authority. Before an agent can join
conversations or call pack-specific tools, an operator registers the
principal via the UI's "Add principal" flow. Registration binds the
principal name to a capability set — which packs the principal may
participate in, which roles it may take, which conversations it may
see. The MCP server enforces this set on every call.

The result: even on a fully self-asserted local-trust install, an
agent claiming a name it wasn't registered for, or calling
`quoru.join(...)` for a role it wasn't granted, is refused. The
operator's registration act is the trust gate; self-assertion alone
grants nothing.

Per-principal API tokens (where the token *is* the credential, no
self-assertion involved) are a hardening option for shops that want
to remove self-assertion entirely. The capability-set machinery is
the same in both cases.

### Audit context

Every event records the principal, the listener it came in over,
and the auth scheme that authenticated the principal (or
`self-asserted` if none). Investigators reading the log see
`agent-foo / uds / self-asserted` vs `agent-foo / tcp / mtls` and
understand the surrounding security context for free.

## Layer discipline

Quoru does not:

- Define an identity scheme — opaque tokens are consumed from the
  transport.
- Discover or route — endpoints are configured.
- Define transport-level access control.
- Advertise capabilities — that belongs to the transport or an
  external adapter.
- Define a wire protocol — events serialize through MCP, native API,
  or whatever transport is configured.
- Reimplement durable execution — Fuse owns that.

## What's not decided

Tracked in [`user-journeys.md`](user-journeys.md) gaps and
[`threat-model.md`](threat-model.md) open questions. The largest
remaining design call is whether and when to extract the Fuse App
SDK as a distinct artifact — see the layer model above.
