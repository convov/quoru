//! Quoru runtime — passive daemon hosting durable multi-agent
//! conversations. Embeds Fuse for durable execution.
//!
//! See `docs/architecture.md` for the layer model and the surfaces
//! this crate owns. The daemon is a host, not an orchestrator: it
//! never originates conversations; agents drive them via MCP.
//!
//! Status: scaffold (roadmap M5). Module surfaces are present; most
//! bodies are stubbed pending follow-up milestones. Listener safety
//! invariants from the architecture doc are encoded and tested.

pub mod api;
pub mod config;
pub mod conversation;
pub mod daemon;
mod error;
pub mod intent;
pub mod listener;
pub mod mcp;
pub mod pack;
pub mod principal;
pub mod state_dir;
pub mod storage;
pub mod worker;

pub use daemon::Daemon;
pub use error::{Error, Result};
