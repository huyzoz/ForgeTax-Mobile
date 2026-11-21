//! Fever (Frenzy) — the no-break window (MOBILE 3.17.0).
//!
//! Forging the SAME sword [`CHARGE_PER_SWORD`] times (10 strikes) fully
//! charges Fever. While active ([`FEVER_SECONDS`] = 4 seconds) the BREAK
//! outcome is removed from the ticket deck, so strikes cannot shatter the
//! sword.
//!
//! Functions decoded in REA-REPORT §12.8 (`ForgeTax.Combat`):
//!
//! * `StartFever` (RVA 0x263DCC4): gate charge ≥ 10 → reset charge to 0,
//!   set duration = `FEVER_SECONDS`, bonus = `2 × Rank(everwick) + 4 +
//!   Rank(redglass)` → effects+0x128, max = bonus + duration →
//!   effects+0xd4.
//! * `ExtendFever` (RVA 0x263E004): on a Great during Fever, +1 charge
//!   (`state+0xdc += 1`, clamped to `state+0xd4`).
//! * `FinishFever` (RVA 0x263E048): 3 gates — (1) fever max must satisfy
//!   `0 < max ≤ duration`, else no payout; (2) sword broken → no payout;
//!   (3) `Rank(headless) < 1` → no payout. Payout: +2 grade via the
//!   delegate (headless effect, §15.3), value refresh, peak update.
//!
//! Notes:
//! - Charge is per sword: switching to a different sword resets it (the
//!   caller must call [`Fever::reset`] on a sword change).
//! - Time is advanced by the game shell via [`Fever::tick`]; this crate
//!   has no clock.
//! - Gate (1) compares the stored max against the duration argument the
//!   caller passes to FinishFever. The argument's meaning (configured
//!   duration vs elapsed) is not fully resolved statically; P0 passes
//!   `fever_max` (bonus + base duration) as the duration, so the gate
//!   reduces to `fever_max > 0` — i.e. a fever that actually ran pays out
//!   when headless is owned.
//!   TODO-RE: resolve the exact meaning of FinishFever's duration
//!   argument from a live trace or a fuller decompile of its caller.

use crate::config::{CHARGE_PER_SWORD, FEVER_SECONDS};
use crate::sword::{refresh_value, Sword};
use crate::tickets::Outcome;

/// Result of a finished Fever.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeverEnd {
    /// Fever ended with no payout (a gate failed).
    NoPayout,
    /// Fever ended and the headless payout applied.
    PaidOut {
        /// Grades gained by the payout (+2, headless effect).
        grade_gain: u32,
    },
}

/// Fever state for the sword currently on the anvil.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Fever {
    /// Strikes banked toward a full charge (0..=10, effects+0xdc).
    charge: u32,
    /// True while the window is open.
    active: bool,
    /// Seconds left in the window (0 when inactive, effects+0x120).
    time_left: f64,
    /// Bonus applied at start: `2 × Rank(everwick) + 4 + Rank(redglass)`
    /// (effects+0x128).
    bonus: f64,
    /// Max (bonus + duration, effects+0xd4).
    max: f64,
}

impl Fever {
    /// Fresh state: no charge, inactive.
    pub fn new() -> Self {
        Self {
            charge: 0,
            active: false,
            time_left: 0.0,
            bonus: 0.0,
            max: 0.0,
        }
    }

    /// Strikes banked so far.
    pub fn charge(&self) -> u32 {
        self.charge
    }

    /// Strikes needed for a full charge.
    pub fn charge_needed(&self) -> u32 {
        CHARGE_PER_SWORD
    }

    /// True while the Fever window is open.
    pub fn is_active(&self) -> bool {
        self.active
    }

    /// Seconds left in the window (0 when inactive).
    pub fn time_left(&self) -> f64 {
        self.time_left
    }

    /// Bonus applied at start (effects+0x128).
    pub fn bonus(&self) -> f64 {
        self.bonus
    }

    /// Max (bonus + duration, effects+0xd4).
    pub fn max(&self) -> f64 {
        self.max
    }

    /// True when a full charge is banked and Fever can start.
    pub fn is_ready(&self) -> bool {
        !self.active && self.charge >= CHARGE_PER_SWORD
    }

    /// Record one hammer strike on the current sword.
    ///
    /// +1 charge at every strike start when NOT in Fever (REA-REPORT
    /// §15.2, `StrikeResolution.Apply` step 9; locket/watch/hourglass add
    /// extra charge — none are in the P0 starter pool).
    /// Strikes while Fever is active do NOT add charge.
    pub fn record_strike(&mut self) {
        if !self.active {
            self.charge = (self.charge + 1).min(CHARGE_PER_SWORD);
        }
    }

    /// StartFever (RVA 0x263DCC4). Opens the window when fully charged;
    /// consumes the banked charge. `rank` is the Rank() lookup
    /// (everwick/redglass gates). Returns true when Fever started.
    pub fn start(&mut self, rank: &dyn Fn(&str) -> u32) -> bool {
        if !self.is_ready() {
            return false;
        }
        self.charge = 0;
        self.active = true;
        self.time_left = FEVER_SECONDS;
        self.bonus = 2.0 * rank("everwick") as f64 + 4.0 + rank("redglass") as f64;
        self.max = self.bonus + FEVER_SECONDS;
        true
    }

    /// ExtendFever (RVA 0x263E004): a Great during Fever adds +1 charge
    /// (clamped to the max). Call from the strike resolution when the
    /// outcome is Great and Fever is active.
    pub fn extend_on_great(&mut self) {
        if self.active {
            self.charge = (self.charge + 1).min(self.max as u32);
        }
    }

    /// Advance the window clock by `dt` seconds. Returns true the moment
    /// the window closes (the caller then runs [`Fever::finish`]).
    /// A 1e-9 epsilon absorbs float accumulation (4.0 − 3.9 − 0.1 > 0
    /// in f64).
    pub fn tick(&mut self, dt: f64) -> bool {
        if self.active {
            self.time_left -= dt;
            if self.time_left <= 1e-9 {
                self.active = false;
                self.time_left = 0.0;
                return true;
            }
        }
        false
    }

    /// FinishFever (RVA 0x263E048). Applies the headless payout when all
    /// three gates pass; otherwise no payout. `duration` is the caller's
    /// fever duration (P0 passes `self.max()` — see module docs).
    /// `tribute_count` is the campaign tribute count for the value
    /// refresh.
    pub fn finish(
        &mut self,
        sword: &mut Sword,
        rank: &dyn Fn(&str) -> u32,
        duration: f64,
        tribute_count: u32,
    ) -> FeverEnd {
        let max = self.max;
        // Gate 1: 0 < max ≤ duration.
        if !(max > 0.0 && max <= duration) {
            return FeverEnd::NoPayout;
        }
        // Gate 2: sword broken → payout skipped.
        if sword.broken {
            return FeverEnd::NoPayout;
        }
        // Gate 3: payout requires the headless relic (Rank >= 1).
        if rank("headless") < 1 {
            return FeverEnd::NoPayout;
        }
        // Payout (headless effect, §15.3): +2 grade via the delegate,
        // value refresh, peak update. gradeBefore/gradeAfter are written
        // into effects fields 0x11c/0x170 by the original; here the grade
        // change itself is the observable effect.
        let gained = sword.add_grade(2);
        refresh_value(sword, rank, tribute_count);
        FeverEnd::PaidOut { grade_gain: gained }
    }

    /// Reset charge and window (call when the player switches swords).
    pub fn reset(&mut self) {
        *self = Self::new();
    }
}

impl Default for Fever {
    fn default() -> Self {
        Self::new()
    }
}

/// Outcome of a strike during Fever for the caller: whether the strike
/// extends Fever (Great) — kept as a helper so the run module does not
/// re-derive the rule.
pub fn extends_fever(outcome: Outcome, fever_active: bool) -> bool {
    fever_active && outcome == Outcome::Great
}

#[cfg(test)]
mod tests {
    use super::*;

    fn no_relics(_id: &str) -> u32 {
        0
    }

    fn charged() -> Fever {
        let mut f = Fever::new();
        for _ in 0..10 {
            f.record_strike();
        }
        f
    }

    #[test]
    fn ten_strikes_charge_fever() {
        let mut f = Fever::new();
        assert!(!f.is_ready());
        for _ in 0..9 {
            f.record_strike();
            assert!(!f.is_ready());
        }
        f.record_strike();
        assert_eq!(f.charge(), 10);
        assert!(f.is_ready());
        // Extra strikes do not overcharge.
        f.record_strike();
        assert_eq!(f.charge(), 10);
    }

    #[test]
    fn start_consumes_charge_and_opens_4s_window() {
        let mut f = charged();
        assert!(f.start(&no_relics));
        assert!(f.is_active());
        assert_eq!(f.charge(), 0);
        assert!((f.time_left() - 4.0).abs() < 1e-9);
        // Bonus with no everwick/redglass is 4.0 (2×0 + 4 + 0).
        assert_eq!(f.bonus(), 4.0);
        assert_eq!(f.max(), 8.0);
        // Strikes during the window do not recharge.
        f.record_strike();
        assert_eq!(f.charge(), 0);
    }

    #[test]
    fn start_fails_when_not_charged() {
        let mut f = Fever::new();
        assert!(!f.start(&no_relics));
        assert!(!f.is_active());
    }

    #[test]
    fn window_closes_after_4_seconds() {
        let mut f = charged();
        f.start(&no_relics);
        assert!(!f.tick(3.9));
        assert!(f.is_active());
        assert!(f.tick(0.1));
        assert!(!f.is_active());
        assert_eq!(f.time_left(), 0.0);
        // Charging works again after the window.
        f.record_strike();
        assert_eq!(f.charge(), 1);
    }

    #[test]
    fn great_extends_fever_charge() {
        let mut f = charged();
        f.start(&no_relics);
        f.extend_on_great();
        assert_eq!(f.charge(), 1);
    }

    #[test]
    fn finish_without_headless_pays_nothing() {
        // The headless gate (§12.8): no headless relic → no payout.
        let mut f = charged();
        f.start(&no_relics);
        let mut sword = Sword::new(1);
        sword.grade = 5;
        let end = f.finish(&mut sword, &no_relics, f.max(), 0);
        assert_eq!(end, FeverEnd::NoPayout);
        assert_eq!(sword.grade, 5);
    }

    #[test]
    fn finish_with_headless_pays_plus_2_grades() {
        let headless = |id: &str| if id == "headless" { 1 } else { 0 };
        let mut f = charged();
        f.start(&headless);
        let mut sword = Sword::new(1);
        sword.grade = 5;
        let end = f.finish(&mut sword, &headless, f.max(), 0);
        assert_eq!(end, FeverEnd::PaidOut { grade_gain: 2 });
        assert_eq!(sword.grade, 7);
    }

    #[test]
    fn finish_on_broken_sword_pays_nothing() {
        let headless = |id: &str| if id == "headless" { 1 } else { 0 };
        let mut f = charged();
        f.start(&headless);
        let mut sword = Sword::new(1);
        sword.broken = true;
        let end = f.finish(&mut sword, &headless, f.max(), 0);
        assert_eq!(end, FeverEnd::NoPayout);
    }

    #[test]
    fn finish_with_zero_max_pays_nothing() {
        // Gate 1: max must be > 0.
        let headless = |id: &str| if id == "headless" { 1 } else { 0 };
        let mut f = Fever::new();
        let mut sword = Sword::new(1);
        let end = f.finish(&mut sword, &headless, 4.0, 0);
        assert_eq!(end, FeverEnd::NoPayout);
    }

    #[test]
    fn reset_clears_charge_and_window() {
        let mut f = charged();
        f.start(&no_relics);
        f.reset();
        assert_eq!((f.charge(), f.is_active(), f.time_left()), (0, false, 0.0));
    }
}
