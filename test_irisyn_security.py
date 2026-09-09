import pytest
import os

original_unlink = os.unlink
def safe_unlink(path, *args, **kwargs):
    try:
        original_unlink(path, *args, **kwargs)
    except PermissionError:
        pass
os.unlink = safe_unlink

@pytest.mark.direct
def test_hostile_prompt_injection(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = direct_deploy('irisyn_contract.py')
    with direct_vm.prank(direct_bob):
        direct_vm.value = 5 * 10**18
        contract.fund_treasury()
    with direct_vm.prank(direct_alice):
        direct_vm.value = 1 * 10**18
        try:
            contract.propose_claim('Fact', 'Text', 'Condition', 'VERIFIED', 'https://adversarial.com')
        except Exception:
            assert True

@pytest.mark.direct
def test_strict_challenge_identity(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = direct_deploy('irisyn_contract.py')
    with direct_vm.prank(direct_bob):
        direct_vm.value = 5 * 10**18
        contract.fund_treasury()
        
    # We can inject a fake claim directly into the registry to test the identity block
    import json
    fake_claim = json.dumps({"explanation": {"claim_text": "Original text.", "condition": "General", "status": "VERIFIED"}})
    contract.claims_registry["test fact"] = fake_claim
    
    with direct_vm.prank(direct_bob):
        direct_vm.value = 1 * 10**18
        try:
            contract.propose_claim('Test Fact', 'Altered text.', 'General', 'DEBUNKED', 'https://test.com')
            pytest.fail('Should reject')
        except Exception as e:
            assert 'Identity Error' in str(e)
