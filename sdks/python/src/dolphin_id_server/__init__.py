from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from eth_keys import keys
from eth_utils import keccak


@dataclass(frozen=True)
class VerificationResult:
    ok: bool
    subject: str | None = None
    reason: str | None = None


def verify_evm_siwe_message(
    request: Mapping[str, Any],
    options: Mapping[str, Any] | None = None,
) -> VerificationResult:
    options = options or {}
    message = request["message"]

    if message.get("chainType") != "evm":
        return VerificationResult(False, reason="SIWE message chain type must be evm.")
    if message.get("nonce") != request.get("nonce"):
        return VerificationResult(False, reason="SIWE nonce mismatch.")
    if options.get("expectedDomain") and message.get("domain") != options["expectedDomain"]:
        return VerificationResult(False, reason="SIWE domain mismatch.")
    if options.get("expectedChainId") and str(message.get("chainId")) != str(
        options["expectedChainId"]
    ):
        return VerificationResult(False, reason="SIWE chainId mismatch.")

    address = checksum_address(message["address"])
    if options.get("expectedAddress") and address != checksum_address(options["expectedAddress"]):
        return VerificationResult(False, reason="SIWE address mismatch.")
    if not message.get("expirationTime"):
        return VerificationResult(False, reason="SIWE expirationTime is required.")
    if _parse_time(message["expirationTime"]) <= _parse_time(options.get("now")):
        return VerificationResult(False, reason="SIWE message expired.")

    raw = raw_evm_siwe_message(message)
    try:
        recovered = recover_evm_address(raw, request["signature"])
    except Exception:
        return VerificationResult(False, reason="SIWE signature is invalid.")

    if recovered != address:
        return VerificationResult(False, reason="SIWE signature is invalid.")

    return VerificationResult(True, subject=address)


def verify_sui_personal_message(
    request: Mapping[str, Any],
    options: Mapping[str, Any] | None = None,
) -> VerificationResult:
    options = options or {}
    message = request["message"]

    if message.get("chainType") != "sui":
        return VerificationResult(False, reason="Sui message chain type must be sui.")
    if message.get("nonce") != request.get("nonce"):
        return VerificationResult(False, reason="Sui nonce mismatch.")

    address = normalize_sui_address(message["address"])
    if options.get("expectedAddress") and address != normalize_sui_address(
        options["expectedAddress"]
    ):
        return VerificationResult(False, reason="Sui address mismatch.")
    if options.get("expectedChainId") and message.get("chainId") != options["expectedChainId"]:
        return VerificationResult(False, reason="Sui chain identifier mismatch.")
    if not message.get("expirationTime"):
        return VerificationResult(False, reason="Sui expirationTime is required.")
    if _parse_time(message["expirationTime"]) <= _parse_time(options.get("now")):
        return VerificationResult(False, reason="Sui message expired.")

    try:
        verify_sui_signature(raw_sui_personal_message(message), request["signature"], address)
    except Exception:
        return VerificationResult(False, reason="Sui signature is invalid.")

    return VerificationResult(True, subject=address)


def verify_jwt_session(token: str, secret: str, now: str | datetime | None = None) -> Mapping[str, Any]:
    header_segment, payload_segment, signature_segment = token.split(".")
    signing_input = f"{header_segment}.{payload_segment}".encode()
    expected = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    actual = _base64url_decode(signature_segment)

    if not hmac.compare_digest(expected, actual):
        raise ValueError("JWT signature invalid.")

    header = json.loads(_base64url_decode(header_segment))
    if header.get("alg") != "HS256":
        raise ValueError("JWT alg must be HS256.")

    payload = json.loads(_base64url_decode(payload_segment))
    if int(payload["exp"]) <= int(_parse_time(now).timestamp()):
        raise ValueError("JWT expired.")

    return payload


def recover_evm_address(raw_message: str, signature_hex: str) -> str:
    signature = bytes.fromhex(signature_hex.removeprefix("0x"))
    if len(signature) != 65:
        raise ValueError("Expected a 65-byte EVM signature.")

    v = signature[64]
    if v >= 27:
        v -= 27

    sig = keys.Signature(signature[:64] + bytes([v]))
    digest = keccak(b"\x19Ethereum Signed Message:\n" + str(len(raw_message)).encode() + raw_message.encode())
    return sig.recover_public_key_from_msg_hash(digest).to_checksum_address()


def verify_sui_signature(raw_message: str, serialized_signature: str, expected_address: str) -> None:
    decoded = base64.b64decode(serialized_signature)
    if len(decoded) != 97 or decoded[0] != 0:
        raise ValueError("Only serialized Ed25519 Sui signatures are supported.")

    signature = decoded[1:65]
    public_key = decoded[65:97]
    address = sui_address_from_public_key(public_key)
    if address != expected_address:
        raise ValueError("Sui public key does not match address.")

    digest = sui_personal_message_digest(raw_message.encode())
    Ed25519PublicKey.from_public_bytes(public_key).verify(signature, digest)


def sui_personal_message_digest(raw_message: bytes) -> bytes:
    intent_message = b"\x03\x00\x00" + _uleb128(len(raw_message)) + raw_message
    return hashlib.blake2b(intent_message, digest_size=32).digest()


def sui_address_from_public_key(public_key: bytes) -> str:
    digest = hashlib.blake2b(b"\x00" + public_key, digest_size=32).hexdigest()
    return f"0x{digest}"


def checksum_address(address: str) -> str:
    raw = address.removeprefix("0x")
    if len(raw) != 40:
        raise ValueError("Invalid EVM address.")
    lower = raw.lower()
    hashed = keccak(text=lower).hex()
    checked = "".join(
        char.upper() if int(hashed[index], 16) >= 8 else char
        for index, char in enumerate(lower)
    )
    return f"0x{checked}"


def normalize_sui_address(address: str) -> str:
    raw = address.lower().removeprefix("0x")
    if len(raw) > 64:
        raise ValueError("Invalid Sui address.")
    int(raw, 16)
    return f"0x{raw.zfill(64)}"


def raw_evm_siwe_message(message: Mapping[str, Any]) -> str:
    if message.get("raw"):
        return message["raw"]
    lines = [
        f"{message['domain']} wants you to sign in with your Ethereum account:",
        message["address"],
        "",
        f"URI: {message['uri']}",
        f"Version: {message['version']}",
        f"Chain ID: {message['chainId']}",
        f"Nonce: {message['nonce']}",
        f"Issued At: {message['issuedAt']}",
    ]
    if message.get("expirationTime"):
        lines.append(f"Expiration Time: {message['expirationTime']}")
    return "\n".join(lines)


def raw_sui_personal_message(message: Mapping[str, Any]) -> str:
    if message.get("raw"):
        return message["raw"]
    lines = [
        "Dolphin ID Sui Sign-In",
        f"Domain: {message['domain']}",
        f"Address: {normalize_sui_address(message['address'])}",
        f"Chain ID: {message['chainId']}",
        f"Nonce: {message['nonce']}",
        f"URI: {message['uri']}",
        f"Issued At: {message['issuedAt']}",
    ]
    if message.get("expirationTime"):
        lines.append(f"Expiration Time: {message['expirationTime']}")
    return "\n".join(lines)


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _parse_time(value: str | datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _uleb128(value: int) -> bytes:
    out = bytearray()
    while value >= 0x80:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    out.append(value)
    return bytes(out)
