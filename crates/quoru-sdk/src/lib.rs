//! Quoru pack-author SDK. Three surfaces:
//!
//! - [`manifest`] — canonical `quoru.toml` types, parsing, and the
//!   structural validation rules from `docs/pack-contract.md`
//!   § Manifest rules enforced at install.
//! - [`worker`] — `Worker` trait + `Registration` builder pack
//!   authors use to declare worker entry points the daemon
//!   supervises.
//! - [`conversation`] — `ConversationClient` workers use to read
//!   and post events on their host conversation.
//!
//! Status: scaffold (roadmap M6). The runtime currently carries its
//! own copy of the manifest types in `quoru-runtime::pack`; a
//! follow-up wiring milestone consolidates those onto the SDK.
//! Worker spawn and conversation transport are unimplemented; the
//! surface is shaped so follow-ups can land without breaking pack
//! authors who pin the SDK today.

pub mod conversation;
mod error;
pub mod intent;
pub mod manifest;
pub mod pack;
pub mod worker;

pub use conversation::{ConversationClient, ConversationId, Event};
pub use error::{Error, Result};
pub use intent::{IntentInvocation, IntentName, IntentResult};
pub use manifest::Manifest;
pub use pack::{PackId, PackPin, PackVersion};
pub use worker::{Lifecycle, Registration, Worker, WorkerContext};
