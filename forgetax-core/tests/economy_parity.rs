//! Parity tests: the embedded tables must match the extracted MOBILE
//! balance data value-for-value. These tests read the mobile
//! `Economy.txt` (a copy of the file extracted from the Soucean 3.17.0
//! APK's `data.unity3d`, kept in `tests/fixtures/` as the balance
//! provenance) at compile time via `include_str!` and compare it
//! against the generated `data.rs` — so a typo in generation fails
//! loudly here instead of silently changing the game's balance.
//!
//! The extraction uses a tiny hand-rolled scanner (no serde — the crate
//! is std-only): the arrays contain only numbers, and the items section
//! is scanned for `"id": "..."` keys.

use forgetax_core::config;
use forgetax_core::data::{BREAK_CURVE, LEGACY_QUOTAS, QUOTAS, RELICS};

/// The extracted MOBILE balance file, embedded at compile time.
const ECONOMY_TXT: &str =
    include_str!("fixtures/Economy.txt");

/// Text of the JSON array following `"key": [` (no nested arrays inside).
fn array_body<'a>(text: &'a str, key: &str) -> &'a str {
    let pat = format!("\"{key}\": [");
    let start = text
        .find(&pat)
        .unwrap_or_else(|| panic!("key {key} not found"));
    let body_start = start + pat.len();
    let end = text[body_start..]
        .find(']')
        .expect("array has no closing bracket");
    &text[body_start..body_start + end]
}

fn parse_f64_array(text: &str, key: &str) -> Vec<f64> {
    array_body(text, key)
        .split(',')
        .map(|s| s.trim().parse::<f64>().unwrap())
        .collect()
}

fn parse_u64_array(text: &str, key: &str) -> Vec<u64> {
    array_body(text, key)
        .split(',')
        .map(|s| s.trim().parse::<u64>().unwrap())
        .collect()
}

/// Ordered relic ids from the `"items"` section of the file.
fn item_ids(text: &str) -> Vec<String> {
    let items_start = text.find("\"items\":").expect("items key not found");
    let rules_start = text[items_start..]
        .find("\"rules\":")
        .map(|i| items_start + i)
        .expect("rules key not found");
    let section = &text[items_start..rules_start];
    let mut ids = Vec::new();
    let mut rest = section;
    while let Some(pos) = rest.find("\"id\": \"") {
        let after = &rest[pos + 7..];
        let end = after.find('"').expect("unterminated id");
        ids.push(after[..end].to_string());
        rest = &after[end..];
    }
    ids
}

#[test]
fn break_curve_has_300_entries_matching_mobile_economy() {
    assert_eq!(BREAK_CURVE.len(), 300);
    let from_file = parse_f64_array(ECONOMY_TXT, "breakCurve");
    assert_eq!(from_file.len(), 300, "file breakCurve is not 300 entries");
    for (i, (embedded, file)) in BREAK_CURVE.iter().zip(&from_file).enumerate() {
        assert!(
            (embedded - file).abs() < 1e-12,
            "breakCurve[{i}]: embedded {embedded}, file {file}"
        );
    }
}

#[test]
fn quotas_have_24_entries_matching_mobile_economy() {
    assert_eq!(QUOTAS.len(), 24);
    let from_file = parse_u64_array(ECONOMY_TXT, "quotas");
    assert_eq!(from_file.len(), 24, "file quotas is not 24 entries");
    for (i, (embedded, file)) in QUOTAS.iter().zip(&from_file).enumerate() {
        assert_eq!(embedded, file, "quotas[{i}] (round {})", i + 1);
    }
}

#[test]
fn legacy_quotas_have_21_entries_matching_mobile_economy() {
    assert_eq!(LEGACY_QUOTAS.len(), 21);
    let from_file = parse_u64_array(ECONOMY_TXT, "legacyQuotas");
    assert_eq!(from_file.len(), 21, "file legacyQuotas is not 21 entries");
    for (i, (embedded, file)) in LEGACY_QUOTAS.iter().zip(&from_file).enumerate() {
        assert_eq!(embedded, file, "legacyQuotas[{i}] (round {})", i + 1);
    }
}

#[test]
fn relic_registry_matches_mobile_economy_items() {
    let ids = item_ids(ECONOMY_TXT);
    assert_eq!(ids.len(), 119, "file does not have 119 items");
    assert_eq!(RELICS.len(), 119);
    for (i, (def, file_id)) in RELICS.iter().zip(&ids).enumerate() {
        assert_eq!(def.id, file_id, "relic[{i}] id mismatch");
    }
    // Starter set from the data: the 8-item pool (REA-REPORT §13.4).
    let starters: Vec<&str> = RELICS.iter().filter(|r| r.starter).map(|r| r.id).collect();
    assert_eq!(
        starters,
        ["nail", "file", "seal", "coin", "pin", "hold", "shard", "repair"]
    );
}

#[test]
fn config_constants_match_mobile_economy() {
    assert!(ECONOMY_TXT.contains("\"endingGrade\": 30"));
    assert_eq!(config::ENDING_GRADE, 30);
    assert!(ECONOMY_TXT.contains("\"contractRound\": 24"));
    assert_eq!(config::CONTRACT_ROUNDS, 24);
    assert!(ECONOMY_TXT.contains("\"maxForgeGrade\": 999"));
    assert_eq!(config::MAX_FORGE_GRADE, 999);
    assert!(ECONOMY_TXT.contains("\"greatMultiplier\": 2.5"));
    assert_eq!(config::GREAT_MULTIPLIER, 2.5);
    assert!(ECONOMY_TXT.contains("\"endlessGrowth\": 1.2"));
    assert_eq!(config::ENDLESS_GROWTH, 1.2);
    assert!(ECONOMY_TXT.contains("\"chargePerSword\": 10"));
    assert_eq!(config::CHARGE_PER_SWORD, 10);
    assert!(ECONOMY_TXT.contains("\"feverSeconds\": 4"));
    assert_eq!(config::FEVER_SECONDS, 4.0);
    assert!(ECONOMY_TXT.contains("\"shopSlots\": 3"));
    assert_eq!(config::SHOP_SLOTS, 3);
    assert!(ECONOMY_TXT.contains("\"merchantSilverSlotChance\": 0.5"));
    assert_eq!(config::MERCHANT_SILVER_SLOT_CHANCE, 0.5);
    assert!(ECONOMY_TXT.contains("\"merchantGoldSlotChance\": 0.8"));
    assert_eq!(config::MERCHANT_GOLD_SLOT_CHANCE, 0.8);
}
