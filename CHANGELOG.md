# Changelog

All notable changes to Quoru will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `quoru-runtime` crate scaffold (M5). Module surface for daemon, listeners,
  config, principal, pack/manifest/registry, worker supervision, conversation,
  intent, MCP adapter, native API, storage backend, and state-directory
  conventions. Listener safety invariants from `docs/architecture.md` (TCP
  requires `auth`; non-loopback bind requires `expose = "public"`) are encoded
  in types and covered by unit tests. fuse-engine integration deferred to a
  follow-up milestone.
