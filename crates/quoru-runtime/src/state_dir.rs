//! State directory conventions. Default: `~/.quoru/`.
//!
//! See `docs/architecture.md` § Daemon model.

use std::path::PathBuf;

/// Resolve the Quoru state directory. Default `~/.quoru`,
/// overridable via the `QUORU_STATE_DIR` env var.
pub fn state_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("QUORU_STATE_DIR") {
        return PathBuf::from(dir);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".quoru")
}

/// Default Unix control-socket path: `{state_dir}/control.sock`.
pub fn control_socket_path() -> PathBuf {
    state_dir().join("control.sock")
}
