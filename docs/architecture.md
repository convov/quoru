# Quoru Architecture

Status: draft / outline.

## Three primitives

- **Runtime** — the durable conversation engine.
- **Pack** — distributable bundle of conversation machines, worker code, and a manifest.
- **Conversation** — a running pack instance.

## Pack contract (TBD)

A pack manifest will declare:

- Conversation machine paths.
- Worker entry points.
- Authority bindings.
- Observability metadata.
- Version requirements.

## Layer discipline

Quoru does not:

- Define an identity scheme — opaque tokens are consumed from the transport.
- Discover or route — endpoints are configured.
- Define transport-level access control.
- Advertise capabilities — that belongs to the transport or an external adapter.
- Define a wire protocol — events serialize to whatever the transport accepts.

See [`agp-alignment.md`](agp-alignment.md) for the non-overlap discipline
relative to the AGNTCY Agent Gateway Protocol.
