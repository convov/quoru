//! Daemon entry point. `quoru serve` lands here.
//!
//! Scaffold (M5): construction validates listeners; `serve` is
//! stubbed pending listener bind-up, fuse-engine embed, worker
//! supervision, and the API + MCP servers (follow-up milestones).

use crate::config::DaemonConfig;
use crate::Result;

pub struct Daemon {
    pub config: DaemonConfig,
}

impl Daemon {
    /// Build a daemon. Validates listener safety invariants up front
    /// so a misconfigured daemon never reaches `serve`.
    pub fn new(config: DaemonConfig) -> Result<Self> {
        for listener in &config.listeners {
            listener.validate()?;
        }
        Ok(Self { config })
    }

    pub async fn serve(self) -> Result<()> {
        todo!(
            "Open listeners, embed fuse-engine, supervise pack workers, \
             run native API + MCP servers."
        );
    }
}
