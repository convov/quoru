//! Conversation client — the worker-side view of a running
//! conversation. Workers read prior events and post new ones via
//! this handle. The runtime supplies it; pack authors don't
//! construct one directly.
//!
//! Events carry an authority chain (who acted on whose behalf).
//! `docs/architecture.md` § Identity and authority covers the model;
//! the chain is reconstructed by the runtime per invocation, not
//! forged by the worker.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ConversationId(pub String);

/// A single durable event in a conversation. Replayable: the runtime
/// guarantees identical replay yields identical events. The
/// authority chain is stamped by the runtime per invocation; workers
/// don't forge it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub kind: String,
    pub payload: serde_json::Value,
}

pub struct ConversationClient {
    // TODO: transport handle to the daemon, conversation id, pack pin.
}

impl ConversationClient {
    pub fn id(&self) -> &ConversationId {
        todo!("Return the conversation id this client is bound to.");
    }

    pub async fn post(&self, _event: Event) -> crate::Result<()> {
        todo!("Send the event through the daemon's durable log.");
    }

    pub async fn events(&self) -> crate::Result<Vec<Event>> {
        todo!("Stream the conversation's prior events.");
    }
}
