//! Swords — forge grade and value (MOBILE 3.17.0).
//!
//! The value formula is RECOVERED 100% (REA-REPORT §11.1, `SwordValuation`
//! RVA 0x2654868 / 0x2654AB4 / 0x264AA94 / 0x264AB60):
//!
//! * Basis = `Clamp(baseValue × lineMult + baseBonus + seedBase +
//!   growthBase) × gradeMultiplier^grade`
//! * Value = `Round((Basis + flat) × multiplier × greatMultiplier ×
//!   valueScale)`
//! * GradeAfter: `clamp(grade + (outcome − 2), 0, maxGrade)`
//!
//! Money is `f64` throughout (the original uses doubles; at high grades
//! values exceed u64 by orders of magnitude — 320 × 1.5^999 ≈ 10^177).
//! `MoneyMath` sanitises NaN to 0 and clamps to ±1e300 (§11.3; the
//! original returns −1e300 for NaN — the remake uses 0, as §11.3 advises).
//!
//! Evolution lines (ids from the localization data):
//! - Main line: ids 1–45 (ordinary swords).
//! - World Tree line: ids 100–110 (11 stages).
//! - Sea line: ids 200–210 (11 stages).
//! - Underworld line: ids 3000–3010 (11 stages).
//!
//! Sword display names are a content task (fresh Vietnamese wording);
//! this module models ids, lines, grades and values only.
//!
//! Per-sword kind base values live in `SwordV2Catalog` (a runtime asset);
//! its contents were NOT recovered (Unity 6 typetree, REA-REPORT §14).
//! P0 swords use the balance default `BASE_VALUE` (320.0, config.rs).

use crate::config::{BASE_VALUE, GRADE_MULTIPLIER, GREAT_MULTIPLIER, MAX_FORGE_GRADE};
use crate::relics::StrikeEffects;
use crate::tickets::Outcome;

/// Which evolution line a sword belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SwordLine {
    /// Ordinary swords, ids 1–45.
    Main,
    /// World Tree line, ids 100–110.
    WorldTree,
    /// Sea line, ids 200–210.
    Sea,
    /// Underworld line, ids 3000–3010.
    Underworld,
}

/// Evolution line for a sword id, or `None` for unknown ids.
pub fn line_of(id: u16) -> Option<SwordLine> {
    match id {
        1..=45 => Some(SwordLine::Main),
        100..=110 => Some(SwordLine::WorldTree),
        200..=210 => Some(SwordLine::Sea),
        3000..=3010 => Some(SwordLine::Underworld),
        _ => None,
    }
}

/// Line multiplier for a sword (REA-REPORT §11.1: `Basis` multiplies
/// `baseValue` by the line multiplier from `SpecialLineCatalog`).
///
/// The catalog values were NOT recovered (Unity 6 typetree). The
/// decompiled code defaults to 1.0 when the line is null — P0 swords have
/// no special line, so this is 1.0.
/// TODO-RE: recover the SpecialLineCatalog multipliers for the P1 sword
/// catalog (510 swords).
pub fn line_multiplier(line: Option<SwordLine>) -> f64 {
    let _ = line;
    1.0
}

/// MoneyMath — the original's money helpers (REA-REPORT §11.3).
/// `sanitize` maps NaN to 0 (the original maps NaN to −1e300; the remake
/// uses 0, per §11.3) and clamps to ±1e300.
pub fn sanitize_money(v: f64) -> f64 {
    if v.is_nan() {
        0.0
    } else if v.is_infinite() {
        v.signum() * 1e300
    } else {
        v.clamp(-1e300, 1e300)
    }
}

/// Per-sword value effects (the `ForgeEffects` fields the valuation
/// reads, REA-REPORT §11.1 / §12.8).
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct SwordEffects {
    /// effects+0x140 — flat bonus added inside Basis. Recomputed by
    /// [`refresh_value`]: `n × 20 × Rank(hearth) + Rank(coal) × 120`.
    pub base_bonus: f64,
    /// effects+0xB8 — seed bonus inside Basis. Not written in the
    /// decompiled RefreshValue; 0 in P0.
    pub seed_base: f64,
    /// effects+0xA0 — growth bonus inside Basis. Not written in the
    /// decompiled RefreshValue; 0 in P0.
    pub growth_base: f64,
    /// effects+0x178 — flat gold added AFTER Basis (coin relic adds +130
    /// here on Success/Great, §15.3). Persistent per sword.
    pub flat: f64,
    /// effects+0x148 — combined multiplier. Recomputed by
    /// [`refresh_value`]: token 1.25 × (grade ≥ 8 blackstone 1.3) ×
    /// (grade ≥ 12 dragonseal 1.5).
    pub multiplier: f64,
    /// effects+0x160 — Great multiplier. 1.0 until the first Great.
    /// TODO-RE: the writer of this field was NOT identified in §15.3.
    /// P0 adopts the PC reading: Great sets it to 2.5 persistently
    /// (matches the PC "value at least base × 2.5" behaviour).
    pub great_multiplier: f64,
    /// effects+0x158 — value scale. 1.0 in P0 (no writer found in the
    /// decompiled RefreshValue).
    pub value_scale: f64,
}

impl SwordEffects {
    pub fn new() -> Self {
        Self {
            multiplier: 1.0,
            great_multiplier: 1.0,
            value_scale: 1.0,
            ..Default::default()
        }
    }
}

/// A sword being forged.
#[derive(Debug, Clone, PartialEq)]
pub struct Sword {
    /// Sword id (1–45 main, 100–110 / 200–210 / 3000–3010 lines).
    pub id: u16,
    /// Forge grade, 0..=999.
    pub grade: u32,
    /// Value of this sword kind at grade 0 (per-kind base; P0 uses the
    /// balance default 320.0 — see module docs).
    pub base_value: f64,
    /// Current value in gold.
    pub value: f64,
    /// Best value this sword has ever reached (effects+0x170).
    pub peak_value: f64,
    /// True after a BREAK (the sword is destroyed).
    pub broken: bool,
    /// True after the first Great was forged on this sword.
    pub great_forged: bool,
    /// Consecutive Damage outcomes on this sword (repair relic, §15.3;
    /// caps at 4 in the risk formula).
    pub damage_count: u32,
    /// The sword's value effects (see [`SwordEffects`]).
    pub effects: SwordEffects,
}

impl Sword {
    /// A fresh sword of `id` with the P0 default base value (grade 0,
    /// value = base value).
    pub fn new(id: u16) -> Self {
        Self::with_base(id, BASE_VALUE)
    }

    /// A fresh sword with an explicit per-kind base value.
    pub fn with_base(id: u16, base_value: f64) -> Self {
        Self {
            id,
            grade: 0,
            base_value,
            value: base_value,
            peak_value: base_value,
            broken: false,
            great_forged: false,
            damage_count: 0,
            effects: SwordEffects::new(),
        }
    }

    /// Evolution line of this sword, if its id is known.
    pub fn line(&self) -> Option<SwordLine> {
        line_of(self.id)
    }

    /// True at the grade cap.
    pub fn is_max_grade(&self) -> bool {
        self.grade >= MAX_FORGE_GRADE
    }

    /// Value a Great success guarantees: base value × 2.5, rounded.
    pub fn great_value(&self) -> f64 {
        (self.base_value * GREAT_MULTIPLIER).round()
    }

    /// Basis (REA-REPORT §11.1, `SwordValuation.Basis` RVA 0x2654868):
    /// `Multiply(Clamp(baseValue × lineMult + baseBonus + seedBase +
    /// growthBase), gradeMultiplier^grade)`.
    pub fn basis(&self) -> f64 {
        let inner = sanitize_money(
            self.base_value * line_multiplier(self.line())
                + self.effects.base_bonus
                + self.effects.seed_base
                + self.effects.growth_base,
        );
        sanitize_money(inner * GRADE_MULTIPLIER.powi(self.grade as i32))
    }

    /// Value (REA-REPORT §11.1, `SwordValuation.Value` RVA 0x2654AB4):
    /// `Round(Total(Multiply(Multiply(Multiply(Add(Basis, flat),
    /// multiplier), greatMultiplier), valueScale)))`.
    ///
    /// NOTE: .NET `Math.Round` defaults to banker's rounding (ToEven);
    /// Rust's `f64::round` is half-away-from-zero. The two differ only
    /// on exact .5 values — vanishingly rare after float arithmetic.
    pub fn value_formula(&self) -> f64 {
        let v = (self.basis() + self.effects.flat)
            * self.effects.multiplier
            * self.effects.great_multiplier
            * self.effects.value_scale;
        sanitize_money(v).round()
    }

    /// ValueAt (REA-REPORT §11.2, RVA 0x264AA94):
    /// `Round(baseValue × max(1.0, SafeBonus(bonus) + gradeMultiplier)
    /// ^ clamp(grade, 0, 999))`. Used by the UI for "what would this
    /// sword be worth at grade N".
    pub fn value_at(grade: u32, bonus: f64) -> f64 {
        let bonus = if bonus.is_finite() { bonus } else { 0.0 };
        let base = (1.0f64).max(bonus + GRADE_MULTIPLIER);
        let g = grade.min(MAX_FORGE_GRADE);
        sanitize_money(BASE_VALUE * base.powi(g as i32)).round()
    }

    /// GradeAfter (REA-REPORT §11.2, RVA 0x264AB60):
    /// `clamp(grade + (outcome − 2), 0, maxGrade)`.
    pub fn grade_after(grade: u32, outcome: Outcome) -> u32 {
        let next = grade as i32 + outcome.grade_delta();
        next.clamp(0, MAX_FORGE_GRADE as i32) as u32
    }

    /// Add `n` grades, capped at [`MAX_FORGE_GRADE`]. Returns the grades
    /// actually gained (less than `n` when capped).
    pub fn add_grade(&mut self, n: u32) -> u32 {
        let before = self.grade;
        self.grade = self.grade.saturating_add(n).min(MAX_FORGE_GRADE);
        self.grade - before
    }

    /// Apply a non-break strike outcome to the grade only.
    ///
    /// `Outcome::Break` is a no-op here — the caller handles a broken
    /// sword (removal, protection relics, scrap tribute). Value is NOT
    /// updated here: the caller must call [`refresh_value`] after the
    /// grade change (the 21-step proc order, §11.6, step 20).
    pub fn apply_outcome(&mut self, outcome: Outcome, effects: StrikeEffects) {
        match outcome {
            Outcome::Success => {
                self.add_grade(1);
                self.effects.flat += effects.gold;
            }
            Outcome::Great => {
                self.add_grade(2);
                // TODO-RE: the writer of effects.field_0x160 (great
                // multiplier) was not identified in §15.3; P0 sets it to
                // 2.5 on the first Great (PC reading).
                self.effects.great_multiplier = GREAT_MULTIPLIER;
                self.great_forged = true;
                self.effects.flat += effects.gold;
            }
            Outcome::Hold => {
                self.add_grade(effects.extra_grade);
                self.effects.flat += effects.gold;
            }
            Outcome::Damage => {
                self.add_grade(0);
                self.grade = Self::grade_after(self.grade, Outcome::Damage);
                self.damage_count = self.damage_count.saturating_add(1);
            }
            Outcome::Break => {}
        }
    }
}

/// RefreshValue (REA-REPORT §12.8, `SwordValuation.RefreshValue`
/// RVA 0x2654C40): recompute the sword's derived value fields from the
/// campaign state and re-derive `value` + `peak_value`.
///
/// * `rank` — the Rank() lookup (coal/hearth/token/blackstone/dragonseal).
/// * `tribute_count` — the campaign's tribute count (n in the formula).
pub fn refresh_value(sword: &mut Sword, rank: &dyn Fn(&str) -> u32, tribute_count: u32) {
    // effects.field_0x140 = n × 20 × Rank(hearth) + Rank(coal) × 120,
    // where n = max(0, campaign tribute count).
    let n = tribute_count as f64;
    sword.effects.base_bonus =
        n * 20.0 * rank("hearth") as f64 + rank("coal") as f64 * 120.0;
    // Combined multiplier (effects+0x148):
    // token 1.25; grade ≥ 8 blackstone 1.3; grade ≥ 12 dragonseal 1.5.
    let mut m = 1.0f64;
    if rank("token") > 0 {
        m *= 1.25;
    }
    if sword.grade >= 8 && rank("blackstone") > 0 {
        m *= 1.3;
    }
    if sword.grade >= 12 && rank("dragonseal") > 0 {
        m *= 1.5;
    }
    sword.effects.multiplier = m;
    // effects.field_0x140 writer also covers seed/growth bases — both
    // stay 0 in P0 (no writer found in the decompiled RefreshValue).
    sword.value = sword.value_formula();
    if sword.value > sword.peak_value {
        sword.peak_value = sword.value;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn no_relics(_id: &str) -> u32 {
        0
    }

    #[test]
    fn line_mapping_matches_spec() {
        assert_eq!(line_of(1), Some(SwordLine::Main));
        assert_eq!(line_of(45), Some(SwordLine::Main));
        assert_eq!(line_of(46), None);
        assert_eq!(line_of(100), Some(SwordLine::WorldTree));
        assert_eq!(line_of(110), Some(SwordLine::WorldTree));
        assert_eq!(line_of(200), Some(SwordLine::Sea));
        assert_eq!(line_of(210), Some(SwordLine::Sea));
        assert_eq!(line_of(3000), Some(SwordLine::Underworld));
        assert_eq!(line_of(3010), Some(SwordLine::Underworld));
        assert_eq!(line_of(3011), None);
    }

    #[test]
    fn new_sword_starts_at_grade_0_worth_base() {
        let s = Sword::new(1);
        assert_eq!(s.grade, 0);
        assert_eq!(s.base_value, 320.0);
        assert_eq!(s.value, 320.0);
        assert_eq!(s.line(), Some(SwordLine::Main));
        assert!(!s.is_max_grade());
    }

    #[test]
    fn basis_grows_by_grade_multiplier() {
        let mut s = Sword::new(1);
        // grade 0: 320 × 1.5^0 = 320.
        assert_eq!(s.basis(), 320.0);
        s.grade = 1;
        assert_eq!(s.basis(), 480.0);
        s.grade = 2;
        assert_eq!(s.basis(), 720.0);
        // grade 10: 320 × 1.5^10 ≈ 18,453 (REA-REPORT §11.1 check).
        s.grade = 10;
        assert!((s.basis() - 18_453.0).abs() < 1.0, "basis {}", s.basis());
    }

    #[test]
    fn value_at_matches_formula() {
        // grade 10, bonus 0: 320 × 1.5^10 ≈ 18,453.
        let v = Sword::value_at(10, 0.0);
        assert!((v - 18_453.0).abs() < 1.0, "value_at {v}");
        // grade 30: 320 × 1.5^30 ≈ 61,276,545.
        let v30 = Sword::value_at(30, 0.0);
        assert!(v30 > 60_000_000.0 && v30 < 62_000_000.0, "value_at {v30}");
    }

    #[test]
    fn grade_after_matches_outcome_minus_two() {
        assert_eq!(Sword::grade_after(10, Outcome::Damage), 9);
        assert_eq!(Sword::grade_after(10, Outcome::Hold), 10);
        assert_eq!(Sword::grade_after(10, Outcome::Success), 11);
        assert_eq!(Sword::grade_after(10, Outcome::Great), 12);
        assert_eq!(Sword::grade_after(0, Outcome::Damage), 0);
        assert_eq!(Sword::grade_after(999, Outcome::Great), 999);
    }

    #[test]
    fn great_sets_multiplier_and_value_floor() {
        let mut s = Sword::new(1);
        s.apply_outcome(Outcome::Great, StrikeEffects::default());
        assert_eq!(s.grade, 2);
        refresh_value(&mut s, &no_relics, 0);
        // basis at grade 2 = 720; × 2.5 = 1,800.
        assert_eq!(s.value, 1800.0);
        assert!(s.great_forged);
    }

    #[test]
    fn success_adds_one_grade_and_coin_gold() {
        let mut s = Sword::new(1);
        s.apply_outcome(
            Outcome::Success,
            StrikeEffects {
                gold: 130.0,
                extra_grade: 0,
            },
        );
        assert_eq!(s.grade, 1);
        refresh_value(&mut s, &no_relics, 0);
        // basis 480 + flat 130 = 610.
        assert_eq!(s.value, 610.0);
    }

    #[test]
    fn damage_lowers_grade_and_counts() {
        let mut s = Sword::new(1);
        s.grade = 5;
        s.apply_outcome(Outcome::Damage, StrikeEffects::default());
        assert_eq!(s.grade, 4);
        assert_eq!(s.damage_count, 1);
    }

    #[test]
    fn refresh_value_applies_coal_hearth_token() {
        let mut s = Sword::new(1);
        s.grade = 12;
        let ranks = |id: &str| match id {
            "coal" => 1,
            "hearth" => 1,
            "token" => 1,
            "blackstone" => 1,
            "dragonseal" => 1,
            _ => 0,
        };
        refresh_value(&mut s, &ranks, 3);
        // base_bonus = 3×20×1 + 1×120 = 180; basis = (320+180)×1.5^12 = 500×129.746… = 64,873;
        // multiplier = 1.25 × 1.3 × 1.5 = 2.4375; value = 64,873 × 2.4375 ≈ 158,128.
        assert!((s.value - 158_128.0).abs() < 2.0, "value {}", s.value);
    }

    #[test]
    fn grade_caps_at_999() {
        let mut s = Sword::new(1);
        s.grade = 998;
        assert_eq!(s.add_grade(1), 1);
        assert!(s.is_max_grade());
        assert_eq!(s.add_grade(5), 0);
        assert_eq!(s.grade, 999);
    }
}
