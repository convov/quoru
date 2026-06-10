//! `quoru.toml` manifest types — scaffolded to mirror the schema in
//! `docs/pack-contract.md` § Manifest schema. Install-time
//! validation lives in [`Registry::install`](super::Registry::install).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub pack: PackMeta,

    #[serde(default)]
    pub workflows: Vec<WorkflowSpec>,

    #[serde(default)]
    pub intents: Vec<IntentSpec>,

    #[serde(default)]
    pub workers: Vec<WorkerSpec>,

    #[serde(default)]
    pub roles: BTreeMap<String, RoleSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackMeta {
    pub name: super::PackId,
    pub version: super::PackVersion,
    #[serde(default)]
    pub description: Option<String>,

    /// Required Quoru API range, e.g. `"^1"`. Install fails if the
    /// daemon's API version doesn't satisfy this.
    #[serde(rename = "quoru-api", default)]
    pub quoru_api: Option<String>,

    /// Required Fuse engine range, e.g. `"^0.4"`. Install fails if
    /// the embedded Fuse can't run the pack's `.fuse` files.
    #[serde(rename = "fuse-engine", default)]
    pub fuse_engine: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowSpec {
    pub name: String,
    pub file: String,
    #[serde(default)]
    pub roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentSpec {
    pub name: String,
    pub workflow: String,
    #[serde(rename = "payload-schema")]
    pub payload_schema: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "required-capability", default)]
    pub required_capability: Option<String>,
    #[serde(rename = "cross-team", default)]
    pub cross_team: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerSpec {
    pub name: String,
    pub exec: String,
    #[serde(default)]
    pub lifecycle: crate::worker::Lifecycle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleSpec {
    #[serde(default)]
    pub description: Option<String>,
}
