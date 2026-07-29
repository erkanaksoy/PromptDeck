use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::io;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

pub const PROTOCOL_VERSION: i64 = 1;
pub const MAX_MESSAGE_BYTES: usize = 1024 * 1024;

pub fn validate_message(value: &Value) -> Result<()> {
    let object = value.as_object().context("message must be an object")?;
    if object.get("protocolVersion").and_then(Value::as_i64) != Some(PROTOCOL_VERSION) {
        bail!("protocol version mismatch");
    }
    let message_id = object
        .get("messageId")
        .and_then(Value::as_str)
        .context("messageId missing")?;
    if message_id.is_empty() || message_id.len() > 128 {
        bail!("invalid messageId");
    }
    let source = object
        .get("source")
        .and_then(Value::as_str)
        .context("source missing")?;
    if !matches!(source, "extension" | "desktop" | "native-host") {
        bail!("invalid source");
    }
    let message_type = object
        .get("type")
        .and_then(Value::as_str)
        .context("type missing")?;
    if message_type.len() > 64
        || !message_type
            .bytes()
            .all(|byte| byte.is_ascii_uppercase() || byte == b'_')
    {
        bail!("invalid message type");
    }
    if !object.get("payload").is_some_and(Value::is_object) {
        bail!("payload must be an object");
    }
    Ok(())
}

pub async fn read_frame<R: AsyncRead + Unpin>(reader: &mut R) -> io::Result<Option<Vec<u8>>> {
    let mut header = [0_u8; 4];
    match reader.read_exact(&mut header).await {
        Ok(_) => {}
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(error) => return Err(error),
    }
    let length = u32::from_le_bytes(header) as usize;
    if length == 0 || length > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid native message length",
        ));
    }
    let mut body = vec![0_u8; length];
    reader.read_exact(&mut body).await?;
    Ok(Some(body))
}

pub async fn write_frame<W: AsyncWrite + Unpin>(writer: &mut W, body: &[u8]) -> io::Result<()> {
    if body.is_empty() || body.len() > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "invalid native message length",
        ));
    }
    writer.write_all(&(body.len() as u32).to_le_bytes()).await?;
    writer.write_all(body).await?;
    writer.flush().await
}
