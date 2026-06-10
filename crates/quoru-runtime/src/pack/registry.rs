//! Pack registry — packs currently installed in the daemon.
//! Source of truth for the MCP adapter's dynamic tool list.

use super::PackPin;

pub struct Registry {
    // TODO: installed-pack table backed by the state dir.
}

impl Registry {
    pub fn installed(&self) -> Vec<PackPin> {
        todo!("Enumerate installed packs from the state dir.");
    }

    /// Validate and install a pack. Enforces the rules in
    /// `docs/pack-contract.md` § Manifest rules enforced at install
    /// (API/engine version, file existence, role closure,
    /// worker-name closure, boundary-event closure, at-least-one
    /// intent).
    pub fn install(&self, _manifest: super::Manifest) -> crate::Result<()> {
        todo!("Run install-time manifest validation and persist the pack.");
    }
}
