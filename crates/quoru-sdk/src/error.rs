use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("manifest parse error: {0}")]
    Parse(String),

    #[error("manifest validation error: {0}")]
    Validation(String),

    #[error("worker error: {0}")]
    Worker(String),

    #[error("conversation error: {0}")]
    Conversation(String),
}

pub type Result<T> = std::result::Result<T, Error>;
