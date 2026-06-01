use base64::Engine;
use blake2::{
    digest::{Update, VariableOutput},
    Blake2bVar,
};
use ed25519_dalek::{Signature as Ed25519Signature, Verifier, VerifyingKey as Ed25519PublicKey};
use hmac::{Hmac, Mac};
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::Sha256;
use sha3::{Digest, Keccak256};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiwxMessage {
    pub format: String,
    pub chain_type: String,
    pub domain: String,
    pub address: String,
    pub uri: String,
    pub version: String,
    pub chain_id: String,
    pub nonce: String,
    pub issued_at: String,
    pub expiration_time: Option<String>,
    pub raw: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationRequest {
    pub message: SiwxMessage,
    pub signature: String,
    pub nonce: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationOptions {
    pub expected_domain: Option<String>,
    pub expected_address: Option<String>,
    pub expected_chain_id: Option<String>,
    pub now: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerificationResult {
    pub ok: bool,
    pub subject: Option<String>,
    pub reason: Option<String>,
}

impl VerificationResult {
    fn ok(subject: String) -> Self {
        Self {
            ok: true,
            subject: Some(subject),
            reason: None,
        }
    }

    fn err(reason: &str) -> Self {
        Self {
            ok: false,
            subject: None,
            reason: Some(reason.to_owned()),
        }
    }
}

pub fn verify_evm_siwe_message(
    request: &VerificationRequest,
    options: &VerificationOptions,
) -> VerificationResult {
    let message = &request.message;

    if message.chain_type != "evm" {
        return VerificationResult::err("SIWE message chain type must be evm.");
    }
    if message.nonce != request.nonce {
        return VerificationResult::err("SIWE nonce mismatch.");
    }
    if options
        .expected_domain
        .as_ref()
        .is_some_and(|domain| &message.domain != domain)
    {
        return VerificationResult::err("SIWE domain mismatch.");
    }
    if options
        .expected_chain_id
        .as_ref()
        .is_some_and(|chain_id| &message.chain_id != chain_id)
    {
        return VerificationResult::err("SIWE chainId mismatch.");
    }

    let address = match checksum_evm_address(&message.address) {
        Ok(address) => address,
        Err(_) => return VerificationResult::err("SIWE address is invalid."),
    };

    if let Some(expected) = &options.expected_address {
        match checksum_evm_address(expected) {
            Ok(expected) if expected == address => {}
            _ => return VerificationResult::err("SIWE address mismatch."),
        }
    }

    if message.expiration_time.is_none() {
        return VerificationResult::err("SIWE expirationTime is required.");
    }
    if is_expired(message.expiration_time.as_deref(), options.now.as_deref()) {
        return VerificationResult::err("SIWE message expired.");
    }

    let recovered = match recover_evm_address(&raw_evm_siwe_message(message), &request.signature) {
        Ok(recovered) => recovered,
        Err(_) => return VerificationResult::err("SIWE signature is invalid."),
    };

    if recovered != address {
        return VerificationResult::err("SIWE signature is invalid.");
    }

    VerificationResult::ok(address)
}

pub fn verify_sui_personal_message(
    request: &VerificationRequest,
    options: &VerificationOptions,
) -> VerificationResult {
    let message = &request.message;

    if message.chain_type != "sui" {
        return VerificationResult::err("Sui message chain type must be sui.");
    }
    if message.nonce != request.nonce {
        return VerificationResult::err("Sui nonce mismatch.");
    }

    let address = match normalize_sui_address(&message.address) {
        Ok(address) => address,
        Err(_) => return VerificationResult::err("Sui address is invalid."),
    };

    if let Some(expected) = &options.expected_address {
        match normalize_sui_address(expected) {
            Ok(expected) if expected == address => {}
            _ => return VerificationResult::err("Sui address mismatch."),
        }
    }
    if options
        .expected_chain_id
        .as_ref()
        .is_some_and(|chain_id| &message.chain_id != chain_id)
    {
        return VerificationResult::err("Sui chain identifier mismatch.");
    }
    if message.expiration_time.is_none() {
        return VerificationResult::err("Sui expirationTime is required.");
    }
    if is_expired(message.expiration_time.as_deref(), options.now.as_deref()) {
        return VerificationResult::err("Sui message expired.");
    }

    if verify_sui_signature(
        raw_sui_personal_message(message).as_bytes(),
        &request.signature,
        &address,
    )
    .is_err()
    {
        return VerificationResult::err("Sui signature is invalid.");
    }

    VerificationResult::ok(address)
}

pub fn verify_jwt_session(token: &str, secret: &str, now: Option<&str>) -> Result<Value, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("JWT must have three segments.".to_owned());
    }

    let signing_input = format!("{}.{}", parts[0], parts[1]);
    let expected = hmac_sha256(secret.as_bytes(), signing_input.as_bytes());
    let actual = base64url_decode(parts[2])?;

    if expected != actual {
        return Err("JWT signature invalid.".to_owned());
    }

    let header: Value =
        serde_json::from_slice(&base64url_decode(parts[0])?).map_err(|error| error.to_string())?;
    if header.get("alg").and_then(Value::as_str) != Some("HS256") {
        return Err("JWT alg must be HS256.".to_owned());
    }

    let payload: Value =
        serde_json::from_slice(&base64url_decode(parts[1])?).map_err(|error| error.to_string())?;
    let exp = payload
        .get("exp")
        .and_then(Value::as_i64)
        .ok_or_else(|| "JWT exp claim is required.".to_owned())?;

    if exp <= parse_epoch_seconds(now.unwrap_or("1970-01-01T00:00:00.000Z")) {
        return Err("JWT expired.".to_owned());
    }

    Ok(payload)
}

fn recover_evm_address(raw_message: &str, signature_hex: &str) -> Result<String, String> {
    let signature =
        hex::decode(signature_hex.trim_start_matches("0x")).map_err(|e| e.to_string())?;
    if signature.len() != 65 {
        return Err("Expected a 65-byte EVM signature.".to_owned());
    }

    let recovery_byte = if signature[64] >= 27 {
        signature[64] - 27
    } else {
        signature[64]
    };
    let recovery_id =
        RecoveryId::try_from(recovery_byte).map_err(|_| "Invalid recovery id.".to_owned())?;
    let compact = Signature::from_slice(&signature[0..64]).map_err(|e| e.to_string())?;
    let digest = ethereum_personal_message_hash(raw_message.as_bytes());
    let verifying_key = VerifyingKey::recover_from_prehash(&digest, &compact, recovery_id)
        .map_err(|e| e.to_string())?;

    Ok(evm_address_from_key(&verifying_key))
}

fn verify_sui_signature(
    raw_message: &[u8],
    serialized_signature: &str,
    expected_address: &str,
) -> Result<(), String> {
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(serialized_signature)
        .map_err(|e| e.to_string())?;
    if decoded.len() != 97 || decoded[0] != 0 {
        return Err("Only serialized Ed25519 Sui signatures are supported.".to_owned());
    }

    let public_key: [u8; 32] = decoded[65..97].try_into().map_err(|_| "bad key")?;
    let signature = Ed25519Signature::from_slice(&decoded[1..65]).map_err(|e| e.to_string())?;
    let address = sui_address_from_public_key(&public_key);
    if address != expected_address {
        return Err("Sui public key does not match address.".to_owned());
    }

    let digest = sui_personal_message_digest(raw_message);
    let key = Ed25519PublicKey::from_bytes(&public_key).map_err(|e| e.to_string())?;
    key.verify(&digest, &signature).map_err(|e| e.to_string())
}

fn ethereum_personal_message_hash(raw_message: &[u8]) -> [u8; 32] {
    let prefix = format!("\x19Ethereum Signed Message:\n{}", raw_message.len());
    let mut hasher = Keccak256::new();
    Digest::update(&mut hasher, prefix.as_bytes());
    Digest::update(&mut hasher, raw_message);
    hasher.finalize().into()
}

fn evm_address_from_key(key: &VerifyingKey) -> String {
    let encoded = key.to_encoded_point(false);
    let public_key = encoded.as_bytes();
    let mut hasher = Keccak256::new();
    Digest::update(&mut hasher, &public_key[1..]);
    let digest = hasher.finalize();
    checksum_evm_address(&format!("0x{}", hex::encode(&digest[12..]))).expect("valid address")
}

fn checksum_evm_address(address: &str) -> Result<String, String> {
    let raw = address.trim_start_matches("0x").to_ascii_lowercase();
    if raw.len() != 40 || hex::decode(&raw).is_err() {
        return Err("Invalid EVM address.".to_owned());
    }

    let mut hasher = Keccak256::new();
    Digest::update(&mut hasher, raw.as_bytes());
    let hash = hex::encode(hasher.finalize());
    let mut checked = String::with_capacity(42);
    checked.push_str("0x");

    for (index, char) in raw.chars().enumerate() {
        if char.is_ascii_hexdigit()
            && char.is_ascii_alphabetic()
            && u8::from_str_radix(&hash[index..index + 1], 16).unwrap_or(0) >= 8
        {
            checked.push(char.to_ascii_uppercase());
        } else {
            checked.push(char);
        }
    }

    Ok(checked)
}

fn sui_personal_message_digest(raw_message: &[u8]) -> [u8; 32] {
    let mut intent_message = vec![3, 0, 0];
    intent_message.extend(uleb128(raw_message.len() as u64));
    intent_message.extend(raw_message);
    blake2b256(&intent_message)
}

fn sui_address_from_public_key(public_key: &[u8; 32]) -> String {
    let mut bytes = vec![0];
    bytes.extend(public_key);
    format!("0x{}", hex::encode(blake2b256(&bytes)))
}

fn normalize_sui_address(address: &str) -> Result<String, String> {
    let raw = address.trim_start_matches("0x").to_ascii_lowercase();
    if raw.len() > 64 || hex::decode(&raw).is_err() {
        return Err("Invalid Sui address.".to_owned());
    }
    Ok(format!("0x{:0>64}", raw))
}

fn blake2b256(bytes: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut hasher = Blake2bVar::new(32).expect("valid BLAKE2b output size");
    Update::update(&mut hasher, bytes);
    hasher.finalize_variable(&mut out).expect("valid output");
    out
}

fn hmac_sha256(secret: &[u8], value: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(secret).expect("HMAC accepts any key length");
    Mac::update(&mut mac, value);
    mac.finalize().into_bytes().to_vec()
}

fn raw_evm_siwe_message(message: &SiwxMessage) -> String {
    if let Some(raw) = &message.raw {
        return raw.clone();
    }
    let mut lines = vec![
        format!(
            "{} wants you to sign in with your Ethereum account:",
            message.domain
        ),
        message.address.clone(),
        String::new(),
        format!("URI: {}", message.uri),
        format!("Version: {}", message.version),
        format!("Chain ID: {}", message.chain_id),
        format!("Nonce: {}", message.nonce),
        format!("Issued At: {}", message.issued_at),
    ];
    if let Some(expiration) = &message.expiration_time {
        lines.push(format!("Expiration Time: {}", expiration));
    }
    lines.join("\n")
}

fn raw_sui_personal_message(message: &SiwxMessage) -> String {
    if let Some(raw) = &message.raw {
        return raw.clone();
    }
    let mut lines = vec![
        "Dolphin ID Sui Sign-In".to_owned(),
        format!("Domain: {}", message.domain),
        format!(
            "Address: {}",
            normalize_sui_address(&message.address).unwrap_or_else(|_| message.address.clone())
        ),
        format!("Chain ID: {}", message.chain_id),
        format!("Nonce: {}", message.nonce),
        format!("URI: {}", message.uri),
        format!("Issued At: {}", message.issued_at),
    ];
    if let Some(expiration) = &message.expiration_time {
        lines.push(format!("Expiration Time: {}", expiration));
    }
    lines.join("\n")
}

fn base64url_decode(value: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|e| e.to_string())
}

fn is_expired(expiration: Option<&str>, now: Option<&str>) -> bool {
    match (expiration, now) {
        (Some(expiration), Some(now)) => {
            parse_epoch_seconds(expiration) <= parse_epoch_seconds(now)
        }
        _ => false,
    }
}

fn parse_epoch_seconds(value: &str) -> i64 {
    let normalized = value.replace(['-', ':'], "").replace(".000Z", "Z");
    let year = normalized[0..4].parse::<i64>().unwrap_or(1970);
    let month = normalized[4..6].parse::<i64>().unwrap_or(1);
    let day = normalized[6..8].parse::<i64>().unwrap_or(1);
    let hour = normalized[9..11].parse::<i64>().unwrap_or(0);
    let minute = normalized[11..13].parse::<i64>().unwrap_or(0);
    let second = normalized[13..15].parse::<i64>().unwrap_or(0);
    days_from_civil(year, month, day) * 86_400 + hour * 3_600 + minute * 60 + second
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = year - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let mp = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

fn uleb128(mut value: u64) -> Vec<u8> {
    let mut out = Vec::new();
    while value >= 0x80 {
        out.push(((value & 0x7f) as u8) | 0x80);
        value >>= 7;
    }
    out.push(value as u8);
    out
}
