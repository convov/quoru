//! Conversation — running instance of a pack's entry workflow.
//! Identified by an opaque ID. Pinned to the pack version it was
//! started under for the rest of its life.
//!
//! See `docs/architecture.md` § Three primitives.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ConversationId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: ConversationId,
    pub pack: crate::pack::PackPin,
}
