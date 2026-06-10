//! Identity & authority. Principals are the actors a conversation
//! event is attributed to.
//!
//! See `docs/architecture.md` § Identity and authority.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PrincipalId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PrincipalKind {
    Human,
    Agent,
    Worker,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub id: PrincipalId,
    pub kind: PrincipalKind,
    pub display_name: String,
}

/// One link in an authority chain — who acted on behalf of whom.
/// The chain is what audit replays to attribute an event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorityLink {
    pub principal: PrincipalId,
    pub on_behalf_of: Option<PrincipalId>,
}
