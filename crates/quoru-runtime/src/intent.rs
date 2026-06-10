//! Typed intents — the only way to start a conversation from
//! outside. Declared in pack manifest; surfaced as MCP tools.
//! There is no untyped "talk to this pack" surface.
//!
//! See `docs/architecture.md` § External surface — MCP server.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct IntentName(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentInvocation {
    pub pack: crate::pack::PackId,
    pub intent: IntentName,
    pub payload: serde_json::Value,
    pub principal: crate::principal::PrincipalId,
}
