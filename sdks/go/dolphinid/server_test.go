package dolphinid

import (
	"encoding/json"
	"os"
	"testing"
)

type fixtureFile struct {
	EVM struct {
		VerificationRequest
		ExpectedSubject string              `json:"expectedSubject"`
		Options         VerificationOptions `json:"options"`
	} `json:"evm"`
	Sui struct {
		VerificationRequest
		ExpectedSubject string              `json:"expectedSubject"`
		Options         VerificationOptions `json:"options"`
	} `json:"sui"`
	JWT struct {
		Secret          string         `json:"secret"`
		Token           string         `json:"token"`
		ExpectedSubject string         `json:"expectedSubject"`
		ExpectedClaims  map[string]any `json:"expectedClaims"`
		Now             string         `json:"now"`
	} `json:"jwt"`
}

func loadFixtures(t *testing.T) fixtureFile {
	t.Helper()

	raw, err := os.ReadFile("../../fixtures/server-auth.json")
	if err != nil {
		t.Fatal(err)
	}

	var fixtures fixtureFile
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	return fixtures
}

func TestEVMFixtureMatchesNodeSDK(t *testing.T) {
	fixtures := loadFixtures(t)
	result := VerifyEvmSiweMessage(fixtures.EVM.VerificationRequest, fixtures.EVM.Options)

	if !result.OK {
		t.Fatalf("expected ok, got %s", result.Reason)
	}
	if result.Subject != fixtures.EVM.ExpectedSubject {
		t.Fatalf("subject mismatch: %s", result.Subject)
	}
}

func TestSuiFixtureMatchesNodeSDK(t *testing.T) {
	fixtures := loadFixtures(t)
	result := VerifySuiPersonalMessage(fixtures.Sui.VerificationRequest, fixtures.Sui.Options)

	if !result.OK {
		t.Fatalf("expected ok, got %s", result.Reason)
	}
	if result.Subject != fixtures.Sui.ExpectedSubject {
		t.Fatalf("subject mismatch: %s", result.Subject)
	}
}

func TestJWTFixtureMatchesNodeSDK(t *testing.T) {
	fixtures := loadFixtures(t)
	payload, err := VerifyJWTSession(fixtures.JWT.Token, fixtures.JWT.Secret, fixtures.JWT.Now)
	if err != nil {
		t.Fatal(err)
	}

	if payload["sub"] != fixtures.JWT.ExpectedSubject {
		t.Fatalf("subject mismatch: %s", payload["sub"])
	}
	if intClaim(payload["did_session_version"]) != 0 {
		t.Fatalf("session version mismatch: %v", payload["did_session_version"])
	}
	if payload["role"] != "fixture" {
		t.Fatalf("role mismatch: %v", payload["role"])
	}
}
