# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import dataclasses

@dataclasses.dataclass
class ConsensusResponse:
    is_status_correct: bool
    consensus_status: str
    consensus_remark: str
    reasoning: str
    clinical_relevance: str
    anatomy_involved: list[str]
    key_medical_facts: list[str]


@gl.evm.contract_interface
class _Recipient:
    class View: pass
    class Write: pass

class IrisynRegistry(gl.Contract):
    """
    IRISYN: Decentralized AI-powered Eye Health Fact-Checking and Claims Registry.

    ECONOMIC MODEL:
    - Stake 1 GEN to propose an eye health claim, condition, proposed status, and an evidence URL.
    - VERIFIED: Claim is medically proven and supported by scientific consensus.
    - DEBUNKED: Claim is medically false, ineffective, or hazardous.
    - UNVERIFIED: Claim lacks clinical evidence or has conflicting reports.
    
    If the AI consensus (using the Equivalence Principle) agrees that the proposer's classification matches the 
    evidence URL and general ophthalmology guidelines, the proposer earns 2 GEN (1 GEN stake + 1 GEN reward).
    Otherwise, the 1 GEN stake is burned to the null address.
    """

    # ── Storage ───────────────────────────────────────────────────
    claims_registry:  TreeMap[str, str]   # claim_id (lower_case) -> JSON claim details
    user_history:     TreeMap[str, str]   # lower(address) -> JSON history of submissions
    pending_rewards:  TreeMap[str, str]   # lower(address) -> wei reward balance
    total_pending_rewards: str            # Global outstanding reward obligations
    total_rewards_paid: str               # Global total rewards claimed/withdrawn
    total_claims:     u256                # Registered claims counter
    condition_index:  TreeMap[str, str]   # lower(condition) -> JSON list of claim_ids
    recent_claims_list: str               # JSON list of recent claim_ids

    def __init__(self):
        self.total_claims = u256(0)
        self.total_pending_rewards = "0"
        self.total_rewards_paid = "0"
        self.recent_claims_list = json.dumps([])

    # ── Helpers ───────────────────────────────────────────────────

    @staticmethod
    def _addr(a) -> str:
        """Return a normalized lower-case string for any address-like value."""
        return str(a).lower()

    @staticmethod
    def _normalize_str(s: str) -> str:
        """Helper to clean and lower case search/id strings."""
        return s.strip().lower()

    # ── Core Staking & AI Validation ──────────────────────────────

    @gl.public.write.payable
    def fund_treasury(self):
        """Allow anyone to deposit GEN into the contract treasury to fund rewards."""
        pass

    @gl.public.write.payable
    def propose_claim(self, claim_title: str, claim_text: str, condition: str, proposed_status: str, evidence_url: str):
        caller = gl.message.sender_address
        stake = gl.message.value
        ONE_GEN = 1000000000000000000  # 1 GEN in wei

        if stake < ONE_GEN:
            raise Exception("Must stake at least 1 GEN to propose a claim.")

        clean_title = claim_title.strip()
        clean_text = claim_text.strip()
        clean_condition = condition.strip()
        clean_status = proposed_status.strip().upper()  # VERIFIED, DEBUNKED, UNVERIFIED
        clean_url = evidence_url.strip()

        if not clean_title or not clean_text or not clean_condition or not clean_url:
            raise Exception("Claim title, description, condition, and evidence URL are required.")

        if clean_status not in ["VERIFIED", "DEBUNKED", "UNVERIFIED"]:
            raise Exception("Proposed status must be VERIFIED, DEBUNKED, or UNVERIFIED.")

        claim_id = self._normalize_str(clean_title)

        is_challenge = False
        existing_status = ""
        if claim_id in self.claims_registry:
            is_challenge = True
            try:
                existing_claim = json.loads(self.claims_registry[claim_id])
                existing_status = existing_claim["explanation"]["status"].strip().upper()
            except Exception:
                existing_status = ""
            
            if clean_status == existing_status:
                raise Exception(f"This claim is already registered in the registry with status '{existing_status}'. To challenge it, you must propose a different classification status.")

        # Check treasury balance to back the potential 2x reward (stake + 1 GEN reward)
        try:
            current_balance = gl.get_self_balance()
        except AttributeError:
            current_balance = 9999999999999999999999

        current_total_pending = int(self.total_pending_rewards)
        if current_balance < current_total_pending + (int(stake) * 2):
            raise Exception("Contract treasury does not have enough uncommitted funds to back this reward.")

        # ── AI Validation Prompt via Equivalence Principle ──
        def build_prompt() -> str:
            # Fetch the actual web page content inside the non-deterministic block
            web_data = gl.nondet.web.render(clean_url, mode='text')
            
            challenge_section = ""
            if is_challenge:
                challenge_section = f"""
*** CHALLENGE MODE ACTIVE ***
This proposal is a formal CHALLENGE to an already registered claim in the database.
Current Registered Classification Status: "{existing_status}"
Challenger's Proposed Update Status: "{clean_status}"
Challenger's Evidence URL: "{clean_url}"

Your job is to determine if the challenger's proposed status "{clean_status}" is the correct classification for this claim, superseding the old status of "{existing_status}". Set "is_status_correct" to true ONLY if the challenger's status "{clean_status}" is indeed the correct scientific/medical classification and the registry should be updated.
"""

            return f"""You are a professional, authoritative scientific fact-checker for the IRISYN Eye Health Facts Registry.
Your task is to evaluate a proposed eye health claim and its proposed medical status against a provided evidence URL and general ophthalmology consensus.

Claim Title: "{clean_title}"
Claim Details: "{clean_text}"
Ophthalmic Condition: "{clean_condition}"
Proposed Classification Status: "{clean_status}"
Evidence Citation URL: "{clean_url}"
{challenge_section}

--- EVIDENCE WEBPAGE RAW CONTENT ---
{web_data}
------------------------------------

VALIDATION INSTRUCTIONS:
1. Analyze the evidence page content. Check if the URL is a reputable medical source (e.g., .gov, .org, .edu, reputable medical journals, AAO.org, WHO, NIH/NEI).
2. INDEPENDENT CORROBORATION: You MUST independently corroborate the claim against recognized medical sources based on your internal medical knowledge (e.g., WHO, AAO, NIH guidelines) to strengthen the trust model.
3. LOGICAL AGREEMENT REQUIREMENT: The 'is_status_correct' flag, your 'consensus_status', the proposer's classification, the existing stored status (if challenging), and your source-grounded 'reasoning' MUST logically agree. If they contradict, the validation is invalid.
4. Assess if the proposed claim is scientifically accurate regarding the human eye, eye health, medical science, and visual hygiene.
5. Compare the proposed classification status ("VERIFIED", "DEBUNKED", or "UNVERIFIED") with what the source states and general ophthalmology consensus:
   - VERIFIED: The claim is scientifically proven, safe, and supported by peer-reviewed evidence and standard eye care guidelines.
   - DEBUNKED: The claim is medically false, disproven, ineffective, dangerous, or a known myth.
   - UNVERIFIED: The claim lacks sufficient clinical trials, has conflicting studies, or is an unproven hypothesis.
6. Provide a detailed "reasoning" from the webpage, a "clinical_relevance" for eye health, list the eye structures involved (e.g., "Cornea", "Lens", "Retina", "Optic Nerve", "Macula") in "anatomy_involved", and extract 2-3 "key_medical_facts".

Return ONLY a valid JSON object matching this schema:
{
    "is_status_correct": false,
    "consensus_status": "DEBUNKED",
    "consensus_remark": "Remark detailing the classification outcome and general medical advice.",
    "reasoning": "Detailed breakdown comparing the claim to the citation text.",
    "clinical_relevance": "Ophthalmological explanation of how this claim affects vision or optical health.",
    "anatomy_involved": [],
    "key_medical_facts": []
}
"""

        result_str = gl.eq_principle.prompt_non_comparative(
            build_prompt,
            task="Fact-check the proposed eye health claim using the evidence URL.",
            criteria=(
                "The consensus MUST strictly output JSON. The 'is_status_correct' flag, "
                "proposed classification, stored status, and source-grounded reasoning MUST "
                "logically agree. Independent corroboration from recognized medical sources "
                "MUST be performed."
            )
        )

        # ── Parse AI output ──
        try:
            cleaned = result_str.strip()
            if "```" in cleaned:
                s = cleaned.find("{"); e = cleaned.rfind("}") + 1
                if s >= 0 and e > s:
                    cleaned = cleaned[s:e]
            data_dict = json.loads(cleaned)
            # Strictly type and enforce schema structure natively
            data_obj = ConsensusResponse(
                is_status_correct=bool(data_dict.get("is_status_correct", False)),
                consensus_status=str(data_dict.get("consensus_status", "UNVERIFIED")),
                consensus_remark=str(data_dict.get("consensus_remark", "")),
                reasoning=str(data_dict.get("reasoning", "")),
                clinical_relevance=str(data_dict.get("clinical_relevance", "")),
                anatomy_involved=list(data_dict.get("anatomy_involved", [])),
                key_medical_facts=list(data_dict.get("key_medical_facts", []))
            )
            data = dataclasses.asdict(data_obj)
        except Exception:
            data = {}

        is_status_correct = bool(data.get("is_status_correct", False))
        consensus_status = data.get("consensus_status", clean_status).upper()
        if consensus_status not in ["VERIFIED", "DEBUNKED", "UNVERIFIED"]:
            consensus_status = "UNVERIFIED"

        # Provide fallback remarks if JSON parse didn't return one
        fallback_remarks = {
            "VERIFIED": "Medically Validated Fact - Supported by Peer-Reviewed Scientific Research and clinical guidelines.",
            "DEBUNKED": "Medical Warning - Myth Debunked by Ophthalmology Consensus. Groundless or hazardous for eye health.",
            "UNVERIFIED": "Insufficient Evidence - Unproven medical hypothesis. Requires further clinical validation and trials."
        }
        consensus_remark = data.get("consensus_remark", fallback_remarks.get(consensus_status, ""))

        safe_exp = {
            "title": clean_title,
            "claim_text": clean_text,
            "condition": clean_condition,
            "status": consensus_status,
            "remark": consensus_remark,
            "reasoning": data.get("reasoning", "Evidence page could not be parsed fully."),
            "clinical_relevance": data.get("clinical_relevance", "Consult an ophthalmologist for professional diagnostics."),
            "anatomy_involved": data.get("anatomy_involved", []) if isinstance(data.get("anatomy_involved"), list) else [],
            "key_medical_facts": data.get("key_medical_facts", []) if isinstance(data.get("key_medical_facts"), list) else [],
            "evidence_url": clean_url
        }

        caller_str = self._addr(caller)
        stake_int = int(stake)

        if is_status_correct:
            # Proposer correctly classified the claim -> Refund of stake + standard 1 GEN reward
            reward_wei = stake_int + ONE_GEN
            
            # Track the reward
            current = int(self.pending_rewards.get(caller_str, "0"))
            self.pending_rewards[caller_str] = str(current + reward_wei)
            
            # Update total pending rewards
            current_total = int(self.total_pending_rewards)
            self.total_pending_rewards = str(current_total + reward_wei)

            # Save to global registry
            self.claims_registry[claim_id] = json.dumps({
                "explanation": safe_exp,
                "validator_consensus": True,
                "proposer": caller_str,
                "stake_wei": str(stake_int)
            })

            # Update condition indexing
            cond_key = self._normalize_str(clean_condition)
            try:
                cond_list = json.loads(self.condition_index[cond_key]) if cond_key in self.condition_index else []
                if not isinstance(cond_list, list): cond_list = []
            except Exception:
                cond_list = []
            if claim_id not in cond_list:
                cond_list.append(claim_id)
                self.condition_index[cond_key] = json.dumps(cond_list)

            # Update recent claims
            try:
                recent = json.loads(self.recent_claims_list)
                if not isinstance(recent, list): recent = []
            except Exception:
                recent = []
            if claim_id not in recent:
                recent.insert(0, claim_id)
                if len(recent) > 20: recent = recent[:20]
                self.recent_claims_list = json.dumps(recent)

            self._record(caller_str, claim_id, clean_title, consensus_status, consensus_remark, True)
            if not is_challenge:
                self.total_claims += 1
        else:
            # Proposer was incorrect or spamming -> Burn the stake to null address
            _Recipient(Address("0x0000000000000000000000000000000000000000")).emit_transfer(value=u256(stake_int), on='finalized')
            
            self._record(caller_str, claim_id, clean_title, consensus_status, 
                         data.get("reasoning", "Proposed status did not align with actual evidence. Stake burned."), False)

    # ── Write: Withdraw Rewards ──────────────────────────────────

    @gl.public.write
    def withdraw_rewards(self) -> None:
        """Allows users to withdraw their accumulated rewards."""
        caller = gl.message.sender_address
        caller_str = self._addr(caller)
        
        pending_str = self.pending_rewards.get(caller_str, "0")
        pending_amount = int(pending_str)
        
        if pending_amount == 0:
            raise Exception("No rewards available to withdraw.")
            
        # Checks-Effects-Interactions pattern
        self.pending_rewards[caller_str] = "0"
        
        current_total = int(self.total_pending_rewards)
        self.total_pending_rewards = str(current_total - pending_amount)
        
        current_paid = int(self.total_rewards_paid)
        self.total_rewards_paid = str(current_paid + pending_amount)
        
        # Emit transfer
        _Recipient(caller).emit_transfer(value=u256(pending_amount), on='finalized')

    # ── Views ─────────────────────────────────────────────────────

    @gl.public.view
    def get_pending_reward(self, user_address: str) -> str:
        key = user_address.strip().lower()
        return self.pending_rewards[key] if key in self.pending_rewards else "0"

    @gl.public.view
    def get_cached_claim(self, claim_title: str) -> str:
        k = self._normalize_str(claim_title)
        return self.claims_registry[k] if k in self.claims_registry else json.dumps({"found": False})

    @gl.public.view
    def get_user_history(self, user_address: str) -> str:
        k = user_address.strip().lower()
        return self.user_history[k] if k in self.user_history else "[]"

    @gl.public.view
    def get_stats(self) -> str:
        try:
            current_balance = gl.get_self_balance()
        except AttributeError:
            current_balance = 0
            
        return json.dumps({
            "total_claims": int(self.total_claims),
            "platform": "IRISYN",
            "network": "GenLayer Studio",
            "treasury_wei": str(current_balance),
            "pending_rewards_wei": self.total_pending_rewards,
            "rewards_paid_wei": self.total_rewards_paid
        })

    @gl.public.view
    def get_recent_claims(self) -> str:
        return self.recent_claims_list

    @gl.public.view
    def get_claims_by_condition(self, condition: str) -> str:
        k = self._normalize_str(condition)
        if k not in self.condition_index:
            return json.dumps([])
        try:
            ids = json.loads(self.condition_index[k])
            claims = []
            for claim_id in ids:
                if claim_id in self.claims_registry:
                    claims.append(json.loads(self.claims_registry[claim_id]))
            return json.dumps(claims)
        except Exception:
            return json.dumps([])

    # ── Internal ──────────────────────────────────────────────────

    def _record(self, caller_str: str, claim_id: str, title: str, status: str, remark: str, accepted: bool):
        try:
            hist = json.loads(self.user_history[caller_str]) if caller_str in self.user_history else []
            if not isinstance(hist, list): hist = []
        except Exception:
            hist = []
            
        hist.append({
            "claim_id": claim_id,
            "title": title,
            "status": status,
            "remark": remark,
            "accepted": accepted,
            "timestamp": str(gl.message.timestamp) if hasattr(gl.message, "timestamp") else "0"
        })
        
        if len(hist) > 50: hist = hist[-50:]
        self.user_history[caller_str] = json.dumps(hist)
