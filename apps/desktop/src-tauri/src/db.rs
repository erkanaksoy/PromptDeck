use anyhow::{Context, Result};
use parking_lot::Mutex;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub const SCHEMA_VERSION: i64 = 1;

pub struct Database {
    connection: Mutex<Connection>,
    path: PathBuf,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).context("create application data directory")?;
        }
        let connection = Connection::open(path).context("open PromptDeck database")?;
        connection.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;
             CREATE TABLE IF NOT EXISTS schema_migrations (
               version INTEGER PRIMARY KEY,
               applied_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS conversations (
               conversation_key TEXT PRIMARY KEY,
               platform TEXT NOT NULL,
               canonical_url TEXT NOT NULL,
               payload_json TEXT NOT NULL,
               last_activity_at INTEGER NOT NULL,
               closed_at INTEGER
             );
             CREATE TABLE IF NOT EXISTS settings (
               setting_key TEXT PRIMARY KEY,
               value_json TEXT NOT NULL,
               updated_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS processed_messages (
               message_id TEXT PRIMARY KEY,
               processed_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS delivered_notifications (
               event_id TEXT PRIMARY KEY,
               delivered_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS connection_history (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               state TEXT NOT NULL,
               occurred_at INTEGER NOT NULL,
               detail TEXT
             );",
        )?;
        connection.execute(
            "INSERT OR IGNORE INTO schema_migrations(version, applied_at)
             VALUES (?1, unixepoch() * 1000)",
            [SCHEMA_VERSION],
        )?;
        Ok(Self {
            connection: Mutex::new(connection),
            path: path.to_path_buf(),
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn apply_message(&self, message: &Value) -> Result<bool> {
        let message_id = message
            .get("messageId")
            .and_then(Value::as_str)
            .context("messageId missing")?;
        let message_type = message
            .get("type")
            .and_then(Value::as_str)
            .context("message type missing")?;
        let mut connection = self.connection.lock();
        let transaction = connection.transaction()?;
        let inserted = transaction.execute(
            "INSERT OR IGNORE INTO processed_messages(message_id, processed_at)
             VALUES (?1, unixepoch() * 1000)",
            [message_id],
        )?;
        if inserted == 0 {
            return Ok(false);
        }
        match message_type {
            "FULL_STATE_SNAPSHOT" => {
                let conversations = message
                    .pointer("/payload/conversations")
                    .and_then(Value::as_array)
                    .context("snapshot conversations missing")?;
                transaction.execute("DELETE FROM conversations", [])?;
                for item in conversations {
                    Self::upsert_conversation(&transaction, item)?;
                }
                if let Some(settings) = message.pointer("/payload/settings") {
                    transaction.execute(
                        "INSERT INTO settings(setting_key, value_json, updated_at)
                         VALUES ('shared_settings', ?1, unixepoch() * 1000)
                         ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
                        [settings.to_string()],
                    )?;
                }
            }
            "CONVERSATION_UPSERT" => {
                let conversation = message
                    .pointer("/payload/conversation")
                    .context("upsert conversation missing")?;
                Self::upsert_conversation(&transaction, conversation)?;
            }
            "CONVERSATION_REMOVE" => {
                if let Some(key) = message
                    .pointer("/payload/conversationKey")
                    .and_then(Value::as_str)
                {
                    transaction
                        .execute("DELETE FROM conversations WHERE conversation_key=?1", [key])?;
                }
            }
            _ => {}
        }
        transaction.execute(
            "DELETE FROM processed_messages WHERE processed_at <
             (unixepoch() - 604800) * 1000",
            [],
        )?;
        transaction.commit()?;
        Ok(true)
    }

    fn upsert_conversation(connection: &Connection, item: &Value) -> Result<()> {
        let key = item
            .get("key")
            .and_then(Value::as_str)
            .context("conversation key missing")?;
        let platform = item
            .get("platform")
            .and_then(Value::as_str)
            .context("platform missing")?;
        let url = item
            .get("canonicalUrl")
            .and_then(Value::as_str)
            .context("canonical URL missing")?;
        let last_activity = item
            .get("lastActivityAt")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        let closed_at = item.get("closedAt").and_then(Value::as_i64);
        connection.execute(
            "INSERT INTO conversations(conversation_key, platform, canonical_url, payload_json, last_activity_at, closed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(conversation_key) DO UPDATE SET
               platform=excluded.platform, canonical_url=excluded.canonical_url,
               payload_json=excluded.payload_json, last_activity_at=excluded.last_activity_at,
               closed_at=excluded.closed_at",
            params![key, platform, url, item.to_string(), last_activity, closed_at],
        )?;
        Ok(())
    }

    pub fn conversations(&self) -> Result<Vec<Value>> {
        let connection = self.connection.lock();
        let mut statement = connection
            .prepare("SELECT payload_json FROM conversations ORDER BY last_activity_at DESC")?;
        let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
        rows.map(|row| {
            let raw = row?;
            serde_json::from_str(&raw).context("parse cached conversation")
        })
        .collect()
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<Value>> {
        let connection = self.connection.lock();
        let raw = connection
            .query_row(
                "SELECT value_json FROM settings WHERE setting_key=?1",
                [key],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        raw.map(|value| serde_json::from_str(&value).context("parse setting"))
            .transpose()
    }

    pub fn set_setting(&self, key: &str, value: &Value) -> Result<()> {
        self.connection.lock().execute(
            "INSERT INTO settings(setting_key, value_json, updated_at)
             VALUES (?1, ?2, unixepoch() * 1000)
             ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
            params![key, value.to_string()],
        )?;
        Ok(())
    }

    pub fn record_connection(&self, state: &str, detail: Option<&str>) -> Result<()> {
        self.connection.lock().execute(
            "INSERT INTO connection_history(state, occurred_at, detail)
             VALUES (?1, unixepoch() * 1000, ?2)",
            params![state, detail.map(|value| &value[..value.len().min(300)])],
        )?;
        Ok(())
    }

    pub fn claim_notification(&self, event_id: &str) -> Result<bool> {
        let inserted = self.connection.lock().execute(
            "INSERT OR IGNORE INTO delivered_notifications(event_id, delivered_at)
             VALUES (?1, unixepoch() * 1000)",
            [event_id],
        )?;
        Ok(inserted == 1)
    }

    pub fn desktop_notifications_enabled(&self, category: &str) -> bool {
        let settings = self
            .get_setting("shared_settings")
            .ok()
            .flatten()
            .unwrap_or(Value::Null);
        let source = settings
            .get("notificationSource")
            .and_then(Value::as_str)
            .unwrap_or("automatic");
        if !matches!(source, "automatic" | "desktop" | "both") {
            return false;
        }
        let key = match category {
            "finished_unread" => "notifyFinished",
            "waiting" => "notifyWaiting",
            "error" => "notifyError",
            _ => return false,
        };
        settings.get(key).and_then(Value::as_bool).unwrap_or(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn creates_schema_and_persists_a_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let database = Database::open(&directory.path().join("promptdeck.db")).unwrap();
        let message = json!({
            "messageId": "snapshot-1",
            "type": "FULL_STATE_SNAPSHOT",
            "payload": {
                "settings": { "notificationSource": "automatic" },
                "conversations": [{
                    "key": "chatgpt:one",
                    "platform": "chatgpt",
                    "canonicalUrl": "https://chatgpt.com/c/one",
                    "lastActivityAt": 100
                }]
            }
        });
        assert!(database.apply_message(&message).unwrap());
        assert!(!database.apply_message(&message).unwrap());
        assert_eq!(database.conversations().unwrap().len(), 1);
        let version: i64 = database
            .connection
            .lock()
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[test]
    fn replaces_conversations_with_each_authoritative_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let database = Database::open(&directory.path().join("promptdeck.db")).unwrap();
        let snapshot = |message_id: &str, key: &str| {
            json!({
                "messageId": message_id,
                "type": "FULL_STATE_SNAPSHOT",
                "payload": {
                    "settings": {},
                    "conversations": [{
                        "key": key,
                        "platform": "claude",
                        "canonicalUrl": format!("https://claude.ai/chat/{key}"),
                        "lastActivityAt": 100
                    }]
                }
            })
        };
        database
            .apply_message(&snapshot("snapshot-one", "one"))
            .unwrap();
        database
            .apply_message(&snapshot("snapshot-two", "two"))
            .unwrap();
        let conversations = database.conversations().unwrap();
        assert_eq!(conversations.len(), 1);
        assert_eq!(conversations[0]["key"], "two");
    }

    #[test]
    fn deduplicates_notification_events() {
        let directory = tempfile::tempdir().unwrap();
        let database = Database::open(&directory.path().join("promptdeck.db")).unwrap();
        assert!(database.claim_notification("event-1").unwrap());
        assert!(!database.claim_notification("event-1").unwrap());
    }
}
