use serde_json::Value;
use std::fs::OpenOptions;
use std::io::{self, Read, Write};
use std::thread;
use std::time::Duration;

const PIPE_NAME: &str = r"\\.\pipe\PromptDeckDesktop-v1";
const MAX_MESSAGE_BYTES: usize = 1024 * 1024;

fn read_frame<R: Read>(reader: &mut R) -> io::Result<Option<Vec<u8>>> {
    let mut header = [0_u8; 4];
    let mut read = 0;
    while read < header.len() {
        match reader.read(&mut header[read..]) {
            Ok(0) if read == 0 => return Ok(None),
            Ok(0) => {
                return Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "partial length header",
                ))
            }
            Ok(count) => read += count,
            Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
            Err(error) => return Err(error),
        }
    }
    let length = u32::from_le_bytes(header) as usize;
    if length == 0 || length > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid message length",
        ));
    }
    let mut body = vec![0_u8; length];
    reader.read_exact(&mut body)?;
    let value: Value = serde_json::from_slice(&body)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid JSON"))?;
    if !value.is_object() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "message must be an object",
        ));
    }
    Ok(Some(body))
}

fn write_frame<W: Write>(writer: &mut W, body: &[u8]) -> io::Result<()> {
    if body.is_empty() || body.len() > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "invalid message length",
        ));
    }
    writer.write_all(&(body.len() as u32).to_le_bytes())?;
    writer.write_all(body)?;
    writer.flush()
}

fn connect_pipe() -> io::Result<std::fs::File> {
    let mut last_error = None;
    for _ in 0..20 {
        match OpenOptions::new().read(true).write(true).open(PIPE_NAME) {
            Ok(file) => return Ok(file),
            Err(error) => {
                last_error = Some(error);
                thread::sleep(Duration::from_millis(250));
            }
        }
    }
    Err(last_error
        .unwrap_or_else(|| io::Error::new(io::ErrorKind::NotFound, "desktop pipe unavailable")))
}

fn run() -> io::Result<()> {
    let pipe = connect_pipe()?;
    let mut pipe_reader = pipe.try_clone()?;
    let mut pipe_writer = pipe;
    let outbound = thread::spawn(move || -> io::Result<()> {
        let stdout = io::stdout();
        let mut stdout = stdout.lock();
        while let Some(body) = read_frame(&mut pipe_reader)? {
            write_frame(&mut stdout, &body)?;
        }
        Ok(())
    });
    let stdin = io::stdin();
    let mut stdin = stdin.lock();
    while let Some(body) = read_frame(&mut stdin)? {
        write_frame(&mut pipe_writer, &body)?;
    }
    drop(pipe_writer);
    outbound
        .join()
        .map_err(|_| io::Error::other("bridge output thread panicked"))?
}

fn main() {
    if let Err(error) = run() {
        eprintln!("PromptDeck native host: {error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_framed_json() {
        let body = br#"{"type":"PING"}"#;
        let mut framed = Vec::new();
        write_frame(&mut framed, body).unwrap();
        assert_eq!(
            read_frame(&mut framed.as_slice()).unwrap(),
            Some(body.to_vec())
        );
    }

    #[test]
    fn rejects_oversized_message() {
        let mut framed = ((MAX_MESSAGE_BYTES + 1) as u32).to_le_bytes().to_vec();
        framed.extend_from_slice(b"{}");
        assert_eq!(
            read_frame(&mut framed.as_slice()).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    #[test]
    fn rejects_partial_header() {
        assert_eq!(
            read_frame(&mut [1_u8, 2].as_slice()).unwrap_err().kind(),
            io::ErrorKind::UnexpectedEof
        );
    }
}
