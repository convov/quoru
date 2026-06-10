//! Pack model — unit of distribution and version pinning.
//!
//! See `docs/architecture.md` § Pack model and
//! `docs/pack-contract.md` for the manifest schema.
//!
//! Note: the canonical manifest types will move to `quoru-sdk`
//! once that crate exists (roadmap M6). They live here for now so
//! the runtime can name the surfaces it validates.

mod manifest;
mod registry;

pub use manifest::{IntentSpec, Manifest, PackMeta, RoleSpec, WorkerSpec, WorkflowSpec};
pub use registry::Registry;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PackId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PackVersion(pub String);

/// A pack pinned at the version a conversation was started under.
/// Conversations are pinned for life — see `docs/architecture.md`
/// § Three primitives.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackPin {
    pub id: PackId,
    pub version: PackVersion,
}
