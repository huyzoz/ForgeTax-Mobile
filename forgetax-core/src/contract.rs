//! Contract and tribute — the 24-round run structure (MOBILE 3.17.0).
//!
//! One run ("contract") lasts [`CONTRACT_ROUNDS`] rounds. Each round has a
//! tribute quota (gold) from `Economy.txt` `config.quotas`, embedded in
//! `crate::data::QUOTAS` (identical to the PC original's table). The
//! player forges swords, puts them on the tribute counter and rings the
//! bell; meeting the round's quota advances to the next round. Falling
//! short angers the dragon — [`DRAGON_ANGER_LIMIT`] anger stages (3) end
//! the run in defeat.
//!
//! Round 24 is the final settlement (quota 2,000,000): surviving it means
//! facing the dragon boss and then the ending (P2 scope). From round 25
//! the run continues in endless mode, each quota growing by
//! [`ENDLESS_GROWTH`] (x1.2) per round.
//!
//! Money is `f64` (the original uses doubles for money; see sword.rs).
//! The 24 quotas fit u64, but endless quotas grow without bound.

use crate::config::{CONTRACT_ROUNDS, DRAGON_ANGER_LIMIT, ENDING_GRADE, ENDLESS_GROWTH};
use crate::data::{LEGACY_QUOTAS, QUOTAS};

/// Tribute quota for a contract round 1..=24. Returns `None` outside that
/// range (use [`quota_for`] for endless rounds).
pub fn quota(round: u32) -> Option<f64> {
    if (1..=CONTRACT_ROUNDS).contains(&round) {
        Some(QUOTAS[(round - 1) as usize] as f64)
    } else {
        None
    }
}

/// Tribute quota for a legacy 21-day round 1..=21 (REA-REPORT §5.1).
/// P1 scope (legacy mode); recorded here so the table is not re-invented.
pub fn legacy_quota(round: u32) -> Option<f64> {
    if (1..=21).contains(&round) {
        Some(LEGACY_QUOTAS[(round - 1) as usize] as f64)
    } else {
        None
    }
}

/// Tribute quota for ANY round >= 1.
///
/// Rounds 1..=24 come from the table; rounds 25+ are computed as
/// `2_000_000 * 1.2^(round - 24)`. Returns `None` for round 0.
pub fn quota_for(round: u32) -> Option<f64> {
    match round {
        0 => None,
        1..=CONTRACT_ROUNDS => quota(round),
        _ => {
            let steps = (round - CONTRACT_ROUNDS) as i32;
            Some(2_000_000f64 * ENDLESS_GROWTH.powi(steps))
        }
    }
}

/// Grade a sword must reach for the ending sequence.
pub fn ending_grade() -> u32 {
    ENDING_GRADE
}

/// Outcome of settling one round's tribute.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Settle {
    /// Quota met: advance to the next round.
    Cleared,
    /// Quota missed: the dragon's anger rises (see [`Contract::anger`]).
    Anger(u8),
    /// Third anger stage: the run ends in defeat.
    Defeated,
}

/// Mutable state of one contract run.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Contract {
    /// Current round, 1-based.
    pub round: u32,
    /// Dragon anger stages accumulated (0..=3).
    pub anger: u8,
}

impl Contract {
    /// A fresh contract starts at round 1 with no anger.
    pub fn new() -> Self {
        Self { round: 1, anger: 0 }
    }

    /// Quota for the current round (table or endless growth).
    pub fn current_quota(&self) -> f64 {
        quota_for(self.round).expect("round is always >= 1")
    }

    /// True once the run has passed the final contract round.
    pub fn is_endless(&self) -> bool {
        self.round > CONTRACT_ROUNDS
    }

    /// Settle the current round with `offered` gold of tribute.
    ///
    /// Meeting the quota advances the round (anger unchanged). Missing it
    /// adds one anger stage; the third stage defeats the run. The round
    /// advances on BOTH outcomes — the day passes either way.
    /// TODO-RE: whether the original advances the round on a missed quota
    /// is unresolved statically; P0 advances (otherwise a run could farm
    /// round 1 forever without progressing).
    pub fn settle(&mut self, offered: f64) -> Settle {
        if offered >= self.current_quota() {
            self.round += 1;
            Settle::Cleared
        } else {
            self.anger += 1;
            self.round += 1;
            if u32::from(self.anger) >= DRAGON_ANGER_LIMIT {
                Settle::Defeated
            } else {
                Settle::Anger(self.anger)
            }
        }
    }
}

impl Default for Contract {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotas_match_economy() {
        assert_eq!(quota(1), Some(1800.0));
        assert_eq!(quota(2), Some(2100.0));
        assert_eq!(quota(8), Some(13200.0));
        assert_eq!(quota(12), Some(65500.0));
        assert_eq!(quota(24), Some(2_000_000.0));
        assert_eq!(quota(0), None);
        assert_eq!(quota(25), None);
    }

    #[test]
    fn quotas_are_strictly_increasing() {
        for r in 2..=24u32 {
            assert!(quota(r) > quota(r - 1), "round {r}");
        }
    }

    #[test]
    fn legacy_quotas_match_economy() {
        assert_eq!(legacy_quota(1), Some(1800.0));
        assert_eq!(legacy_quota(21), Some(232_000.0));
        assert_eq!(legacy_quota(22), None);
    }

    #[test]
    fn endless_quotas_grow_by_1_2() {
        assert_eq!(quota_for(25), Some(2_400_000.0));
        assert_eq!(quota_for(26), Some(2_880_000.0));
        assert_eq!(quota_for(27), Some(3_456_000.0));
        assert_eq!(quota_for(0), None);
    }

    #[test]
    fn settle_clears_and_advances() {
        let mut c = Contract::new();
        assert_eq!(c.settle(1800.0), Settle::Cleared);
        assert_eq!(c.round, 2);
        assert_eq!(c.anger, 0);
    }

    #[test]
    fn three_shortfalls_defeat_the_run() {
        let mut c = Contract::new();
        assert_eq!(c.settle(0.0), Settle::Anger(1));
        assert_eq!(c.settle(0.0), Settle::Anger(2));
        assert_eq!(c.settle(0.0), Settle::Defeated);
        assert_eq!(c.anger, 3);
        // The round advances even on a miss (round 4 now, quota 3350);
        // a later success clears the new round but does not revive the
        // run's anger count.
        assert_eq!(c.settle(3350.0), Settle::Cleared);
        assert_eq!(c.anger, 3);
        assert_eq!(c.round, 5);
    }

    #[test]
    fn endless_flag_after_round_24() {
        let mut c = Contract::new();
        assert!(!c.is_endless());
        for _ in 0..24 {
            c.settle(f64::MAX);
        }
        assert_eq!(c.round, 25);
        assert!(c.is_endless());
        assert_eq!(c.current_quota(), 2_400_000.0);
    }
}
