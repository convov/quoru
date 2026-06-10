//! Native API server — HTTP/gRPC. Source of truth used by the
//! `quoru` CLI, custom agents, and platform integrations. Operational
//! verbs only; conversations are agent-initiated via MCP.
//!
//! See `docs/architecture.md` § External surface — Native API.

pub struct ApiServer {
    // TODO: routing table, auth hooks, transport.
}

impl ApiServer {
    pub async fn serve(&self) -> crate::Result<()> {
        todo!("Bind the native API server and serve operational verbs.");
    }
}
