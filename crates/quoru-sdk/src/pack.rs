//! Pack identity. The unit of distribution and version pinning.
//!
//! See `docs/architecture.md` § Pack model.

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
