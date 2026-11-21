//! ForgeTax Mobile (Soucean 3.17.0) clean-room remake — Tauri 2 backend.
//!
//! The backend owns the game state (one `forgetax_core::run::Run`) and
//! exposes it to the 2D HTML/CSS/JS frontend through Tauri commands. It
//! also persists the settings to disk (app data dir).
//!
//! No black screen by construction: there is no 3D/wgpu anywhere in this
//! app. If the frontend fails to load, the window shows the Tauri error
//! page (plain text), never a black window.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use forgetax_core::contract::Settle;
use forgetax_core::frenzy::FeverEnd;
use forgetax_core::run::{Run, RunState, StrikeResult, TributeResult};
use forgetax_core::tickets::Outcome;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

// ---------------------------------------------------------------------------
// Settings (persisted to disk as JSON in the app data dir).
//
// The rows match the ORIGINAL game's own settings screen, verified from
// its vi.txt (see frontend/i18n.js for the exact keys):
//   master, music, sfx, haptics, brightness, quality, fps, floor_swords,
//   controls, lock_on, language.
// No pause-menu items exist in the original (no pause.* keys), so none
// are offered here either.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Master volume 0–100.
    pub master: f64,
    /// Music / ambient volume 0–100.
    pub music: f64,
    /// Sound-effect volume 0–100.
    pub sfx: f64,
    /// Haptics. The original has the row; a PC has no vibration motor,
    /// so the frontend shows it DISABLED. Stored as false.
    pub haptics: bool,
    /// UI brightness 0–100 (controls a brightness overlay).
    pub brightness: f64,
    /// Graphics quality: "auto" | "low" | "medium" | "high".
    /// On this 2D UI it controls particle/animation density (an
    /// adaptation — the original's 3D quality setting has no 2D twin).
    pub quality: String,
    /// Show the real FPS counter.
    pub show_fps: bool,
    /// Max swords shown on the floor (0–8).
    pub floor_swords: u32,
    /// Controls: "free" (drag the view) | "hub" (fixed view).
    pub controls: String,
    /// Lock the camera on the anvil.
    pub lock_on: bool,
    /// UI language: "vi" | "en". Applies immediately, remembered.
    pub language: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            master: 80.0,
            music: 60.0,
            sfx: 90.0,
            haptics: false,
            brightness: 100.0,
            quality: "auto".to_string(),
            show_fps: false,
            floor_swords: 3,
            controls: "hub".to_string(),
            lock_on: false,
            language: "vi".to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// State snapshots sent to the frontend.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct SwordSnapshot {
    pub id: u16,
    pub grade: u32,
    pub value: f64,
    pub peak_value: f64,
    pub broken: bool,
    pub damage_count: u32,
    pub great_forged: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct FeverSnapshot {
    pub charge: u32,
    pub needed: u32,
    pub active: bool,
    pub time_left: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StateSnapshot {
    pub state: String,
    pub round: u32,
    pub quota: f64,
    pub round_tribute: f64,
    pub round_tributed: u32,
    pub total_tribute: f64,
    pub anger: u8,
    pub endless: bool,
    pub sword: Option<SwordSnapshot>,
    pub swords_left: usize,
    pub chances: [u32; 5],
    pub fever: FeverSnapshot,
    pub relics: Vec<String>,
    pub strikes: u64,
    pub swords_broken: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct StrikePayload {
    pub outcome: String,
    pub grade_before: u32,
    pub grade_after: u32,
    pub value_before: f64,
    pub value_after: f64,
    pub scrap: f64,
    pub fever_started: bool,
    pub fever_active: bool,
    pub fever_charge: u32,
    pub chances: [u32; 5],
    pub swords_left: usize,
    pub state: StateSnapshot,
}

#[derive(Debug, Clone, Serialize)]
pub struct TributePayload {
    pub value: f64,
    pub round_tribute: f64,
    pub quota: f64,
    pub settle: Option<String>,
    pub swords_left: usize,
    pub state: StateSnapshot,
}

#[derive(Debug, Clone, Serialize)]
pub struct FeverEndPayload {
    pub ended: String,
    pub grade_gain: u32,
    pub state: StateSnapshot,
}

fn outcome_name(outcome: Outcome) -> &'static str {
    match outcome {
        Outcome::Break => "break",
        Outcome::Damage => "damage",
        Outcome::Hold => "hold",
        Outcome::Success => "success",
        Outcome::Great => "great",
    }
}

fn settle_name(settle: Settle) -> &'static str {
    match settle {
        Settle::Cleared => "cleared",
        Settle::Anger(_) => "anger",
        Settle::Defeated => "defeated",
    }
}

fn snapshot(run: &Run) -> StateSnapshot {
    let sword = run.current_sword().map(|s| SwordSnapshot {
        id: s.id,
        grade: s.grade,
        value: s.value,
        peak_value: s.peak_value,
        broken: s.broken,
        damage_count: s.damage_count,
        great_forged: s.great_forged,
    });
    StateSnapshot {
        state: match run.state {
            RunState::Playing => "playing".to_string(),
            RunState::Victory => "victory".to_string(),
            RunState::Defeated => "defeated".to_string(),
        },
        round: run.contract.round,
        quota: run.contract.current_quota(),
        round_tribute: run.round_tribute,
        round_tributed: run.round_tributed,
        total_tribute: run.total_tribute,
        anger: run.contract.anger,
        endless: run.contract.is_endless(),
        sword,
        swords_left: run.swords_left(),
        chances: run.chances(),
        fever: FeverSnapshot {
            charge: run.fever.charge(),
            needed: run.fever.charge_needed(),
            active: run.fever.is_active(),
            time_left: run.fever.time_left(),
        },
        relics: run
            .loadout
            .relics()
            .iter()
            .map(|r| r.id.to_string())
            .collect(),
        strikes: run.strikes,
        swords_broken: run.swords_broken,
    }
}

// ---------------------------------------------------------------------------
// App state.
// ---------------------------------------------------------------------------

pub struct AppState {
    run: Mutex<Option<Run>>,
    settings_path: PathBuf,
}

fn default_run_seed() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x5EED5EED)
}

// ---------------------------------------------------------------------------
// Commands.
// ---------------------------------------------------------------------------

#[tauri::command]
fn new_run(state: State<AppState>, seed: Option<u64>) -> StateSnapshot {
    let mut guard = state.run.lock().unwrap();
    let run = Run::new(seed.unwrap_or_else(default_run_seed));
    let snap = snapshot(&run);
    *guard = Some(run);
    snap
}

#[tauri::command]
fn get_state(state: State<AppState>) -> Option<StateSnapshot> {
    state.run.lock().unwrap().as_ref().map(snapshot)
}

#[tauri::command]
fn strike(state: State<AppState>) -> Option<StrikePayload> {
    let mut guard = state.run.lock().unwrap();
    let run = guard.as_mut()?;
    let result: StrikeResult = run.strike()?;
    let snap = snapshot(run);
    Some(StrikePayload {
        outcome: outcome_name(result.outcome).to_string(),
        grade_before: result.grade_before,
        grade_after: result.grade_after,
        value_before: result.value_before,
        value_after: result.value_after,
        scrap: result.scrap,
        fever_started: result.fever_started,
        fever_active: result.fever_active,
        fever_charge: result.fever_charge,
        chances: result.chances,
        swords_left: result.swords_left,
        state: snap,
    })
}

#[tauri::command]
fn tribute_sword(state: State<AppState>) -> Option<TributePayload> {
    let mut guard = state.run.lock().unwrap();
    let run = guard.as_mut()?;
    let result: TributeResult = run.tribute_sword()?;
    let snap = snapshot(run);
    Some(TributePayload {
        value: result.value,
        round_tribute: result.round_tribute,
        quota: result.quota,
        settle: result.settle.map(settle_name).map(str::to_string),
        swords_left: result.swords_left,
        state: snap,
    })
}

#[tauri::command]
fn end_day(state: State<AppState>) -> Option<StateSnapshot> {
    let mut guard = state.run.lock().unwrap();
    let run = guard.as_mut()?;
    run.end_day()?;
    Some(snapshot(run))
}

#[tauri::command]
fn tick(state: State<AppState>, dt: f64) -> Option<FeverEndPayload> {
    let mut guard = state.run.lock().unwrap();
    let run = guard.as_mut()?;
    let end = run.tick(dt)?;
    let (ended, grade_gain) = match end {
        FeverEnd::NoPayout => ("nopayout".to_string(), 0),
        FeverEnd::PaidOut { grade_gain } => ("paidout".to_string(), grade_gain),
    };
    Some(FeverEndPayload {
        ended,
        grade_gain,
        state: snapshot(run),
    })
}

#[tauri::command]
fn continue_endless(state: State<AppState>) -> Option<StateSnapshot> {
    let mut guard = state.run.lock().unwrap();
    let run = guard.as_mut()?;
    run.continue_endless();
    Some(snapshot(run))
}

#[tauri::command]
fn load_settings(state: State<AppState>) -> Settings {
    match std::fs::read_to_string(&state.settings_path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => Settings::default(),
    }
}

#[tauri::command]
fn save_settings(state: State<AppState>, settings: Settings) -> Result<(), String> {
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    if let Some(parent) = state.settings_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&state.settings_path, text).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let settings_path = dir.join("settings.json");
            app.manage(AppState {
                run: Mutex::new(None),
                settings_path,
            });
            // Show the window once the frontend is ready (no black flash).
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            new_run,
            get_state,
            strike,
            tribute_sword,
            end_day,
            tick,
            continue_endless,
            load_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForgeTax Mobile");
}
