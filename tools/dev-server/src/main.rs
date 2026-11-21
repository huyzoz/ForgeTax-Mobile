//! Dev/test harness ONLY — not part of the shipped app.
//!
//! Serves the P0 frontend (`app/frontend/`) over HTTP and answers
//! `POST /api/<cmd>` with the REAL forgetax-core, so the UI can be
//! exercised in a plain headless browser without Tauri/WebView2.
//!
//! Usage: `cargo run -p forgetax-dev-server -- [port] [frontend-dir]`
//! Defaults: port 1420, frontend dir `../../app/frontend`.
//!
//! The command set mirrors `app/src-tauri/src/main.rs` exactly
//! (new_run, get_state, strike, tribute_sword, end_day, tick,
//! continue_endless, load_settings, save_settings). Settings persist to
//! `settings.dev.json` next to this binary's working directory.

use forgetax_core::contract::Settle;
use forgetax_core::frenzy::FeverEnd;
use forgetax_core::run::{Run, RunState};
use forgetax_core::tickets::Outcome;
use serde::Serialize;
use serde_json::Value;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;

#[derive(Serialize)]
struct SwordSnap {
    id: u16,
    grade: u32,
    value: f64,
    peak_value: f64,
    broken: bool,
    damage_count: u32,
    great_forged: bool,
}

#[derive(Serialize)]
struct StateSnap {
    state: String,
    round: u32,
    quota: f64,
    round_tribute: f64,
    round_tributed: u32,
    total_tribute: f64,
    anger: u8,
    endless: bool,
    sword: Option<SwordSnap>,
    swords_left: usize,
    chances: [u32; 5],
    fever: FeverSnap,
    relics: Vec<String>,
    strikes: u64,
    swords_broken: u32,
}

#[derive(Serialize)]
struct FeverSnap {
    charge: u32,
    needed: u32,
    active: bool,
    time_left: f64,
}

fn snapshot(run: &Run) -> StateSnap {
    StateSnap {
        state: match run.state {
            RunState::Playing => "playing".into(),
            RunState::Victory => "victory".into(),
            RunState::Defeated => "defeated".into(),
        },
        round: run.contract.round,
        quota: run.contract.current_quota(),
        round_tribute: run.round_tribute,
        round_tributed: run.round_tributed,
        total_tribute: run.total_tribute,
        anger: run.contract.anger,
        endless: run.contract.is_endless(),
        sword: run.current_sword().map(|s| SwordSnap {
            id: s.id,
            grade: s.grade,
            value: s.value,
            peak_value: s.peak_value,
            broken: s.broken,
            damage_count: s.damage_count,
            great_forged: s.great_forged,
        }),
        swords_left: run.swords_left(),
        chances: run.chances(),
        fever: FeverSnap {
            charge: run.fever.charge(),
            needed: run.fever.charge_needed(),
            active: run.fever.is_active(),
            time_left: run.fever.time_left(),
        },
        relics: run.loadout.relics().iter().map(|r| r.id.to_string()).collect(),
        strikes: run.strikes,
        swords_broken: run.swords_broken,
    }
}

fn outcome_name(o: Outcome) -> &'static str {
    match o {
        Outcome::Break => "break",
        Outcome::Damage => "damage",
        Outcome::Hold => "hold",
        Outcome::Success => "success",
        Outcome::Great => "great",
    }
}

fn settle_name(s: Settle) -> &'static str {
    match s {
        Settle::Cleared => "cleared",
        Settle::Anger(_) => "anger",
        Settle::Defeated => "defeated",
    }
}

struct App {
    run: Mutex<Option<Run>>,
    settings_path: String,
}

impl App {
    fn dispatch(&self, cmd: &str, args: &Value) -> Value {
        match cmd {
            "new_run" => {
                let seed = args
                    .get("seed")
                    .and_then(|v| v.as_u64())
                    .unwrap_or_else(|| {
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_nanos() as u64)
                            .unwrap_or(0x5EED5EED)
                    });
                let mut guard = self.run.lock().unwrap();
                let run = Run::new(seed);
                let snap = snapshot(&run);
                *guard = Some(run);
                serde_json::to_value(snap).unwrap()
            }
            "get_state" => {
                let guard = self.run.lock().unwrap();
                match guard.as_ref() {
                    Some(run) => serde_json::to_value(snapshot(run)).unwrap(),
                    None => Value::Null,
                }
            }
            "strike" => {
                let mut guard = self.run.lock().unwrap();
                let Some(run) = guard.as_mut() else { return Value::Null };
                let Some(r) = run.strike() else { return Value::Null };
                let snap = snapshot(run);
                serde_json::json!({
                    "outcome": outcome_name(r.outcome),
                    "grade_before": r.grade_before,
                    "grade_after": r.grade_after,
                    "value_before": r.value_before,
                    "value_after": r.value_after,
                    "scrap": r.scrap,
                    "fever_started": r.fever_started,
                    "fever_active": r.fever_active,
                    "fever_charge": r.fever_charge,
                    "chances": r.chances,
                    "swords_left": r.swords_left,
                    "state": snap,
                })
            }
            "tribute_sword" => {
                let mut guard = self.run.lock().unwrap();
                let Some(run) = guard.as_mut() else { return Value::Null };
                let Some(r) = run.tribute_sword() else { return Value::Null };
                let snap = snapshot(run);
                serde_json::json!({
                    "value": r.value,
                    "round_tribute": r.round_tribute,
                    "quota": r.quota,
                    "settle": r.settle.map(settle_name),
                    "swords_left": r.swords_left,
                    "state": snap,
                })
            }
            "end_day" => {
                let mut guard = self.run.lock().unwrap();
                let Some(run) = guard.as_mut() else { return Value::Null };
                match run.end_day() {
                    Some(_) => serde_json::to_value(snapshot(run)).unwrap(),
                    None => Value::Null,
                }
            }
            "tick" => {
                let dt = args.get("dt").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let mut guard = self.run.lock().unwrap();
                let Some(run) = guard.as_mut() else { return Value::Null };
                let Some(end) = run.tick(dt) else { return Value::Null };
                let (ended, grade_gain) = match end {
                    FeverEnd::NoPayout => ("nopayout", 0),
                    FeverEnd::PaidOut { grade_gain } => ("paidout", grade_gain),
                };
                serde_json::json!({ "ended": ended, "grade_gain": grade_gain, "state": snapshot(run) })
            }
            "continue_endless" => {
                let mut guard = self.run.lock().unwrap();
                let Some(run) = guard.as_mut() else { return Value::Null };
                run.continue_endless();
                serde_json::to_value(snapshot(run)).unwrap()
            }
            "load_settings" => match std::fs::read_to_string(&self.settings_path) {
                Ok(text) => serde_json::from_str(&text).unwrap_or(default_settings()),
                Err(_) => default_settings(),
            },
            "save_settings" => {
                let settings = args.get("settings").cloned().unwrap_or_default();
                match std::fs::write(&self.settings_path, serde_json::to_string_pretty(&settings).unwrap_or_default()) {
                    Ok(()) => serde_json::json!({ "ok": true }),
                    Err(e) => serde_json::json!({ "error": e.to_string() }),
                }
            }
            _ => serde_json::json!({ "error": format!("unknown command: {cmd}") }),
        }
    }
}

fn default_settings() -> Value {
    serde_json::json!({
        "master": 80, "music": 60, "sfx": 90, "haptics": false,
        "brightness": 100, "quality": "auto", "show_fps": false,
        "floor_swords": 3, "controls": "hub", "lock_on": false,
        "language": "vi"
    })
}

fn content_type(path: &str) -> &'static str {
    if path.ends_with(".html") {
        "text/html; charset=utf-8"
    } else if path.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if path.ends_with(".js") {
        "text/javascript; charset=utf-8"
    } else if path.ends_with(".json") {
        "application/json"
    } else if path.ends_with(".png") {
        "image/png"
    } else {
        "application/octet-stream"
    }
}

fn handle(mut stream: TcpStream, app: &App, frontend_dir: &str) {
    let mut buf = vec![0u8; 65536];
    let Ok(n) = stream.read(&mut buf) else { return };
    if n == 0 {
        return;
    }
    let req = String::from_utf8_lossy(&buf[..n]);
    let mut lines = req.lines();
    let Some(head) = lines.next() else { return };
    let mut parts = head.split_whitespace();
    let method = parts.next().unwrap_or("");
    let raw_path = parts.next().unwrap_or("/");
    let path = raw_path.split('?').next().unwrap_or("/");
    // Read body (Content-Length).
    let mut content_length = 0usize;
    for line in req.lines().skip(1) {
        if line.is_empty() {
            break;
        }
        if let Some(v) = line.to_ascii_lowercase().strip_prefix("content-length:") {
            content_length = v.trim().parse().unwrap_or(0);
        }
    }
    let body_start = req.find("\r\n\r\n").map(|i| i + 4).unwrap_or(req.len());
    let mut body = req[body_start..].as_bytes().to_vec();
    while body.len() < content_length {
        let mut chunk = vec![0u8; 8192];
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(m) => body.extend_from_slice(&chunk[..m]),
        }
    }

    let (status, ctype, payload): (u16, &str, Vec<u8>) = if method == "POST" && path.starts_with("/api/") {
        let cmd = &path["/api/".len()..];
        let args: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
        let out = app.dispatch(cmd, &args);
        (200, "application/json", serde_json::to_vec(&out).unwrap())
    } else if method == "GET" {
        let rel = if path == "/" { "index.html" } else { &path[1..] };
        let rel = rel.replace("..", "");
        let full = format!("{frontend_dir}/{rel}");
        match std::fs::read(&full) {
            Ok(bytes) => (200, content_type(&full), bytes),
            Err(_) => (404, "text/plain", b"not found".to_vec()),
        }
    } else {
        (405, "text/plain", b"method not allowed".to_vec())
    };
    let header = format!(
        "HTTP/1.1 {status} OK\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        payload.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(&payload);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let port: u16 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(1420);
    let frontend_dir = args
        .get(2)
        .cloned()
        .unwrap_or_else(|| "../../app/frontend".to_string());
    let app = App {
        run: Mutex::new(None),
        settings_path: "settings.dev.json".to_string(),
    };
    let listener = TcpListener::bind(("127.0.0.1", port)).expect("bind dev server");
    eprintln!("forgetax-dev-server on http://127.0.0.1:{port}/ (frontend: {frontend_dir})");
    for stream in listener.incoming() {
        match stream {
            Ok(s) => handle(s, &app, &frontend_dir),
            Err(e) => eprintln!("accept error: {e}"),
        }
    }
}
