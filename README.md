# 👁️ IRISYN — Decentralized Eye Health Fact Registry

Irisyn is an AI-validated, on-chain registry for eye health claims, medical facts, and visual hygiene statements built on **GenLayer Studio**.

---

## 🌐 Deployed Contract Address
The Intelligent Contract is successfully deployed on the GenLayer Studio network:
- **Contract Address:** `0xb884223B54ebbe5e51a5f8F8A45a1f7B0cd35B24`

---

## ✨ Features
- 🔐 **Wallet-Gated Dashboard:** Connect MetaMask to GenLayer Studio Network (Chain ID `61999` / `0xF22F`).
- 🤖 **Staked AI Consensus:** Proposers stake `1.00 GEN` to submit a claim, classification (`VERIFIED`, `DEBUNKED`, or `UNVERIFIED`), and evidence URL. The protocol leverages the **Equivalence Principle** to perform real-time web scraping and fact-checking.
- 💰 **Economic Incentive Design:** If the validator consensus confirms the proposer's classification, the proposer receives a reward of `2.00 GEN` (refund + reward). If incorrect, the stake is permanently burned to `0x00...000`.
- 🩺 **Classification Remarks:** Each verification result returns a customized, authoritative ophthalmology remark explaining the medical rationale.
- 🎨 **Frictionless Glassmorphism UI:** Sky-blue gradient theme (`#e0f2fe` to `#7dd3fc`) with high backdrop blurs, floating light animations, and responsive sliding panel drawer panels.
- 👁️ **Interactive Anatomy Map:** Custom interactive vector SVG of the human eye (Cornea, Iris, Lens, Retina, Optic Nerve) linked to medical condition profiles and sight preservation guidelines.

---

## 📁 Project Structure
```
irisyn/
├── index.html          # Landing page & core metrics
├── registry.html       # Statement index search, categories & submission panel
├── portfolio.html      # User submission history, balances & reward claims
├── anatomy.html        # Interactive SVG guide to human eye anatomy
├── style.css           # Global design system (sky blue glassmorphism)
├── app.js              # Wallet Hooks, contract reads/writes & tx polling
├── irisyn_contract.py  # GenLayer Intelligent Contract in Python
├── genlayer_bundle.js  # Compiled GenLayer Web3 SDK Client
├── vercel.json         # Vercel static routing configurations
└── package.json        # Local serving configurations
```

---

## 🚀 Deployment & Local Run

### Local Environment Setup
To serve the website locally at `http://localhost:3000`:
1. Open PowerShell / Command Prompt inside this folder.
2. Run npm install and run the development script:
   ```bash
   npm install
   npm run dev
   ```

### Deploy to Vercel
Irisyn is fully configured for Vercel deployment:
1. Make sure you have the Vercel CLI installed globally:
   ```bash
   npm install -g vercel
   ```
2. Deploy directly:
   ```bash
   vercel --prod
   ```
   Or push the repository to GitHub and connect it via the Vercel dashboard.

---

## 🔗 GenLayer Network Setup (MetaMask)
To interact with the smart contract, add the GenLayer Studio network to your MetaMask wallet:

| Parameter | Value |
|---|---|
| **Network Name** | GenLayer Studio |
| **New RPC URL** | `https://studio.genlayer.com/api` |
| **Chain ID** | `61999` (Hex: `0xF22F`) |
| **Currency Symbol** | `GEN` |

*Note: The wallet connection flow automatically prompts your MetaMask to switch or add this network on connect.*

---

## 🎯 Verification Workflow
1. Navigate to **Fact Registry** -> click **Verify a New Claim**.
2. Fill out the statement details:
   - *Example:* "Staring at the sun cures cataracts"
   - *Condition:* "Cataracts"
   - *Classification:* "DEBUNKED"
   - *Evidence URL:* `https://www.aao.org/eye-health/tips-prevention/sun-exposure-eye-damage`
3. Click **Submit** and approve the MetaMask pop-up (requires `1.00 GEN` deposit).
4. Watch the consensus loader scan your claim. Nodes will fetch the evidence, run consensus, and update the ledger.
5. If consensus agrees, check your **Investigator Panel** and click **Claim Payout** to withdraw your `2.00 GEN` reward.
