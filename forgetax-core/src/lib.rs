//! Pure-logic core of the ForgeTax MOBILE (Soucean 3.17.0) clean-room
//! remake — the Windows 2D version.
//!
//! This crate contains ONLY the game rules — no graphics, no audio, no
//! file I/O, no network. The Tauri 2 shell (`~/workspace/forgetax-mobile/
//! remake/`) drives these modules and owns rendering, input and sound.
//!
//! Balance numbers come from the MOBILE balance data
//! (`~/workspace/forgetax-mobile/unity/textassets/Economy.txt`, 3.17.0)
//! and the decompiled functions in REA-REPORT §11–§15; see `data.rs`
//! (generated) and the per-module docs for provenance. Anything the RE
//! could NOT recover is marked `TODO-RE` in the code — never silently
//! invented.
//!
//! Clean-room rules (see KE-HOACH-P0-P1-P2.md):
//! - new code, new Vietnamese wording; never copy the original game's
//!   text or assets verbatim;
//! - never call the original developer's telemetry endpoints;
//! - this crate uses its own save-key namespace (see `config`).

pub mod break_curve;
pub mod config;
pub mod contract;
pub mod data;
pub mod frenzy;
pub mod relics;
pub mod run;
pub mod sword;
pub mod tickets;
