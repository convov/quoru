//! MCP server adapter. Always-present operational tools + one tool
//! per declared intent in each active pack. Tool list and the
//! `instructions` pre-matter are regenerated on every pack-state
//! change; agents observe changes via
//! `notifications/tools/list_changed`.
//!
//! See `docs/architecture.md` § External surface — MCP server.

pub struct McpServer {
    // TODO: registry handle, JSON-RPC transport, notifications.
}

pub struct ToolDescriptor {
    pub name: String,
    pub description: String,
    pub schema: serde_json::Value,
}

impl McpServer {
    pub fn tool_list(&self) -> Vec<ToolDescriptor> {
        todo!("Compose always-present tools + per-pack intent tools.");
    }

    pub fn instructions(&self) -> String {
        todo!("Regenerate the pre-matter from the active packs.");
    }
}
