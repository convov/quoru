//! Listener configuration. The wrong configuration is structurally
//! hard to express; "trust mode" is a property of the listener,
//! not a flag.
//!
//! See `docs/architecture.md` § Daemon model.

use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Listener {
    /// Admits self-asserted principals — filesystem permissions
    /// authenticate the OS user. Default control socket.
    UnixSocket { path: PathBuf },

    /// Requires explicit `auth`. Non-loopback bind requires
    /// `expose = "public"` so exposing the daemon to a network is
    /// always a deliberate act.
    Tcp {
        bind: IpAddr,
        port: u16,
        auth: AuthMode,
        #[serde(default)]
        expose: Option<Expose>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum AuthMode {
    BearerToken { secret_env: String },
    Mtls { ca: PathBuf },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Expose {
    Loopback,
    Public,
}

impl Listener {
    /// Reject configurations that violate the documented safety
    /// invariants. The daemon calls this at startup; an Err here
    /// means refusing to bind.
    pub fn validate(&self) -> crate::Result<()> {
        match self {
            Listener::UnixSocket { .. } => Ok(()),
            Listener::Tcp { bind, expose, .. } => {
                if !bind.is_loopback() && !matches!(expose, Some(Expose::Public)) {
                    return Err(crate::Error::Config(
                        "tcp listener on non-loopback address requires `expose = \"public\"`"
                            .into(),
                    ));
                }
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    fn bearer() -> AuthMode {
        AuthMode::BearerToken {
            secret_env: "QUORU_TOKEN".into(),
        }
    }

    #[test]
    fn unix_socket_validates() {
        let l = Listener::UnixSocket {
            path: PathBuf::from("/tmp/quoru.sock"),
        };
        assert!(l.validate().is_ok());
    }

    #[test]
    fn tcp_loopback_validates_without_expose() {
        let l = Listener::Tcp {
            bind: IpAddr::V4(Ipv4Addr::LOCALHOST),
            port: 7000,
            auth: bearer(),
            expose: None,
        };
        assert!(l.validate().is_ok());
    }

    #[test]
    fn tcp_public_bind_requires_expose() {
        let l = Listener::Tcp {
            bind: IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)),
            port: 7000,
            auth: bearer(),
            expose: None,
        };
        assert!(l.validate().is_err());
    }

    #[test]
    fn tcp_public_bind_with_expose_validates() {
        let l = Listener::Tcp {
            bind: IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)),
            port: 7000,
            auth: bearer(),
            expose: Some(Expose::Public),
        };
        assert!(l.validate().is_ok());
    }
}
