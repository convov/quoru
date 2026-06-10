//! Worker supervision. Two lifecycles: `per_invocation` (default,
//! safe under replay) and `long_lived` (opt-in, requires the pack
//! author to attest that the worker's state is reconstructible from
//! the durable log).
//!
//! See `docs/architecture.md` § Worker lifecycle.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Lifecycle {
    #[default]
    PerInvocation,
    LongLived,
}

pub struct Supervisor {
    // TODO: child process table, restart policy, attestation check.
}

impl Supervisor {
    pub fn spawn(&self, _worker: &crate::pack::WorkerSpec) -> crate::Result<()> {
        todo!("Spawn a per-invocation or long-lived worker process.");
    }
}
