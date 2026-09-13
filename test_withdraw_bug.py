
import json
import pytest

@pytest.mark.direct
def test_withdraw_inbalance(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = direct_deploy('irisyn_contract.py')
    import genlayer.gl as gl

    # Fund treasury with 5 GEN
    with direct_vm.prank(direct_bob):
        direct_vm.value = 5 * 10**18
        contract.fund_treasury()

    # Mocks
    direct_vm.mock_web('.*esearch.*', {'body': '{"esearchresult": {"idlist": ["123456"]}}', 'method': 'GET', 'status': 200})
    direct_vm.mock_web('.*efetch.*', {'body': 'General medical text', 'method': 'GET', 'status': 200})
    direct_vm.mock_web('.*test.com.*', {'body': 'test', 'method': 'GET', 'status': 200})

    correct_json = {
        'is_status_correct': True, 'consensus_status': 'VERIFIED',
        'consensus_remark': '...', 'reasoning': '...',
        'clinical_relevance': '...', 'anatomy_involved': [], 'key_medical_facts': []
    }
    
    original_prompt = getattr(gl.eq_principle, 'prompt_non_comparative', None)
    gl.eq_principle.prompt_non_comparative = lambda prompt, task, criteria: json.dumps(correct_json)
    
    try:
        # Alice proposes
        with direct_vm.prank(direct_alice):
            direct_vm.value = 1 * 10**18
            contract.propose_claim('Test Title', 'Test text', 'Test Condition', 'VERIFIED', 'https://test.com')

        # Alice tries to withdraw
        with direct_vm.prank(direct_alice):
            contract.withdraw_rewards()
    finally:
        if original_prompt:
            gl.eq_principle.prompt_non_comparative = original_prompt
