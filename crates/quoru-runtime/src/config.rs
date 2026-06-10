//! Top-level daemon configuration. See `docs/architecture.md`
//! § Daemon model for the field semantics.

use crate::listener::Listener;
use crate::storage::StorageBackend;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonConfig {
    #[serde(default)]
    pub listeners: Vec<Listener>,

    #[serde(default = "default_storage")]
    pub storage: StorageBackend,
}

fn default_storage() -> StorageBackend {
    StorageBackend::Sqlite {
        path: crate::state_dir::state_dir().join("quoru.db"),
    }
}
