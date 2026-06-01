import json
from pathlib import Path

from dolphin_id_server import (
    verify_evm_siwe_message,
    verify_jwt_session,
    verify_sui_personal_message,
)


FIXTURES = json.loads(
    (Path(__file__).resolve().parents[2] / "fixtures" / "server-auth.json").read_text()
)


def test_evm_fixture_matches_node_sdk():
    result = verify_evm_siwe_message(FIXTURES["evm"], FIXTURES["evm"]["options"])

    assert result.ok
    assert result.subject == FIXTURES["evm"]["expectedSubject"]


def test_sui_fixture_matches_node_sdk():
    result = verify_sui_personal_message(FIXTURES["sui"], FIXTURES["sui"]["options"])

    assert result.ok
    assert result.subject == FIXTURES["sui"]["expectedSubject"]


def test_jwt_fixture_matches_node_sdk():
    payload = verify_jwt_session(
        FIXTURES["jwt"]["token"], FIXTURES["jwt"]["secret"], FIXTURES["jwt"]["now"]
    )

    assert payload["sub"] == FIXTURES["jwt"]["expectedSubject"]
    assert payload["did_session_version"] == 0
    assert payload["role"] == "fixture"
