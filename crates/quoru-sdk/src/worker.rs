//! Worker registration. Pack authors implement [`Worker`] for each
//! entry point declared in their manifest's `[[workers]]` table and
//! hand a [`Registration`] to the daemon at process startup.
//!
//! Two lifecycles: [`Lifecycle::PerInvocation`] (default — safe under
//! replay) and [`Lifecycle::LongLived`] (opt-in — pack author
//! attests the worker's in-memory state is reconstructible from the
//! durable log).
//!
//! See `docs/architecture.md` § Worker lifecycle.

use serde::{Deserialize, Serialize};

use crate::conversation::ConversationClient;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Lifecycle {
    #[default]
    PerInvocation,
    LongLived,
}

/// Implemented by pack authors. Each invocation gets a fresh
/// [`WorkerContext`] bound to the conversation the daemon dispatched
/// from.
pub trait Worker {
    fn name(&self) -> &str;

    fn handle(
        &self,
        ctx: &WorkerContext,
        payload: serde_json::Value,
    ) -> crate::Result<serde_json::Value>;
}

pub struct WorkerContext {
    pub conversation: ConversationClient,
}

/// Bundle of worker bindings handed to the daemon. Mutually
/// declarative with the manifest's `[[workers]]` table — the daemon
/// refuses to spawn a worker whose manifest name has no
/// corresponding registration, and vice versa.
pub struct Registration {
    name: String,
    lifecycle: Lifecycle,
}

impl Registration {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            lifecycle: Lifecycle::PerInvocation,
        }
    }

    pub fn long_lived(mut self) -> Self {
        self.lifecycle = Lifecycle::LongLived;
        self
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn lifecycle(&self) -> Lifecycle {
        self.lifecycle
    }

    /// Hand control to the daemon. The worker process blocks here
    /// until the daemon terminates it.
    pub fn run(self, _worker: impl Worker) -> crate::Result<()> {
        todo!("Connect to the daemon, register, and dispatch invocations.");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_lifecycle_is_per_invocation() {
        let r = Registration::new("review-bot");
        assert_eq!(r.name(), "review-bot");
        assert_eq!(r.lifecycle(), Lifecycle::PerInvocation);
    }

    #[test]
    fn long_lived_opt_in() {
        let r = Registration::new("watcher").long_lived();
        assert_eq!(r.lifecycle(), Lifecycle::LongLived);
    }

    #[test]
    fn lifecycle_serde_snake_case() {
        let s = serde_json::to_string(&Lifecycle::PerInvocation).unwrap();
        assert_eq!(s, "\"per_invocation\"");
        let s = serde_json::to_string(&Lifecycle::LongLived).unwrap();
        assert_eq!(s, "\"long_lived\"");
    }
}
