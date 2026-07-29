use crate::db::Database;
use crate::protocol::{read_frame, validate_message, write_frame};
use parking_lot::Mutex;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::mpsc;

pub const PIPE_NAME: &str = r"\\.\pipe\PromptDeckDesktop-v1";

#[derive(Default)]
pub struct BridgeChannel {
    sender: Mutex<Option<mpsc::UnboundedSender<Vec<u8>>>>,
}

impl BridgeChannel {
    pub fn is_connected(&self) -> bool {
        self.sender.lock().is_some()
    }

    pub fn send(&self, message: Vec<u8>) -> Result<(), String> {
        self.sender
            .lock()
            .as_ref()
            .ok_or_else(|| "Chrome extension is not connected".to_string())?
            .send(message)
            .map_err(|_| "Native bridge disconnected".to_string())
    }
}

#[cfg(windows)]
pub async fn run(app: AppHandle, database: Arc<Database>, channel: Arc<BridgeChannel>) {
    use tokio::net::windows::named_pipe::ServerOptions;
    loop {
        let server = match ServerOptions::new().create(PIPE_NAME) {
            Ok(server) => server,
            Err(error) => {
                log::error!("native bridge create failed: {error}");
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                continue;
            }
        };
        if let Err(error) = server.connect().await {
            log::warn!("native bridge connect failed: {error}");
            continue;
        }
        let _ = database.record_connection("connected", None);
        let (mut reader, mut writer) = tokio::io::split(server);
        let (sender, mut receiver) = mpsc::unbounded_channel::<Vec<u8>>();
        *channel.sender.lock() = Some(sender);
        loop {
            tokio::select! {
                received = read_frame(&mut reader) => {
                    match received {
                        Ok(Some(body)) => {
                            match serde_json::from_slice::<Value>(&body) {
                                Ok(value) => {
                                    if let Err(error) = validate_message(&value) {
                                        log::warn!("invalid native message: {error}");
                                        continue;
                                    }
                                    match database.apply_message(&value) {
                                        Ok(true) => {
                                            maybe_notify(&app, &database, &value);
                                            let _ = app.emit("protocol-message", value);
                                        }
                                        Ok(false) => {}
                                        Err(error) => log::warn!("protocol persistence rejected: {error}"),
                                    }
                                }
                                Err(error) => log::warn!("invalid native JSON: {error}"),
                            }
                        }
                        Ok(None) => break,
                        Err(error) => { log::warn!("native bridge read failed: {error}"); break; }
                    }
                }
                outbound = receiver.recv() => {
                    match outbound {
                        Some(body) => if let Err(error) = write_frame(&mut writer, &body).await {
                            log::warn!("native bridge write failed: {error}");
                            break;
                        },
                        None => break,
                    }
                }
            }
        }
        *channel.sender.lock() = None;
        let _ = database.record_connection("extension_not_connected", None);
        let _ = app.emit("bridge-disconnected", ());
    }
}

fn maybe_notify(app: &AppHandle, database: &Database, message: &Value) {
    if message.get("type").and_then(Value::as_str) != Some("CONVERSATION_UPSERT") {
        return;
    }
    let Some(conversation) = message.pointer("/payload/conversation") else {
        return;
    };
    let Some(status) = conversation.get("automaticStatus").and_then(Value::as_str) else {
        return;
    };
    if !database.desktop_notifications_enabled(status) {
        return;
    }
    let key = conversation
        .get("key")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let activity = conversation
        .get("lastActivityAt")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let event_id = format!("{key}:{status}:{activity}");
    if !database.claim_notification(&event_id).unwrap_or(false) {
        return;
    }
    let title = conversation
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("Conversation");
    let category = match status {
        "error" => "Conversation error",
        "waiting" => "Waiting for your input",
        "finished_unread" => "Response finished",
        _ => return,
    };
    let _ = app
        .notification()
        .builder()
        .title("PromptDeck")
        .body(format!("{title}\n{category}"))
        .show();
}

#[cfg(not(windows))]
pub async fn run(_app: AppHandle, _database: Arc<Database>, _channel: Arc<BridgeChannel>) {}
