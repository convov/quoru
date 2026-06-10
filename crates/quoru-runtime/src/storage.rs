//! Storage backend — sqlite (default) or postgres. Both implement
//! the same Fuse-core storage interface; the swap is config-only.
//!
//! See `docs/architecture.md` § Storage.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum StorageBackend {
    Sqlite { path: PathBuf },
    Postgres { url: String },
}
