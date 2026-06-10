//! Typed intents — the only way to start a conversation. Declared
//! in the pack manifest; surfaced as MCP tools by the runtime.
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentResult {
    pub conversation: crate::conversation::ConversationId,
}
