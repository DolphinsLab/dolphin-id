package dolphinid

import (
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"golang.org/x/crypto/blake2b"
)

type SiwxMessage struct {
	Format         string `json:"format"`
	ChainType      string `json:"chainType"`
	Domain         string `json:"domain"`
	Address        string `json:"address"`
	URI            string `json:"uri"`
	Version        string `json:"version"`
	ChainID        string `json:"chainId"`
	Nonce          string `json:"nonce"`
	IssuedAt       string `json:"issuedAt"`
	ExpirationTime string `json:"expirationTime,omitempty"`
	Raw            string `json:"raw,omitempty"`
}

type VerificationRequest struct {
	Message   SiwxMessage `json:"message"`
	Signature string      `json:"signature"`
	Nonce     string      `json:"nonce"`
}

type VerificationOptions struct {
	ExpectedDomain  string `json:"expectedDomain,omitempty"`
	ExpectedAddress string `json:"expectedAddress,omitempty"`
	ExpectedChainID string `json:"expectedChainId,omitempty"`
	Now             string `json:"now,omitempty"`
}

type VerificationResult struct {
	OK      bool
	Subject string
	Reason  string
}

func VerifyEvmSiweMessage(request VerificationRequest, options VerificationOptions) VerificationResult {
	message := request.Message

	if message.ChainType != "evm" {
		return failed("SIWE message chain type must be evm.")
	}
	if message.Nonce != request.Nonce {
		return failed("SIWE nonce mismatch.")
	}
	if options.ExpectedDomain != "" && message.Domain != options.ExpectedDomain {
		return failed("SIWE domain mismatch.")
	}
	if options.ExpectedChainID != "" && message.ChainID != options.ExpectedChainID {
		return failed("SIWE chainId mismatch.")
	}
	if !common.IsHexAddress(message.Address) {
		return failed("SIWE address is invalid.")
	}

	address := common.HexToAddress(message.Address).Hex()
	if options.ExpectedAddress != "" && address != common.HexToAddress(options.ExpectedAddress).Hex() {
		return failed("SIWE address mismatch.")
	}
	if message.ExpirationTime == "" {
		return failed("SIWE expirationTime is required.")
	}
	if isExpired(message.ExpirationTime, options.Now) {
		return failed("SIWE message expired.")
	}

	recovered, err := RecoverEvmAddress(rawEvmSiweMessage(message), request.Signature)
	if err != nil || recovered != address {
		return failed("SIWE signature is invalid.")
	}

	return VerificationResult{OK: true, Subject: address}
}

func VerifySuiPersonalMessage(request VerificationRequest, options VerificationOptions) VerificationResult {
	message := request.Message

	if message.ChainType != "sui" {
		return failed("Sui message chain type must be sui.")
	}
	if message.Nonce != request.Nonce {
		return failed("Sui nonce mismatch.")
	}

	address, err := NormalizeSuiAddress(message.Address)
	if err != nil {
		return failed("Sui address is invalid.")
	}
	if options.ExpectedAddress != "" {
		expected, err := NormalizeSuiAddress(options.ExpectedAddress)
		if err != nil || expected != address {
			return failed("Sui address mismatch.")
		}
	}
	if options.ExpectedChainID != "" && message.ChainID != options.ExpectedChainID {
		return failed("Sui chain identifier mismatch.")
	}
	if message.ExpirationTime == "" {
		return failed("Sui expirationTime is required.")
	}
	if isExpired(message.ExpirationTime, options.Now) {
		return failed("Sui message expired.")
	}

	if err := VerifySuiSignature([]byte(rawSuiPersonalMessage(message)), request.Signature, address); err != nil {
		return failed("Sui signature is invalid.")
	}

	return VerificationResult{OK: true, Subject: address}
}

func VerifyJWTSession(token string, secret string, now string) (map[string]any, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("JWT must have three segments")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(parts[0] + "." + parts[1]))
	expected := mac.Sum(nil)
	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, err
	}
	if !hmac.Equal(expected, actual) {
		return nil, errors.New("JWT signature invalid")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, err
	}
	var header map[string]any
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, err
	}
	if header["alg"] != "HS256" {
		return nil, errors.New("JWT alg must be HS256")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}
	var payload map[string]any
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, err
	}
	if exp, ok := payload["exp"].(float64); !ok || int64(exp) <= parseTime(now).Unix() {
		return nil, errors.New("JWT expired")
	}

	return payload, nil
}

func RecoverEvmAddress(rawMessage string, signatureHex string) (string, error) {
	signature, err := hex.DecodeString(strings.TrimPrefix(signatureHex, "0x"))
	if err != nil {
		return "", err
	}
	if len(signature) != 65 {
		return "", errors.New("expected a 65-byte EVM signature")
	}
	if signature[64] >= 27 {
		signature[64] -= 27
	}

	publicKey, err := crypto.SigToPub(accounts.TextHash([]byte(rawMessage)), signature)
	if err != nil {
		return "", err
	}

	return crypto.PubkeyToAddress(*publicKey).Hex(), nil
}

func VerifySuiSignature(rawMessage []byte, serializedSignature string, expectedAddress string) error {
	decoded, err := base64.StdEncoding.DecodeString(serializedSignature)
	if err != nil {
		return err
	}
	if len(decoded) != 97 || decoded[0] != 0 {
		return errors.New("only serialized Ed25519 Sui signatures are supported")
	}

	signature := decoded[1:65]
	publicKey := decoded[65:97]
	address := SuiAddressFromPublicKey(publicKey)
	if address != expectedAddress {
		return errors.New("Sui public key does not match address")
	}

	digest := SuiPersonalMessageDigest(rawMessage)
	if !ed25519.Verify(publicKey, digest[:], signature) {
		return errors.New("Sui signature is invalid")
	}

	return nil
}

func SuiPersonalMessageDigest(rawMessage []byte) [32]byte {
	intentMessage := []byte{3, 0, 0}
	intentMessage = append(intentMessage, uleb128(uint64(len(rawMessage)))...)
	intentMessage = append(intentMessage, rawMessage...)
	return blake2b.Sum256(intentMessage)
}

func SuiAddressFromPublicKey(publicKey []byte) string {
	bytes := append([]byte{0}, publicKey...)
	digest := blake2b.Sum256(bytes)
	return "0x" + hex.EncodeToString(digest[:])
}

func NormalizeSuiAddress(address string) (string, error) {
	raw := strings.ToLower(strings.TrimPrefix(address, "0x"))
	if len(raw) > 64 {
		return "", errors.New("invalid Sui address")
	}
	if _, err := hex.DecodeString(raw); err != nil {
		return "", err
	}
	return "0x" + strings.Repeat("0", 64-len(raw)) + raw, nil
}

func failed(reason string) VerificationResult {
	return VerificationResult{OK: false, Reason: reason}
}

func rawEvmSiweMessage(message SiwxMessage) string {
	if message.Raw != "" {
		return message.Raw
	}
	lines := []string{
		fmt.Sprintf("%s wants you to sign in with your Ethereum account:", message.Domain),
		message.Address,
		"",
		"URI: " + message.URI,
		"Version: " + message.Version,
		"Chain ID: " + message.ChainID,
		"Nonce: " + message.Nonce,
		"Issued At: " + message.IssuedAt,
	}
	if message.ExpirationTime != "" {
		lines = append(lines, "Expiration Time: "+message.ExpirationTime)
	}
	return strings.Join(lines, "\n")
}

func rawSuiPersonalMessage(message SiwxMessage) string {
	if message.Raw != "" {
		return message.Raw
	}
	address, err := NormalizeSuiAddress(message.Address)
	if err != nil {
		address = message.Address
	}
	lines := []string{
		"Dolphin ID Sui Sign-In",
		"Domain: " + message.Domain,
		"Address: " + address,
		"Chain ID: " + message.ChainID,
		"Nonce: " + message.Nonce,
		"URI: " + message.URI,
		"Issued At: " + message.IssuedAt,
	}
	if message.ExpirationTime != "" {
		lines = append(lines, "Expiration Time: "+message.ExpirationTime)
	}
	return strings.Join(lines, "\n")
}

func isExpired(expiration string, now string) bool {
	if now == "" {
		return false
	}
	return !parseTime(expiration).After(parseTime(now))
}

func parseTime(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err == nil {
		return parsed
	}
	parsed, err = time.Parse(time.RFC3339, value)
	if err == nil {
		return parsed
	}
	return time.Unix(0, 0)
}

func uleb128(value uint64) []byte {
	out := []byte{}
	for value >= 0x80 {
		out = append(out, byte(value&0x7f)|0x80)
		value >>= 7
	}
	return append(out, byte(value))
}

func intClaim(value any) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case json.Number:
		out, _ := strconv.ParseInt(string(typed), 10, 64)
		return out
	default:
		return 0
	}
}
