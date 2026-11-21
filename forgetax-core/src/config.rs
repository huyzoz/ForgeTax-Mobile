//! Balance constants for the MOBILE (Soucean 3.17.0) remake.
//!
//! Every value here is traced to the mobile balance data — either
//! `~/workspace/forgetax-mobile/unity/textassets/Economy.txt` (the balance
//! bible extracted from the 3.17.0 APK's `data.unity3d`) or a specific
//! REA-REPORT section / decompiled function. Values with no source carry
//! a `// TODO-RE` marker and must never be presented as real.
//!
//! The PC (GraveYardDev) original's numbers are NOT used here: the mobile
//! build has a different break curve (0.71/0.81/0.89 vs 0.72/0.82/0.90),
//! maxForgeGrade 999 (vs 299), and 119 items (vs 91).

// Source: Economy.txt config.endingGrade (REA-REPORT §5.1).
pub const ENDING_GRADE: u32 = 30;
// Source: Economy.txt config.contractRound (REA-REPORT §5.1).
pub const CONTRACT_ROUNDS: u32 = 24;
// Source: Economy.txt config.legacyContractRound (REA-REPORT §5.1).
// The 21-day mode is the LEGACY mode (pre-2026-11-16 runs); P1 scope.
pub const LEGACY_CONTRACT_ROUNDS: u32 = 21;
// Source: Economy.txt config.maxForgeGrade = 999 (REA-REPORT §5.1).
// The PC original was 299. Also confirmed as the .ctor default of
// ForgeEnhancementBalance (RVA 0x264AD84: *(0x24) = 0x3e7 = 999).
pub const MAX_FORGE_GRADE: u32 = 999;
// Source: Economy.txt config.greatMultiplier (REA-REPORT §5.1).
pub const GREAT_MULTIPLIER: f64 = 2.5;
// Source: Economy.txt config.endlessGrowth (REA-REPORT §5.1).
pub const ENDLESS_GROWTH: f64 = 1.2;
// Source: Economy.txt config.relicMiddleRound (REA-REPORT §5.1).
pub const RELIC_MIDDLE_ROUND: u32 = 8;
// Source: Economy.txt config.relicLateRound (REA-REPORT §5.1).
pub const RELIC_LATE_ROUND: u32 = 16;
// Source: Economy.txt config.relicRareWeights (REA-REPORT §5.1).
pub const RELIC_RARE_WEIGHTS: [f64; 3] = [0.25, 0.45, 0.45];
// Source: Economy.txt config.relicLegendaryWeights (REA-REPORT §5.1).
pub const RELIC_LEGENDARY_WEIGHTS: [f64; 3] = [0.0, 0.15, 0.3];
// Source: Economy.txt config.shopSlots (REA-REPORT §5.1).
pub const SHOP_SLOTS: u32 = 3;
// Source: Economy.txt config.swordSupply (REA-REPORT §5.1).
// Swords dealt per contract round.
pub const SWORD_SUPPLY: u32 = 3;
// Source: Economy.txt config.inventoryTypes (REA-REPORT §5.1).
pub const INVENTORY_TYPES: u32 = 8;
// Source: Economy.txt config.ownedMayReappear (REA-REPORT §5.1).
pub const OWNED_MAY_REAPPEAR: bool = false;
// Source: Economy.txt config.sameVisitDuplicates (REA-REPORT §5.1).
pub const SAME_VISIT_DUPLICATES: bool = false;
// Source: Economy.txt config.instantRestock (REA-REPORT §5.1).
pub const INSTANT_RESTOCK: bool = false;
// Source: Economy.txt config.rules.chargePerSword (REA-REPORT §5.1).
pub const CHARGE_PER_SWORD: u32 = 10;
// Source: Economy.txt config.rules.feverSeconds (REA-REPORT §5.1).
pub const FEVER_SECONDS: f64 = 4.0;
// Source: Economy.txt config.rules.feverRemoves (REA-REPORT §5.1):
// Fever removes BREAK tickets only.
pub const FEVER_REMOVES: &str = "BREAK";
// Source: Economy.txt config.dragonAngerLimit (REA-REPORT §5.1).
pub const DRAGON_ANGER_LIMIT: u32 = 3;
// Source: Economy.txt config.merchantSilverSlotChance (REA-REPORT §5.1).
// P1 (merchant) scope; recorded here so the value is not re-invented.
pub const MERCHANT_SILVER_SLOT_CHANCE: f64 = 0.5;
// Source: Economy.txt config.merchantGoldSlotChance (REA-REPORT §5.1).
pub const MERCHANT_GOLD_SLOT_CHANCE: f64 = 0.8;
// Source: ForgeEnhancementBalance..ctor (RVA 0x264AD84, decompiled
// `ghidra-decompile/ForgeTax.Rules.ForgeEnhancementBalance_.ctor_0x264ad84.c`):
// *(0x18) = 0x4074000000000000 = 320.0. This is the .ctor DEFAULT; the
// ScriptableObject asset may override it per build. The Unity 6 typetree
// could not be read, so the asset value is unconfirmed.
// TODO-RE: confirm whether the 3.17.0 asset overrides baseValue 320.0.
pub const BASE_VALUE: f64 = 320.0;
// Source: same .ctor: *(0x20) low dword 0x3FC00000 = 1.5f.
pub const GRADE_MULTIPLIER: f64 = 1.5;
// Source: same .ctor: *(0x28) = 0x409C200000000000 = 1800.0.
// Matches QUOTAS[0] exactly, which suggests the asset uses the defaults.
pub const OPENING_QUOTA: f64 = 1800.0;
// Source: same .ctor: *(0x30) = 1 (bool true).
pub const USE_RELIC_DECK: bool = true;
// Source: ForgeEconomy.SealRisk const (REA-REPORT §5.1) and the Chances
// f1 constant at .rodata 0xd0e2a0 = 0.85 (double), gated on Rank(seal) >= 1
// (REA-REPORT §12.8 + GOT-slot resolution 2026-11-21).
pub const SEAL_RISK: f64 = 0.85;
// Source: ForgeEnhancementBalance.TotalTickets const (REA-REPORT §5.1).
// The ticket deck totals 1,000 tickets.
pub const TOTAL_TICKETS: u32 = 1000;
// Source: REA-REPORT §12.8 / §15.1: FillTicketDeck / Chances switch to
// the TopGradeBreak path at grade >= 901.
pub const TOP_GRADE_THRESHOLD: u32 = 901;
// Source: REA-REPORT §11.6 / §12.8: Fever (Frenzy) charges per sword.
pub const FEVER_CHARGE_MAX: u32 = 10;
// Save-file key prefix for the clone. Original mobile key is
// `ForgeTax.ActiveSaveSlot`; the clone uses its own prefix so saves
// never collide with (or overwrite) the original game's data.
pub const SAVE_KEY_PREFIX: &str = "forgetax_clone_v1_";
