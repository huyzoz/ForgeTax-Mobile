//! The P0 run session — the playable forge loop (MOBILE 3.17.0).
//!
//! A run: 24 contract rounds (Economy.txt quotas 1800 → 2,000,000), 3
//! swords per round, hammer strikes on the current sword until it is
//! tributed or broken, then settle the round. Survive round 24 → victory;
//! three shortfalls → defeat. After victory the player may continue in
//! endless mode (quota ×1.2 per round).
//!
//! The strike follows the 21-step proc order (REA-REPORT §11.6,
//! `StrikeResolution.Apply` RVA 0x264E2D4), P0-relevant steps only:
//! charge the Fever counter (step 9), draw from the real deck (FillDeck
//! + Chances), resolve the outcome (step 10 destruction / steps 12–19
//! grade + relic procs), refresh the value (step 20). Steps that need
//! relics or systems outside the P0 starter pool (altar, dopamine, star,
//! dice, ward, insurance, phoenix, twinseal, milestones) are no-ops here
//! and are marked in the code.
//!
//! P0 design decisions (documented, not hidden):
//! - The run starts owning ALL EIGHT starter relics (the starter pool,
//!   §13.4). Whether the original grants all eight or lets the player
//!   pick is unresolved statically. TODO-RE: confirm starter granting.
//! - Fever AUTO-STARTS when the charge hits 10. Whether the original
//!   auto-starts or needs a tap is unresolved statically. TODO-RE.
//! - "End day" (early settle) auto-tributes the remaining swords at
//!   their current value. The original's early-settle behaviour is
//!   unresolved. TODO-RE.

use crate::config::{CONTRACT_ROUNDS, SWORD_SUPPLY};
use crate::contract::{Contract, Settle};
use crate::frenzy::{Fever, FeverEnd};
use crate::relics::{Loadout, StrikeEffects};
use crate::sword::{refresh_value, Sword};
use crate::tickets::{CampaignFields, Outcome, SplitMix64};

/// Whether the run is still going.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunState {
    /// Still forging.
    Playing,
    /// Round 24 cleared (the dragon boss + ending are P2 scope).
    Victory,
    /// Dragon anger hit 3.
    Defeated,
}

/// Result of one hammer strike.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StrikeResult {
    pub outcome: Outcome,
    pub grade_before: u32,
    pub grade_after: u32,
    pub value_before: f64,
    pub value_after: f64,
    /// Scrap tribute from a broken sword (shard relic), 0 otherwise.
    pub scrap: f64,
    /// True when this strike completed the Fever charge and Fever started.
    pub fever_started: bool,
    /// True while Fever is active after this strike.
    pub fever_active: bool,
    /// Fever charge after this strike.
    pub fever_charge: u32,
    /// Per-mille display chances for the strike that was drawn.
    pub chances: [u32; 5],
    /// Swords remaining in this round after this strike (0 → round settled).
    pub swords_left: usize,
}

/// Result of tributing the current sword.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TributeResult {
    /// Value tributed.
    pub value: f64,
    /// Tribute offered this round so far.
    pub round_tribute: f64,
    /// Round quota.
    pub quota: f64,
    /// How the round settled, if it ended with this tribute.
    pub settle: Option<Settle>,
    /// Swords remaining in the round after this tribute.
    pub swords_left: usize,
}

/// One P0 run.
pub struct Run {
    pub contract: Contract,
    pub loadout: Loadout,
    pub fever: Fever,
    pub state: RunState,
    rng: SplitMix64,
    swords: Vec<Sword>,
    current: usize,
    /// Tribute offered in the current round (gold).
    pub round_tribute: f64,
    /// Swords tributed in the current round (for the tribute counter).
    pub round_tributed: u32,
    /// Total tribute offered across the run (gold).
    pub total_tribute: f64,
    /// Campaign tribute count (n in the RefreshValue base-bonus formula).
    pub tribute_count: u32,
    /// Total strikes this run.
    pub strikes: u64,
    /// Total swords broken this run.
    pub swords_broken: u32,
}

impl Run {
    /// A fresh run with the eight starter relics and the first round's
    /// swords dealt.
    pub fn new(seed: u64) -> Self {
        let mut run = Self {
            contract: Contract::new(),
            loadout: Loadout::starters(),
            fever: Fever::new(),
            state: RunState::Playing,
            rng: SplitMix64::new(seed),
            swords: Vec::new(),
            current: 0,
            round_tribute: 0.0,
            round_tributed: 0,
            total_tribute: 0.0,
            tribute_count: 0,
            strikes: 0,
            swords_broken: 0,
        };
        run.deal_round();
        run
    }

    /// The sword currently on the anvil, if any.
    pub fn current_sword(&self) -> Option<&Sword> {
        self.swords.get(self.current)
    }

    /// Swords remaining in the current round (including the current one).
    pub fn swords_left(&self) -> usize {
        self.swords.len().saturating_sub(self.current)
    }

    /// Per-mille chances for the next strike on the current sword.
    pub fn chances(&self) -> [u32; 5] {
        match self.current_sword() {
            None => [0, 0, 0, 0, 0],
            Some(sword) => {
                let deck = self.loadout.build_deck(
                    sword.grade,
                    &CampaignFields::default(),
                    self.fever.is_active(),
                    sword.damage_count,
                );
                deck.per_mille()
            }
        }
    }

    /// Deal the round's swords (3 fresh swords, ids cycling the main
    /// line 1–45). Per-sword base values are the balance default (320.0)
    /// — per-kind catalog values are unrecovered (sword.rs docs).
    fn deal_round(&mut self) {
        self.swords.clear();
        self.current = 0;
        let round = self.contract.round;
        for i in 0..SWORD_SUPPLY {
            let id = (((round - 1) * SWORD_SUPPLY + i) % 45 + 1) as u16;
            self.swords.push(Sword::new(id));
        }
        self.fever.reset();
    }

    /// Advance to the next sword; when the round's swords are exhausted,
    /// settle the round. Returns the settle outcome if the round ended.
    fn advance(&mut self) -> Option<Settle> {
        self.current += 1;
        self.fever.reset();
        if self.current >= self.swords.len() {
            Some(self.settle_round())
        } else {
            None
        }
    }

    /// Settle the current round with the tribute offered so far.
    fn settle_round(&mut self) -> Settle {
        let settled_round = self.contract.round;
        let offered = self.round_tribute;
        let outcome = self.contract.settle(offered);
        self.total_tribute += offered;
        self.round_tribute = 0.0;
        self.round_tributed = 0;
        match outcome {
            Settle::Cleared => {
                if settled_round == CONTRACT_ROUNDS {
                    self.state = RunState::Victory;
                } else {
                    self.deal_round();
                }
            }
            Settle::Anger(_) => {
                if self.state == RunState::Playing {
                    self.deal_round();
                }
            }
            Settle::Defeated => {
                self.state = RunState::Defeated;
            }
        }
        outcome
    }

    /// Continue in endless mode after a victory (round 25+).
    pub fn continue_endless(&mut self) {
        if self.state == RunState::Victory {
            self.state = RunState::Playing;
            self.deal_round();
        }
    }

    /// Hammer strike on the current sword. Returns `None` when there is
    /// no sword to strike (round over / run over).
    pub fn strike(&mut self) -> Option<StrikeResult> {
        if self.state != RunState::Playing {
            return None;
        }
        let sword_idx = self.current;
        if sword_idx >= self.swords.len() {
            return None;
        }
        let grade = self.swords[sword_idx].grade;
        let damage_count = self.swords[sword_idx].damage_count;
        let fever_active = self.fever.is_active();

        // Step 9 (proc order §11.6): +1 Fever charge at strike start
        // when not in Fever.
        self.fever.record_strike();

        // Draw from the real deck.
        let deck = self.loadout.build_deck(
            grade,
            &CampaignFields::default(),
            fever_active,
            damage_count,
        );
        let chances = deck.per_mille();
        let outcome = deck.draw(&mut self.rng)?;
        self.strikes += 1;

        let sword = &mut self.swords[sword_idx];
        let grade_before = sword.grade;
        let value_before = sword.value;
        let mut scrap = 0.0;

        if outcome == Outcome::Break {
            // Step 10: ResolveDestruction. No protection relics in P0
            // (ward/insurance/phoenix/spine/eternalseed/cornerstone),
            // so the sword breaks outright.
            sword.broken = true;
            self.swords_broken += 1;
            scrap = self
                .loadout
                .break_scrap(sword.peak_value, fever_active);
            self.round_tribute += scrap;
        } else {
            // Steps 12–19: grade + relic procs.
            let effects: StrikeEffects = self.loadout.strike_effects(outcome);
            sword.apply_outcome(outcome, effects);
            // Step 20: RefreshValue.
            let rank = |id: &str| self.loadout.rank(id);
            refresh_value(sword, &rank, self.tribute_count);
            // Great during Fever extends the charge (§12.8 ExtendFever).
            if outcome == Outcome::Great && self.fever.is_active() {
                self.fever.extend_on_great();
            }
        }

        // Auto-start Fever when the charge completed (P0 decision, see
        // module docs).
        let mut fever_started = false;
        if self.fever.is_ready() {
            let rank = |id: &str| self.loadout.rank(id);
            fever_started = self.fever.start(&rank);
        }

        let sword = &self.swords[sword_idx];
        let grade_after = sword.grade;
        let value_after = sword.value;
        let fever_active_after = self.fever.is_active();
        let fever_charge = self.fever.charge();

        // A broken sword leaves the anvil immediately.
        let settle = if outcome == Outcome::Break {
            self.advance()
        } else {
            None
        };
        let _ = settle;

        Some(StrikeResult {
            outcome,
            grade_before,
            grade_after,
            value_before,
            value_after,
            scrap,
            fever_started,
            fever_active: fever_active_after,
            fever_charge,
            chances,
            swords_left: self.swords_left(),
        })
    }

    /// Tribute the current sword: its value goes to the round's tribute.
    /// Returns `None` when there is no sword to tribute.
    pub fn tribute_sword(&mut self) -> Option<TributeResult> {
        if self.state != RunState::Playing {
            return None;
        }
        if self.current >= self.swords.len() {
            return None;
        }
        let sword = &self.swords[self.current];
        if sword.broken {
            return None;
        }
        let value = sword.value;
        self.round_tribute += value;
        self.round_tributed += 1;
        self.tribute_count += 1;
        let quota = self.contract.current_quota();
        let settle = self.advance();
        Some(TributeResult {
            value,
            round_tribute: self.round_tribute,
            quota,
            settle,
            swords_left: self.swords_left(),
        })
    }

    /// End the day early: settle the round now. Remaining unforged
    /// swords are auto-tributed at their current value (P0 decision,
    /// see module docs).
    pub fn end_day(&mut self) -> Option<Settle> {
        if self.state != RunState::Playing {
            return None;
        }
        while self.current < self.swords.len() {
            let sword = &self.swords[self.current];
            if !sword.broken {
                self.round_tribute += sword.value;
                self.round_tributed += 1;
                self.tribute_count += 1;
            }
            self.current += 1;
        }
        self.fever.reset();
        Some(self.settle_round())
    }

    /// Advance the Fever clock by `dt` seconds. When the window closes,
    /// runs FinishFever on the current sword and returns its outcome.
    pub fn tick(&mut self, dt: f64) -> Option<FeverEnd> {
        if self.state != RunState::Playing {
            return None;
        }
        if !self.fever.tick(dt) {
            return None;
        }
        let Some(sword) = self.swords.get_mut(self.current) else {
            return Some(FeverEnd::NoPayout);
        };
        let max = self.fever.max();
        let rank = |id: &str| self.loadout.rank(id);
        Some(self.fever.finish(sword, &rank, max, self.tribute_count))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_run_has_8_starters_and_3_swords() {
        let run = Run::new(1);
        assert_eq!(run.loadout.relics().len(), 8);
        assert_eq!(run.swords_left(), 3);
        assert_eq!(run.contract.round, 1);
        assert_eq!(run.contract.current_quota(), 1800.0);
        assert_eq!(run.state, RunState::Playing);
    }

    #[test]
    fn strike_changes_grade_or_breaks() {
        let mut run = Run::new(42);
        let before = run.current_sword().unwrap().grade;
        let result = run.strike().unwrap();
        match result.outcome {
            Outcome::Break => {
                assert!(result.scrap >= 0.0);
                assert_eq!(run.swords_left(), 2);
            }
            Outcome::Damage => assert_eq!(result.grade_after, before.saturating_sub(1)),
            Outcome::Hold => assert!(result.grade_after >= before),
            Outcome::Success => assert_eq!(result.grade_after, before + 1),
            Outcome::Great => assert_eq!(result.grade_after, before + 2),
        }
        assert_eq!(result.chances.iter().sum::<u32>(), 1000);
    }

    #[test]
    fn ten_strikes_start_fever() {
        // A sword can break before 10 strikes (the charge is per sword
        // and resets on a sword change), so strike until Fever starts —
        // it must start within a bounded number of strikes with a fixed
        // seed (each fresh sword has ~14% chance to survive 10 strikes).
        let mut run = Run::new(7);
        let mut started = false;
        for _ in 0..300 {
            let r = run.strike().unwrap();
            if r.fever_started {
                started = true;
                break;
            }
            if run.current_sword().is_some_and(|s| !s.broken) {
                // Keep forging the current sword; tribute it once it
                // reaches grade 10 so the run keeps moving.
                if run.current_sword().unwrap().grade >= 10 {
                    let _ = run.tribute_sword();
                }
            }
        }
        assert!(started, "Fever did not auto-start within 300 strikes");
        assert!(run.fever.is_active());
        // No BREAK can be drawn while Fever is active.
        for _ in 0..50 {
            let r = run.strike().unwrap();
            assert_ne!(r.outcome, Outcome::Break);
        }
    }

    #[test]
    fn tributing_all_swords_settles_the_round() {
        let mut run = Run::new(3);
        for _ in 0..3 {
            run.tribute_sword().unwrap();
        }
        // Round 1 quota is 1800; three grade-0 swords are worth 320 each
        // = 960 < 1800, so the round settles with anger 1.
        assert_eq!(run.contract.round, 2);
        assert_eq!(run.contract.anger, 1);
        assert_eq!(run.swords_left(), 3);
    }
}
