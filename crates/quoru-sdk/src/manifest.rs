//! `quoru.toml` manifest — canonical types + structural validation.
//!
//! Schema mirrors `docs/pack-contract.md` § Manifest schema. The
//! runtime enforces additional install-time rules (file existence,
//! API/engine version compatibility) that require disk/runtime
//! context and live in `quoru-runtime`. The structural rules here
//! (name closure, at-least-one intent, unique names) are SDK-side so
//! pack authors get them at `cargo test` time without standing up the
//! daemon.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

use crate::pack::{PackId, PackVersion};
use crate::worker::Lifecycle;

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
    pub name: PackId,
    pub version: PackVersion,
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
    pub lifecycle: Lifecycle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleSpec {
    #[serde(default)]
    pub description: Option<String>,
}

impl Manifest {
    /// Parse a `quoru.toml`. Surface for `quoru pack lint` and SDK
    /// integration tests.
    pub fn parse(toml_src: &str) -> crate::Result<Self> {
        toml::from_str(toml_src).map_err(|e| crate::Error::Parse(e.to_string()))
    }

    /// Structural rules — no disk access, no runtime context.
    /// Install-time rules (file existence, API/engine version) are
    /// applied by `quoru-runtime::pack::Registry::install`.
    pub fn validate_structural(&self) -> crate::Result<()> {
        if self.intents.is_empty() {
            return Err(crate::Error::Validation(
                "manifest must declare at least one intent".into(),
            ));
        }

        let mut intent_names = HashSet::new();
        for i in &self.intents {
            if !intent_names.insert(&i.name) {
                return Err(crate::Error::Validation(format!(
                    "duplicate intent name: {}",
                    i.name
                )));
            }
        }

        let mut worker_names = HashSet::new();
        for w in &self.workers {
            if !worker_names.insert(&w.name) {
                return Err(crate::Error::Validation(format!(
                    "duplicate worker name: {}",
                    w.name
                )));
            }
        }

        let workflow_names: HashSet<&str> =
            self.workflows.iter().map(|w| w.name.as_str()).collect();
        for i in &self.intents {
            if !workflow_names.contains(i.workflow.as_str()) {
                return Err(crate::Error::Validation(format!(
                    "intent `{}` references unknown workflow `{}`",
                    i.name, i.workflow
                )));
            }
        }

        for w in &self.workflows {
            for role in &w.roles {
                if !self.roles.contains_key(role) {
                    return Err(crate::Error::Validation(format!(
                        "workflow `{}` references unknown role `{}`",
                        w.name, role
                    )));
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pack_meta() -> PackMeta {
        PackMeta {
            name: PackId("eng".into()),
            version: PackVersion("0.1.0".into()),
            description: None,
            quoru_api: None,
            fuse_engine: None,
        }
    }

    fn well_formed() -> Manifest {
        let mut roles = BTreeMap::new();
        roles.insert("reviewer".into(), RoleSpec { description: None });
        Manifest {
            pack: pack_meta(),
            workflows: vec![WorkflowSpec {
                name: "review".into(),
                file: "workflows/review.fuse".into(),
                roles: vec!["reviewer".into()],
            }],
            intents: vec![IntentSpec {
                name: "request_review".into(),
                workflow: "review".into(),
                payload_schema: "schemas/review.json".into(),
                description: None,
                required_capability: None,
                cross_team: false,
            }],
            workers: vec![WorkerSpec {
                name: "review-bot".into(),
                exec: "workers/review-bot".into(),
                lifecycle: Lifecycle::default(),
            }],
            roles,
        }
    }

    #[test]
    fn well_formed_validates() {
        well_formed().validate_structural().unwrap();
    }

    #[test]
    fn at_least_one_intent_required() {
        let mut m = well_formed();
        m.intents.clear();
        assert!(m.validate_structural().is_err());
    }

    #[test]
    fn duplicate_intent_name_rejected() {
        let mut m = well_formed();
        m.intents.push(m.intents[0].clone());
        assert!(m.validate_structural().is_err());
    }

    #[test]
    fn duplicate_worker_name_rejected() {
        let mut m = well_formed();
        m.workers.push(m.workers[0].clone());
        assert!(m.validate_structural().is_err());
    }

    #[test]
    fn intent_workflow_must_exist() {
        let mut m = well_formed();
        m.intents[0].workflow = "missing".into();
        assert!(m.validate_structural().is_err());
    }

    #[test]
    fn workflow_role_must_exist() {
        let mut m = well_formed();
        m.workflows[0].roles = vec!["ghost".into()];
        assert!(m.validate_structural().is_err());
    }

    #[test]
    fn parses_minimal_toml() {
        let src = r#"
[pack]
name = "eng"
version = "0.1.0"

[[workflows]]
name = "review"
file = "workflows/review.fuse"
roles = ["reviewer"]

[[intents]]
name = "request_review"
workflow = "review"
payload-schema = "schemas/review.json"

[roles.reviewer]
description = "Reviews code changes."
"#;
        let m = Manifest::parse(src).unwrap();
        m.validate_structural().unwrap();
        assert_eq!(m.pack.name.0, "eng");
        assert_eq!(m.workflows.len(), 1);
        assert_eq!(m.intents[0].payload_schema, "schemas/review.json");
    }

    #[test]
    fn parse_error_surfaces() {
        assert!(Manifest::parse("not toml = = =").is_err());
    }
}
