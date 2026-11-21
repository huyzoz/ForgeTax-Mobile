//! Ticket deck — the core of every hammer strike (MOBILE 3.17.0).
//!
//! Each strike draws ONE ticket from a deck of 1,000 tickets. There are
//! FIVE outcomes (ForgeOutcome, REA-REPORT §11.2, dump.cs line 870188):
//!
//! | Index | Outcome | Grade delta |
//! |-------|---------|-------------|
//! | 0 | [`Outcome::Break`] (Destruction) | sword breaks |
//! | 1 | [`Outcome::Damage`] | −1 grade |
//! | 2 | [`Outcome::Hold`] | 0 |
//! | 3 | [`Outcome::Success`] | +1 grade |
//! | 4 | [`Outcome::Great`] | +2 grades |
//!
//! The deck counts come from `TicketDeck.FillDeck` (RVA 0x26558B0),
//! fully reconstructed in REA-REPORT §11.5 and corrected in §15.1
//! (three swapped terms fixed 2026-11-21 13:43). The old 7:1:2 split was
//! an assumption and is DELETED — do not reintroduce it.
//!
//! The final draw weights come from `TicketDeck.Chances` (RVA 0x2656314):
//! FillSwordDeck → Fever adjustment → Danger rescale → risk factors
//! (seal ×0.85, tongs ×0.75 at grade > 5) → target-probability rescale.
//! The two Rank tags behind the risk factors were resolved 2026-11-21 via
//! the GOT-slot → relocation-addend → stringliteral.json method
//! (REA-REPORT §13): f1 = seal (0xa0008bdd), f2 = tongs (0xa00092a3);
//! the constants were read from .rodata (0xd0e2a0 = 0.85 double,
//! 0xd0eb98 = 1e-12 epsilon, 0xd0ef18 = 0.65 thread factor).
//!
//! The RNG is a tiny SplitMix64 PRNG implemented here on purpose: the
//! crate is std-only (no `rand` dependency) and tests need deterministic
//! seeds.

use crate::break_curve::break_chance;
use crate::config::SEAL_RISK;

/// Total tickets in the deck. Source: ForgeEnhancementBalance.TotalTickets
/// const (REA-REPORT §5.1). FillDeck counts are NOT normalised to 1,000 —
/// they are raw counts (base ~30) that the Chances rescale turns into the
/// final draw weights; the 1,000 is the per-mille display scale.
pub const TOTAL_TICKETS: u32 = 1000;

/// Result of one hammer strike. Discriminants match the original
/// `ForgeOutcome` enum (Destruction=0, Damage=1, Hold=2, Success=3,
/// GreatSuccess=4 — REA-REPORT §11.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Outcome {
    /// The sword shatters.
    Break = 0,
    /// −1 forge grade.
    Damage = 1,
    /// No grade change, no break.
    Hold = 2,
    /// +1 forge grade.
    Success = 3,
    /// +2 forge grades, sword value × [`crate::config::GREAT_MULTIPLIER`].
    Great = 4,
}

impl Outcome {
    /// Grade delta of this outcome (REA-REPORT §11.2, `GradeAfter`:
    /// `clamp(grade + (outcome - 2), 0, maxGrade)`). BREAK has no grade
    /// delta — the sword is destroyed instead.
    pub const fn grade_delta(self) -> i32 {
        match self {
            Outcome::Break => 0,
            Outcome::Damage => -1,
            Outcome::Hold => 0,
            Outcome::Success => 1,
            Outcome::Great => 2,
        }
    }

    /// Index into the 5-slot ticket arrays, matching ForgeOutcome.
    pub const fn index(self) -> usize {
        self as usize
    }
}

/// Per-campaign numeric fields that feed FillDeck. All default to 0 in
/// P0 (merchant/grudge/mourning systems are P1); the struct exists so the
/// formulas are implemented completely instead of silently dropping terms.
#[derive(Debug, Clone, Copy, Default)]
pub struct CampaignFields {
    /// Tickets added by the ossuary (dead field in §15.1: `ossuary_*` are
    /// 0 in 3.17.0 — kept for completeness, P1 may remove it).
    pub ossuary_success_tickets: i32,
    /// Tickets added by the grudge relic (only when grudge is owned).
    pub grudge_tickets: i32,
    /// Great tickets added by the mourning relic (only when mourning is owned).
    pub mourning_great_tickets: i32,
    /// RunTickets: bought + growth + extra ticket rows (merchant, P1).
    /// Applied to every outcome: `t[i] += run_tickets[i]`.
    pub run_tickets: [i32; 5],
    /// Tickets removed by the knife relic (merchant, P1).
    /// Applied: `t[i] -= knife_removed[i]`.
    pub knife_removed: [i32; 5],
}

/// FillDeck — the base ticket counts for a strike (REA-REPORT §15.1,
/// CORRECTED formulas; §14.2 had three swapped terms, fixed 2026-11-21).
///
/// `rank` is the Rank() lookup: 1 if the relic is owned (and not
/// Deferred), 0 otherwise (REA-REPORT §15.2). `fever` is whether Fever
/// is active — in Fever, BREAK tickets are removed (Economy
/// `feverRemoves = "BREAK only"`, §5.1) and Great gains
/// `+10 × Rank(perfectcore)` (REA-REPORT §12.8, FillSwordDeck).
///
/// Returns raw counts `[BREAK, Damage, Hold, Success, Great]` as f64
/// (the decompiled code uses doubles throughout).
pub fn fill_deck(rank: &dyn Fn(&str) -> u32, campaign: &CampaignFields, fever: bool) -> [f64; 5] {
    let r = |id: &str| rank(id) as f64;
    // t[0] BREAK — sicklehammer replaces the base 9 with 5.
    let mut t0 = (if r("sicklehammer") > 0.0 { 5.0 } else { 9.0 })
        + 3.0 * r("butterfingers")
        - r("lifecontract")
        - 2.0 * r("rivet");
    // t[1] Damage — sicklehammer replaces the base 2 with 5.
    let mut t1 = (if r("sicklehammer") > 0.0 { 5.0 } else { 2.0 })
        - r("mallet")
        + 2.0 * r("thorn")
        + 4.0 * r("deeppearl")
        - 2.0 * r("patience");
    // t[2] Hold — patience/thorn swap corrected in §15.1 (was reversed).
    let mut t2 = 3.0 * r("patience")
        - 2.0 * r("thorn")
        + 2.0 * (r("eternalseed") + r("hold") - r("file"))
        + 5.0;
    // t[3] Success — sicklehammer replaces the base 12 with 5;
    // royalnail +6 / deeppearl −4 corrected in §15.1.
    let mut t3 = (if r("sicklehammer") > 0.0 { 5.0 } else { 12.0 })
        + 4.0 * r("nail")
        + 2.0 * r("file")
        + r("mallet")
        + 6.0 * r("royalnail")
        + (campaign.ossuary_success_tickets as f64).max(0.0)
        - 4.0 * r("deeppearl");
    // t[4] Great — sicklehammer replaces the base 2 with 5;
    // butterfingers +5 corrected in §15.1.
    let mut t4 = (if r("sicklehammer") > 0.0 { 5.0 } else { 2.0 })
        + 5.0 * r("butterfingers")
        + 2.0 * r("pin")
        + r("spark")
        + 5.0 * r("oracledie")
        + if r("grudge") > 0.0 {
            (campaign.grudge_tickets as f64).max(0.0)
        } else {
            0.0
        }
        + (campaign.mourning_great_tickets as f64).max(0.0);
    // RunTickets / knife removals (merchant, P1 — all 0 in P0).
    let mut t = [t0, t1, t2, t3, t4];
    for i in 0..5 {
        t[i] += campaign.run_tickets[i] as f64 - campaign.knife_removed[i] as f64;
    }
    t0 = t[0];
    t1 = t[1];
    t2 = t[2];
    t3 = t[3];
    t4 = t[4];
    // Floors: BREAK ≥ 1, all others ≥ 0.
    t[0] = t0.max(1.0);
    t[1] = t1.max(0.0);
    t[2] = t2.max(0.0);
    t[3] = t3.max(0.0);
    t[4] = t4.max(0.0);
    if fever {
        // Fever removes BREAK (Economy feverRemoves) and perfectcore
        // adds Great tickets. Both branches are in FillSwordDeck.
        t[0] = 0.0;
        t[4] += 10.0 * r("perfectcore");
    }
    t
}

/// Danger — the rescale factor applied to BREAK tickets in Chances
/// (REA-REPORT §12.8, `TicketDeck.Danger` RVA 0x2655F48):
/// `(p / (1 − p)) × 21 / 9` where p = breakCurve[grade].
pub fn danger(grade: u32) -> f64 {
    let p = break_chance(grade);
    if p >= 1.0 {
        return f64::INFINITY;
    }
    (p / (1.0 - p)) * 21.0 / 9.0
}

/// Final draw weights for a strike (REA-REPORT §12.8, `TicketDeck.Chances`
/// RVA 0x2656314, FillSwordDeck → Danger rescale → risk factors →
/// target-probability rescale).
///
/// * `grade` — the sword's current forge grade.
/// * `deck` — the FillDeck counts (already fever-adjusted by `fill_deck`).
/// * `risk` — the entry risk multiplier (1.0 in P0; the SwordRisk composite
///   is a P1 concern — its factors are not all starter-reachable).
/// * `rank` — the Rank() lookup (seal/tongs gates).
/// * `damage_count` — consecutive Damage count on this sword (repair relic,
///   §15.3: break chance × max(0.4, 1 − 0.15·dmgCount), capped at 4).
///   0 when repair is not owned.
/// * `fever` — Fever active (BREAK already removed by `fill_deck`).
///
/// Returns `[BREAK, Damage, Hold, Success, Great]` weights; their sum is
/// the draw total. P(BREAK) after this equals
/// `share_after_danger × risk × seal × tongs`, which for the base deck
/// reduces to `breakCurve[grade] × risk × seal × tongs`.
pub fn chances_weights(
    grade: u32,
    deck: [f64; 5],
    risk: f64,
    rank: &dyn Fn(&str) -> u32,
    damage_count: u32,
    fever: bool,
) -> [f64; 5] {
    let mut tickets = deck;
    // Star / thread branches (REA-REPORT §12.8): star multiplies risk by
    // StarRisk(starStreak), thread multiplies by 0.65 (constant at
    // .rodata 0xd0ef18, Rank(thread) gate resolved). Neither relic is in
    // the P0 starter pool, so both are inactive here; the factors are
    // applied in `risk` by the caller when those relics are owned (P1).
    // DopamineRisk (REA-REPORT §12.8): clamp01 factor; no dopamine in P0,
    // so it is 1.0. TODO-RE: confirm DopamineRisk returns exactly 1.0
    // when dopamine is not owned (its streak input is 0 in that case).
    let mut risk_factor = risk.clamp(0.0, 1.0);
    // Seal: f1 = 0.85 (constant at .rodata 0xd0e2a0) when Rank(seal) >= 1.
    if rank("seal") > 0 {
        risk_factor *= SEAL_RISK;
    }
    // Tongs: f2 = 0.75 when grade > 5 and Rank(tongs) >= 1.
    if grade > 5 && rank("tongs") > 0 {
        risk_factor *= 0.75;
    }
    // Repair: break chance × max(0.4, 1 − 0.15·dmgCount) (§15.3, via
    // SwordRisk). Applied here as a risk multiplier — mathematically
    // identical on the final break probability. The exact insertion point
    // (SwordRisk vs the Chances risk param) is unresolved statically.
    // TODO-RE: pin down repair's insertion point in SwordRisk.
    if rank("repair") > 0 {
        let dmg = damage_count.min(4) as f64;
        risk_factor *= (1.0 - 0.15 * dmg).max(0.4);
    }
    // Danger rescale on BREAK tickets (skipped in Fever: they are 0).
    if !fever {
        tickets[0] *= danger(grade);
    }
    let sum_others: f64 = tickets[1..].iter().sum();
    // Target-probability rescale: force P(BREAK) to the risk-adjusted
    // share, with the 1e-12 epsilon guard (constant at .rodata 0xd0eb98).
    let share = if sum_others + tickets[0] > 0.0 {
        tickets[0] / (sum_others + tickets[0])
    } else {
        0.0
    };
    let target_p = share * risk_factor;
    if target_p > 0.0 {
        tickets[0] = (sum_others * target_p) / (1.0 - target_p).max(1e-12);
    }
    tickets
}

/// Per-mille display chances `[BREAK, Damage, Hold, Success, Great]`
/// summing to exactly 1,000 (REA-REPORT §12.8, `GetChances` RVA
/// 0x264A2C0: largest-fractional-remainder top-up, index 0 = BREAK taken
/// directly). The method is applied here to the final draw weights
/// instead of the chance-row table — same algorithm, same invariants.
pub fn per_mille(weights: [f64; 5]) -> [u32; 5] {
    let total: f64 = weights.iter().sum();
    if total <= 0.0 {
        return [0, 0, 0, 0, 0];
    }
    let mut pm = [0u32; 5];
    let mut remainders = [0f64; 5];
    let mut sum = 0u32;
    for i in 0..5 {
        let exact = weights[i] / total * 1000.0;
        pm[i] = exact.floor() as u32;
        remainders[i] = exact - pm[i] as f64;
        sum += pm[i];
    }
    // Largest-fractional-remainder top-up until the sum is exactly 1000.
    while sum < 1000 {
        let mut best = 0usize;
        for i in 1..5 {
            if remainders[i] > remainders[best] {
                best = i;
            }
        }
        pm[best] += 1;
        remainders[best] = 0.0;
        sum += 1;
    }
    pm
}

/// A weighted deck of outcome tickets, ready to draw from.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DeckWeights {
    pub weights: [f64; 5],
}

impl DeckWeights {
    pub fn new(weights: [f64; 5]) -> Self {
        Self { weights }
    }

    /// Total weight of the deck.
    pub fn total(&self) -> f64 {
        self.weights.iter().sum()
    }

    /// Probability of drawing `outcome` from this deck (0.0 when empty).
    pub fn probability(&self, outcome: Outcome) -> f64 {
        let total = self.total();
        if total <= 0.0 {
            return 0.0;
        }
        self.weights[outcome.index()] / total
    }

    /// Draw one outcome using `rng`. Returns `None` if the deck is empty.
    pub fn draw(&self, rng: &mut SplitMix64) -> Option<Outcome> {
        let total = self.total();
        if total <= 0.0 {
            return None;
        }
        let roll = rng.next_f64() * total;
        let mut acc = 0.0;
        for (i, w) in self.weights.iter().enumerate() {
            acc += w;
            if roll < acc {
                return Some(match i {
                    0 => Outcome::Break,
                    1 => Outcome::Damage,
                    2 => Outcome::Hold,
                    3 => Outcome::Success,
                    _ => Outcome::Great,
                });
            }
        }
        Some(Outcome::Great)
    }

    /// Per-mille display chances (see [`per_mille`]).
    pub fn per_mille(&self) -> [u32; 5] {
        per_mille(self.weights)
    }
}

/// Deterministic 64-bit PRNG (SplitMix64).
///
/// Standard algorithm, implemented from its public definition. Seeded, so
/// tests and replays are reproducible; the game shell seeds it from the
/// OS clock (or a run seed) in real play.
#[derive(Debug, Clone)]
pub struct SplitMix64 {
    state: u64,
}

impl SplitMix64 {
    pub fn new(seed: u64) -> Self {
        Self { state: seed }
    }

    /// Next raw 64-bit value.
    pub fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }

    /// Uniform f64 in `[0, 1)`.
    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    /// Uniform value in `0..bound` (unbiased for `bound <= 2^32` via
    /// rejection on the low 32 bits).
    pub fn next_below(&mut self, bound: u32) -> u32 {
        debug_assert!(bound > 0);
        let bound64 = bound as u64;
        let threshold = (u32::MAX as u64 + 1) % bound64;
        loop {
            let v = (self.next_u64() >> 32) as u64;
            if v >= threshold {
                return (v % bound64) as u32;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::GREAT_MULTIPLIER;

    fn no_relics(_id: &str) -> u32 {
        0
    }

    #[test]
    fn great_multiplier_is_2_5() {
        assert_eq!(GREAT_MULTIPLIER, 2.5);
    }

    #[test]
    fn fill_deck_base_counts() {
        // No relics: [9, 2, 5, 12, 2] (REA-REPORT §15.1).
        let deck = fill_deck(&no_relics, &CampaignFields::default(), false);
        assert_eq!(deck, [9.0, 2.0, 5.0, 12.0, 2.0]);
    }

    #[test]
    fn fill_deck_nail_adds_4_success() {
        let nail = |id: &str| if id == "nail" { 1 } else { 0 };
        let deck = fill_deck(&nail, &CampaignFields::default(), false);
        assert_eq!(deck[3], 16.0, "nail adds +4 Success");
        assert_eq!(deck, [9.0, 2.0, 5.0, 16.0, 2.0]);
    }

    #[test]
    fn fill_deck_pin_adds_2_great() {
        let pin = |id: &str| if id == "pin" { 1 } else { 0 };
        let deck = fill_deck(&pin, &CampaignFields::default(), false);
        assert_eq!(deck[4], 4.0, "pin adds +2 Great");
    }

    #[test]
    fn fill_deck_file_converts_hold_to_success() {
        let file = |id: &str| if id == "file" { 1 } else { 0 };
        let deck = fill_deck(&file, &CampaignFields::default(), false);
        // file: Hold −2 / Success +2 (REA-REPORT §15.3).
        assert_eq!(deck[2], 3.0);
        assert_eq!(deck[3], 14.0);
    }

    #[test]
    fn fill_deck_fever_removes_break() {
        let deck = fill_deck(&no_relics, &CampaignFields::default(), true);
        assert_eq!(deck[0], 0.0);
        assert_eq!(deck[1..], [2.0, 5.0, 12.0, 2.0]);
    }

    #[test]
    fn danger_forces_break_share_to_curve() {
        // Grade 30: p = 0.71. After the Danger rescale, the BREAK share
        // of the deck equals p (before the risk factors).
        let grade = 30;
        let deck = fill_deck(&no_relics, &CampaignFields::default(), false);
        let weights = chances_weights(grade, deck, 1.0, &no_relics, 0, false);
        let p = break_chance(grade);
        let got = weights[0] / weights.iter().sum::<f64>();
        assert!((got - p).abs() < 1e-9, "share {got} != curve {p}");
    }

    #[test]
    fn seal_reduces_break_by_15_percent() {
        let grade = 30;
        let deck = fill_deck(&no_relics, &CampaignFields::default(), false);
        let seal = |id: &str| if id == "seal" { 1 } else { 0 };
        let weights = chances_weights(grade, deck, 1.0, &seal, 0, false);
        let p = break_chance(grade);
        let got = weights[0] / weights.iter().sum::<f64>();
        assert!(
            (got - p * 0.85).abs() < 1e-9,
            "seal share {got} != {p} * 0.85"
        );
    }

    #[test]
    fn grade_0_cannot_break() {
        let deck = fill_deck(&no_relics, &CampaignFields::default(), false);
        let weights = chances_weights(0, deck, 1.0, &no_relics, 0, false);
        assert_eq!(weights[0], 0.0);
    }

    #[test]
    fn per_mille_sums_to_1000() {
        let weights = chances_weights(
            30,
            fill_deck(&no_relics, &CampaignFields::default(), false),
            1.0,
            &no_relics,
            0,
            false,
        );
        let pm = per_mille(weights);
        assert_eq!(pm.iter().sum::<u32>(), 1000);
        // BREAK is 710 per-mille at grade 30 with no relics.
        assert_eq!(pm[0], 710);
    }

    #[test]
    fn draw_returns_none_for_empty_deck() {
        let mut rng = SplitMix64::new(1);
        assert_eq!(DeckWeights::new([0.0; 5]).draw(&mut rng), None);
    }

    #[test]
    fn draw_is_deterministic_for_a_seed() {
        let deck = DeckWeights::new([9.0, 2.0, 5.0, 12.0, 2.0]);
        let mut a = SplitMix64::new(42);
        let mut b = SplitMix64::new(42);
        let seq_a: Vec<_> = (0..50).map(|_| deck.draw(&mut a)).collect();
        let seq_b: Vec<_> = (0..50).map(|_| deck.draw(&mut b)).collect();
        assert_eq!(seq_a, seq_b);
    }

    #[test]
    fn draw_frequencies_roughly_match_weights() {
        let deck = DeckWeights::new([9.0, 2.0, 5.0, 12.0, 2.0]);
        let mut rng = SplitMix64::new(7);
        let mut counts = [0u32; 5];
        let n = 20_000;
        for _ in 0..n {
            counts[deck.draw(&mut rng).unwrap().index()] += 1;
        }
        for (i, expected) in [0.30, 2.0 / 30.0, 5.0 / 30.0, 0.40, 2.0 / 30.0]
            .iter()
            .enumerate()
        {
            let got = counts[i] as f64 / n as f64;
            assert!((got - expected).abs() < 0.02, "outcome {i}: got {got}");
        }
    }
}
