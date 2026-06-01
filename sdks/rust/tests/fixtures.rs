use dolphin_id_server::{
    verify_evm_siwe_message, verify_jwt_session, verify_sui_personal_message, VerificationOptions,
    VerificationRequest,
};
use serde_json::Value;

fn fixtures() -> Value {
    serde_json::from_str(include_str!("../../fixtures/server-auth.json")).expect("fixture json")
}

#[test]
fn evm_fixture_matches_node_sdk() {
    let fixtures = fixtures();
    let request: VerificationRequest = serde_json::from_value(fixtures["evm"].clone()).unwrap();
    let options: VerificationOptions =
        serde_json::from_value(fixtures["evm"]["options"].clone()).unwrap();

    let result = verify_evm_siwe_message(&request, &options);

    assert!(result.ok, "{:?}", result.reason);
    assert_eq!(
        result.subject.as_deref(),
        fixtures["evm"]["expectedSubject"].as_str()
    );
}

#[test]
fn sui_fixture_matches_node_sdk() {
    let fixtures = fixtures();
    let request: VerificationRequest = serde_json::from_value(fixtures["sui"].clone()).unwrap();
    let options: VerificationOptions =
        serde_json::from_value(fixtures["sui"]["options"].clone()).unwrap();

    let result = verify_sui_personal_message(&request, &options);

    assert!(result.ok, "{:?}", result.reason);
    assert_eq!(
        result.subject.as_deref(),
        fixtures["sui"]["expectedSubject"].as_str()
    );
}

#[test]
fn jwt_fixture_matches_node_sdk() {
    let fixtures = fixtures();
    let payload = verify_jwt_session(
        fixtures["jwt"]["token"].as_str().unwrap(),
        fixtures["jwt"]["secret"].as_str().unwrap(),
        fixtures["jwt"]["now"].as_str(),
    )
    .unwrap();

    assert_eq!(payload["sub"], fixtures["jwt"]["expectedSubject"]);
    assert_eq!(payload["did_session_version"], 0);
    assert_eq!(payload["role"], "fixture");
}
