import os
import pytest
import json

# Workaround for genlayer-test Windows PermissionError on os.unlink temp file
original_unlink = os.unlink
def safe_unlink(path, *args, **kwargs):
    try:
        original_unlink(path, *args, **kwargs)
    except PermissionError:
        pass
os.unlink = safe_unlink

@pytest.mark.direct
def test_irisyn_staking_rewards_and_burning(direct_deploy, direct_vm, direct_alice, direct_bob):
    # Deploy Irisyn contract
    contract = direct_deploy("irisyn_contract.py")
    
    # 1. Bob funds the treasury with 5 GEN to back Alice's rewards
    with direct_vm.prank(direct_bob):
        direct_vm.value = 5 * 10**18
        contract.fund_treasury()

    # ── Test Case 1: Valid Fact Proposal (Alice is Correct) ──
    evidence_url_1 = "https://pubmed.ncbi.nlm.nih.gov/123456"
    direct_vm.mock_web(evidence_url_1, {"body": "Studies show sunglasses block harmful UV rays and prevent macular damage.", "method": "GET", "status": 200})

    correct_consensus_json = json.dumps({
        "is_status_correct": True,
        "consensus_status": "VERIFIED",
        "consensus_remark": "Medically Validated Fact - Supported by peer-reviewed evidence.",
        "reasoning": "The evidence page validates that sunglasses protect from UV rays.",
        "clinical_relevance": "Prevents macular damage and cataract progression.",
        "anatomy_involved": ["Lens", "Retina"],
        "key_medical_facts": ["UV radiation accelerates macular damage.", "Cataracts are linked to high UV exposure."]
    })

    # Mock the LLM consensus
    import genlayer.gl as gl
    original_prompt = getattr(gl.eq_principle, 'prompt_non_comparative', None)
    gl.eq_principle.prompt_non_comparative = lambda prompt, task, criteria: correct_consensus_json

    try:
        # Alice proposes a correct claim with 1 GEN stake
        with direct_vm.prank(direct_alice):
            direct_vm.value = 1 * 10**18
            contract.propose_claim(
                "UV Sunglasses Protection",
                "Sunglasses with UV block prevent cataract progression and retina damage.",
                "Cataracts",
                "VERIFIED",
                evidence_url_1
            )
        
        # Verify Alice's rewards is set to 2 GEN (2 * 10**18 wei)
        alice_str = direct_alice.hex().lower()
        if not alice_str.startswith("0x"):
            alice_str = "0x" + alice_str
        assert int(contract.pending_rewards.get(alice_str, "0")) == 2 * 10**18

        # Verify claim exists in cache
        cached_str = contract.get_cached_claim("UV Sunglasses Protection")
        cached = json.loads(cached_str)
        assert cached["explanation"]["status"] == "VERIFIED"
        assert cached["explanation"]["remark"] == "Medically Validated Fact - Supported by peer-reviewed evidence."

        # ── Test Case 2: Invalid Fact Proposal (Bob is Incorrect -> Slashed and Burned) ──
        evidence_url_2 = "https://pubmed.ncbi.nlm.nih.gov/789012"
        direct_vm.mock_web(evidence_url_2, {"body": "Scientific consensus rejects staring at the sun; it causes immediate solar retinopathy and blindness.", "method": "GET", "status": 200})

        incorrect_consensus_json = json.dumps({
            "is_status_correct": False,
            "consensus_status": "DEBUNKED",
            "consensus_remark": "Slashing event: Proposed status did not align with actual evidence. Stake burned.",
            "reasoning": "Proposer claimed staring at the sun is VERIFIED, but evidence proves it is highly harmful.",
            "clinical_relevance": "Causes permanent solar retinopathy.",
            "anatomy_involved": ["Retina", "Macula"],
            "key_medical_facts": ["Staring at the sun burns the retina.", "It leads to permanent vision loss."]
        })

        # Mock the LLM consensus to return incorrect verification
        gl.eq_principle.prompt_non_comparative = lambda prompt, task, criteria: incorrect_consensus_json

        # Clear traces before transaction
        direct_vm._traces.clear()

        # Bob proposes that staring at the sun is "VERIFIED" (incorrect!) with 1 GEN stake
        with direct_vm.prank(direct_bob):
            direct_vm.value = 1 * 10**18
            contract.propose_claim(
                "Solar Vision Cure",
                "Staring at the sun for 5 minutes daily cures visual defects.",
                "General",
                "VERIFIED",
                evidence_url_2
            )

        # Verify Bob's rewards is still 0
        bob_str = direct_bob.hex().lower()
        if not bob_str.startswith("0x"):
            bob_str = "0x" + bob_str
        assert int(contract.pending_rewards.get(bob_str, "0")) == 0

        # Verify that an EthSend was emitted (burning the 1 GEN stake)
        found_burn = any(
            "EthSend" in str(t)
            for t in direct_vm._traces
        )
        assert found_burn, "Slashing transfer (burn) was not emitted."

        # ── Test Case 3: Reward Withdrawal ──
        # Clear traces
        direct_vm._traces.clear()

        # Alice withdraws her rewards
        with direct_vm.prank(direct_alice):
            direct_vm.value = 0
            contract.withdraw_rewards()

        # Verify Alice's pending rewards is now 0
        assert int(contract.pending_rewards.get(alice_str, "0")) == 0

        # Verify native transfer trace sending rewards
        found_payout = any(
            "EthSend" in str(t)
            for t in direct_vm._traces
        )
        assert found_payout, "Rewards payout transfer was not emitted."

    finally:
        if original_prompt:
            gl.eq_principle.prompt_non_comparative = original_prompt
