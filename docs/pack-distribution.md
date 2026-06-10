# Quoru Pack Distribution and Safety

Status: draft. Covers how packs are distributed, trusted, and
sandboxed. The distribution model is load-bearing — it shapes every
safety mechanism — so the two are treated together in this doc.

## Distribution model: no bundled packs

The Quoru binary ships with **zero packs installed**. Users explicitly
add pack sources and install packs from them. Reference packs (the
SRE / coordination / compliance examples) live in a separate
convov-maintained repo with its own release cadence.

This is the *apt / Homebrew / Terraform* model, not the *npm / cargo*
model. There is no default public registry; trust is per-source and
explicit.

### Why this model

- **Honest framing.** Quoru is a runtime. Bundling implies
  endorsement and "blessed" packs; not bundling is honest about
  what the project is.
- **No gatekeeper bottleneck.** We don't review, version, or
  release-cycle other people's packs. Operational load stays small
  as the ecosystem grows.
- **Composes with federation.** A federated world has many trust
  boundaries; assuming a single canonical pack set is exactly the
  wrong assumption to bake in.
- **Enterprise case stops being a special case.** "Acme has their
  own packs repo" becomes literally the same flow as "convov has a
  packs repo" — different URL, same machinery. No bifurcated story.

### What this model costs

- **Higher first-run friction.** Mitigated by built-in source
  shortcuts (see below) so the reference path is two commands, not
  eight.
- **Reference packs become *the* on-ramp.** Their quality is the
  project's first impression; we treat the reference repo as a
  product surface, not a demo.
- **Discovery problem.** No central registry. Mitigated for v1 by a
  community-maintained "known sources" list in docs. Real
  discovery infrastructure is a community problem if and when the
  ecosystem grows enough to need it.
- **Trust decisions pushed to users who often can't evaluate them.**
  Mitigated by install-time confirmation UI plus the
  defense-in-depth safety layers below — trust is *one* layer, and
  even fully-trusted packs are bounded by enforced capability
  declarations.

### Source configuration

```toml
# Quoru daemon config (~/.quoru/config.toml or system equivalent)

[[sources]]
name = "convov"
url = "https://github.com/convov/quoru-packs"
trust = "trusted-publisher"
public-key = "/etc/quoru/keys/convov.pub"

[[sources]]
name = "acme-internal"
url = "https://git.acme.internal/quoru-packs"
trust = "trusted-publisher"
public-key = "/etc/quoru/keys/acme-packs.pub"
```

Sources are explicit. The daemon ships with **no sources configured
by default** — a fresh install has zero trusted sources.

### On-ramp: the `convov` shortcut

To keep new-user friction low without compromising the explicit-trust
model, the CLI ships with a built-in shortcut for the convov
reference repo:

```
quoru source add convov           # resolves to canonical URL + pinned key
quoru pack install convov/coordination
```

Two commands to a working pack. The shortcut is purely a UX
convenience; the user still explicitly added the source. We commit
to never adding a source automatically, and we commit to never
shipping a shortcut for any source we don't directly operate.

### Reference repo: `github.com/convov/quoru-packs`

The reference repo is:

- **Decoupled** from Quoru releases (own release cadence)
- **Signed** with a convov-published key
- **Source-only** (no binaries; `.fuse` files + worker source in
  TypeScript / Go / Rust)
- **Audited at PR review** (community-visible)
- **The on-ramp**, not the default install

Treating it as a separate product means it can iterate independently
of the runtime, accept contributions from a wider community, and grow
without bloating the daemon binary.

## Safety: layered defense

The trust decision ("do you trust this source?") is one safety layer.
On its own it's weak — users will trust too liberally or too
conservatively, and even trusted sources ship bugs. The other layers
below bound the damage when trust is misplaced or when an audited
pack still has a flaw.

### Layer 1 — No packs bundled, explicit `source add`

Per the distribution model above. The user has to actively decide
what to install.

### Layer 2 — Source-only packs, no binaries

Packs distribute as source. Workers are TypeScript / Go / Rust /
Python — code, not opaque binaries. Anyone can read what a pack
does before installing it. The daemon compiles (or interprets) the
source at install time.

This makes audit possible at all. A binary distribution model
defeats most of the rest of the layers below because you can't
meaningfully reason about what an opaque blob will do.

### Layer 3 — Capability-based manifest

The pack manifest declares exactly what its workers need access to:

```toml
[capabilities]
network = [
  "https://api.datadoghq.com",
  "https://hooks.slack.com",
]
filesystem = []                    # no fs access
secrets = ["datadog-api-key", "slack-bot-token"]
resources = ["postgres-incidents"] # named Fuse resources

[[workers.git.capabilities]]       # per-worker override possible
network = ["https://api.github.com"]
filesystem = ["/repo:read"]
```

The daemon enforces these declarations at runtime. A worker
attempting any access outside its capability declaration is killed
and the violation is logged.

This is the single most valuable layer because it works against
threats that review didn't catch — bugs, dependency injection,
malicious PR slipping through, supply-chain compromise. Even a
fully-compromised worker is bounded to what its manifest declared.

### Layer 4 — Network egress whitelist enforcement

Daemon intercepts outbound network from workers (via a per-pack
proxy, network namespace, or platform-native mechanism). Any
destination not in the pack's declared `network` capability is
refused at the syscall level. A compromised pack literally cannot
reach `evil.com`.

Standard sandboxing pattern; cheap to implement on top of layer 3.

### Layer 5 — Per-pack process isolation

Each pack's workers run as a dedicated OS user, in a dedicated
namespace, with a dedicated seccomp profile (or platform-native
equivalent on macOS / Windows). Workers cannot read other packs'
state, cannot affect the daemon, cannot escape their resource
bindings. Blast radius is one pack, not the host.

### Layer 6 — Install-time confirmation surface

`quoru pack install <ref>` does *not* install immediately. It:

1. Fetches the pack source.
2. Verifies the signature against the configured source's key.
3. Prints a summary:
   - Pack name, version, source URL
   - Signing key fingerprint
   - Declared capabilities (every URL, file path, secret, resource)
   - Diff against the previously installed version, if any
   - Worker source file paths the user can inspect
4. Prompts for confirmation. Refuses on `--no-confirm` in
   interactive contexts; `--yes` is available for CI/automation
   but must be explicit.

Trust is informed, not blind.

### Layer 7 — HITL gates on high-stakes effects

Per [`scope.md`](scope.md). Even within a successfully-running pack,
specific effects (deploy rollback, customer comms, financial
actions) pause for human approval before executing. Defense in
depth at the *effect* layer, not the *install* layer.

### Layer 8 — Effect rate limits

Caps on how many of each effect type a pack can perform — per
conversation, per tenant, per minute. A compromised pack cannot
burn $50k in API calls or page 10k people in seconds. Limits are
declared per pack with daemon-enforced defaults that always apply
even if the pack declares higher numbers.

### Layer 9 — Community-maintained "known sources" list

In docs. Lightly curated, community-submitted list of pack sources
("here are repos people use"). Not infrastructure. Each entry
includes a brief description of what the source publishes and who
operates it. Users add at their own risk; the list is signal, not
endorsement.

### Layer 10 — Reproducible builds + signed releases (optional v1)

Pack source compiles deterministically to a reproducible artifact;
the published signed release contains both the source and the
expected build hash. Operators can verify on install that what
they're installing matches what was published. Closes the "I
shipped you the source but a different binary" gap.

v1 if compliance / supply-chain matters to early users; v2
otherwise.

## How this connects to other decisions

- **Federation** ([`federation.md`](federation.md)): peers can
  advertise capabilities including which packs they have installed.
  The pack-distribution model means an Acme daemon and a Bigco
  daemon may have completely different pack inventories from
  completely different sources — federation's pack symmetry
  requirement is a runtime check at bridge time, not a curation
  assumption.
- **Pack contract** ([`pack-contract.md`](pack-contract.md)): the
  `[capabilities]` and per-worker capability sections referenced in
  layer 3 are extensions to the manifest schema and will be folded
  into pack-contract.md when this distribution model is ratified.
- **Threat model** ([`threat-model.md`](threat-model.md)): the
  defense-in-depth layers address several previously-undocumented
  threats around pack supply-chain and worker capability boundaries.
  A new "Pack supply chain and worker capability" section is
  warranted.
- **Scope** ([`scope.md`](scope.md)): "Pack signing + signature
  policy" is listed there as a candidate. Under this distribution
  model, signed releases (layer 10) become more important than
  signing as a separate feature — the source-add flow is the
  primary trust act, and signed releases are how that trust gets
  pinned over time.

## Open questions

- **Public key distribution for built-in shortcuts.** The `convov`
  shortcut needs to ship with the canonical public key pinned in
  the Quoru binary. How do we rotate that key? Likely answer: ship
  with a key, support multiple valid keys for transition periods,
  document the rotation procedure. Worth committing to before v1
  ships.
- **Pack-source policy for organizations.** An enterprise probably
  wants policy like "only install from `acme-internal`, never from
  `convov`, even if a user tries." Should the daemon support a
  hard `[policy] allowed-sources = [...]` config? Probably yes for
  any organization-deployed daemon.
- **Capability-manifest schema.** The example above is sketch-level;
  the actual schema needs to cover network (URLs vs. CIDRs vs.
  hostnames), filesystem (read vs. write, paths vs. globs), secrets
  (named references), resources (named Fuse resources), and
  outbound message capabilities (Slack, email, PagerDuty, etc.).
  Worth a dedicated design pass once this doc lands.
- **Source resolution and offline use.** What happens when a
  configured source is unreachable at install time? The daemon
  should likely cache resolved packs locally so reinstalls /
  daemon restarts don't require source connectivity. Caching policy
  is a small but real design call.
- **Pack uninstall and tenant scoping.** If multiple tenants install
  the same pack from the same source, is it one install or per
  tenant? Probably per tenant for isolation, but worth confirming.
