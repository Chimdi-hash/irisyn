/* ===================================================
   IRISYN — Frontend JavaScript Core
   GenLayer Studio Integration & UI Animations
   =================================================== */

// ── GenLayer Studio Config ──
const GENLAYER_CONFIG = {
  chainId: '0xF22F',        // 61999 in hex
  chainIdDec: 61999,
  chainName: 'GenLayer Studio',
  rpcUrls: ['https://studio.genlayer.com/api'],
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18
  },
  blockExplorerUrls: []
};

// Deployed Irisyn Intelligent Contract Address
const CONTRACT_ADDRESS = '0xb884223B54ebbe5e51a5f8F8A45a1f7B0cd35B24';

// ── Wallet State ──
window.irisynWallet = {
  address: null,
  isConnected: false,
  chainId: null,
};

let allClaims = [];
let filteredClaims = [];
let currentCategory = 'all';

// ── Toast Notifications ──
function showToast(message, type = 'info', duration = 4000) {
  let toast = document.getElementById('irisyn-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'irisyn-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  const icons = {
    success: '✅',
    error: '❌',
    info: '👁️',
    warning: '⚠️'
  };

  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-size:1.1rem">${icons[type] || '🧬'}</span>
    <span>${message}</span>
  `;

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ── Connect Wallet ──
async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showToast('Please install MetaMask to use IRISYN.', 'error');
    window.open('https://metamask.io/', '_blank');
    return false;
  }

  try {
    showToast('Connecting to wallet...', 'info');

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    if (!accounts || accounts.length === 0) {
      showToast('No accounts found. Please unlock MetaMask.', 'error');
      return false;
    }

    // Switch/Add GenLayer Studio Network
    await switchToGenLayer();

    window.irisynWallet.address = accounts[0];
    window.irisynWallet.isConnected = true;

    localStorage.setItem('irisyn_wallet', accounts[0]);
    localStorage.setItem('irisyn_connected', 'true');

    updateWalletUI();
    showToast(`Connected: ${shortenAddress(accounts[0])}`, 'success');

    // Trigger local updates
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'portfolio.html') {
      await loadPortfolioDetails();
    } else if (currentPage === 'registry.html') {
      await loadRegistryClaims();
    }

    // Listen for changes
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return true;
  } catch (err) {
    if (err.code === 4001) {
      showToast('Wallet connection rejected by user.', 'warning');
    } else {
      showToast(`Connection error: ${err.message}`, 'error');
    }
    return false;
  }
}

// ── Switch to GenLayer Studio Network ──
async function switchToGenLayer() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: GENLAYER_CONFIG.chainId }]
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [GENLAYER_CONFIG]
        });
      } catch (addError) {
        showToast('Could not add GenLayer network. Please configure manually.', 'error');
        throw addError;
      }
    } else if (switchError.code === 4001) {
      showToast('Please switch to the GenLayer Studio network.', 'warning');
    }
  }
}

// ── Disconnect Wallet ──
function disconnectWallet() {
  window.irisynWallet = {
    address: null,
    isConnected: false,
    chainId: null,
  };

  localStorage.removeItem('irisyn_wallet');
  localStorage.removeItem('irisyn_connected');

  updateWalletUI();
  showToast('Wallet disconnected.', 'info');

  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage === 'portfolio.html' || currentPage === 'registry.html') {
    setTimeout(() => window.location.reload(), 1200);
  }
}
window.disconnectWallet = disconnectWallet;
window.connectWallet = connectWallet;

// ── Event Handlers ──
function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else if (accounts[0] !== window.irisynWallet.address) {
    window.irisynWallet.address = accounts[0];
    localStorage.setItem('irisyn_wallet', accounts[0]);
    updateWalletUI();
    showToast(`Account switched: ${shortenAddress(accounts[0])}`, 'info');
    window.location.reload();
  }
}

function handleChainChanged(chainId) {
  window.irisynWallet.chainId = chainId;
  if (chainId !== GENLAYER_CONFIG.chainId && chainId !== GENLAYER_CONFIG.chainId.toLowerCase()) {
    showToast('Please switch back to GenLayer Studio.', 'warning');
  } else {
    window.location.reload();
  }
}

// ── Restore Session ──
async function restoreWalletSession() {
  if (typeof window.ethereum === 'undefined') return;
  if (localStorage.getItem('irisyn_connected') !== 'true') return;

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      window.irisynWallet.address = accounts[0];
      window.irisynWallet.isConnected = true;
      updateWalletUI();
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
  } catch (err) {
    console.warn('Could not restore wallet session:', err);
  }
}

// ── Update Navbar Wallet UI ──
async function updateWalletUI() {
  const connectBtns = document.querySelectorAll('.btn-connect-wallet');
  const walletInfos = document.querySelectorAll('.wallet-info-bar');
  const walletAddrEls = document.querySelectorAll('.wallet-address-display');
  const walletBalEls = document.querySelectorAll('.wallet-balance-display');

  const isConnected = window.irisynWallet.isConnected && window.irisynWallet.address;
  const address = window.irisynWallet.address;

  let bal = '0.00 GEN';
  if (isConnected && window.getNativeBalance) {
    try {
      const nativeBal = await window.getNativeBalance(address);
      bal = `${parseFloat(nativeBal).toFixed(2)} GEN`;
    } catch (e) {
      bal = '0.00 GEN';
    }
  }

  connectBtns.forEach(btn => {
    btn.style.display = isConnected ? 'none' : 'inline-flex';
  });

  walletInfos.forEach(info => {
    info.style.display = isConnected ? 'flex' : 'none';
  });

  walletAddrEls.forEach(el => {
    el.textContent = shortenAddress(address);
  });

  walletBalEls.forEach(el => {
    el.textContent = bal;
  });
}

// ── Utilities ──
function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Counter animation
function animateCounter(element, target, suffix = "", duration = 1500) {
  const start = 0;
  const step = target / (duration / 16);
  let current = start;

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current).toLocaleString() + suffix;
  }, 16);
}

// ── Particles System ──
function initParticles(containerId, count = 25) {
  const container = document.getElementById(containerId);
  if (!container) return;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const size = Math.random() * 4 + 1;
    const x = Math.random() * 100;
    const duration = Math.random() * 15 + 10;
    const delay = Math.random() * 15;
    const opacity = Math.random() * 0.3 + 0.1;

    // Sky blue/white soft particles
    const isBlue = Math.random() > 0.5;
    const color = isBlue
      ? `rgba(14, 165, 233, ${opacity})`
      : `rgba(255, 255, 255, ${opacity * 0.8})`;

    particle.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}%;
      background: ${color};
      box-shadow: 0 0 ${size * 3}px ${color};
      animation-duration: ${duration}s;
      animation-delay: -${delay}s;
    `;

    container.appendChild(particle);
  }
}

// ── Hamburger Toggle Menu ──
function initNavbarToggle() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.classList.toggle('active');
    });
  }
}

// ── Wait for finalization status on GenLayer ──
async function waitForGenLayerFinalized(txHash, updateStepsCallback) {
  const MAX_WAIT_MS = 600000; // 10 minutes
  const POLL_MS = 4000;
  const start = Date.now();
  let step = 1; // 1: Sign (done), 2: Scrape, 3: Consensus, 4: Finalize

  if (updateStepsCallback) updateStepsCallback(step);

  while (Date.now() - start < MAX_WAIT_MS) {
    await sleep(POLL_MS);
    
    // Simulate progression of visual steps or read tx logs
    const elapsed = Date.now() - start;
    if (elapsed > 10000 && step === 1 && updateStepsCallback) {
      step = 2; // Move to scrape
      updateStepsCallback(step);
    }
    if (elapsed > 25000 && step === 2 && updateStepsCallback) {
      step = 3; // Move to consensus
      updateStepsCallback(step);
    }

    try {
      const resp = await fetch(GENLAYER_CONFIG.rpcUrls[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionByHash',
          params: [txHash],
          id: 1
        })
      });
      const data = await resp.json();
      
      if (data && data.result) {
        const tx = data.result;
        const status = (tx.status || '').toUpperCase();
        
        if (status === 'ACCEPTED' || status === 'FINALIZED') {
          if (updateStepsCallback) updateStepsCallback(4); // Completed!
          return { isFinalized: true, isSuccess: true, isError: false };
        }
        
        if (status === 'ERROR' || status === 'CANCELLED') {
          return { isFinalized: true, isSuccess: false, isError: true };
        }
      }
    } catch (e) {
      console.warn('Transaction status poll error:', e);
    }
  }
  return { isFinalized: false, isSuccess: false, isError: false, timedOut: true };
}

// ── REGISTRY SCRIPTS (registry.html) ──

function openProposalPanel() {
  const panel = document.getElementById('proposal-panel');
  const backdrop = document.getElementById('panel-backdrop');
  if (panel && backdrop) {
    panel.classList.add('active');
    backdrop.classList.add('active');
  }
}

function closeProposalPanel() {
  const panel = document.getElementById('proposal-panel');
  const backdrop = document.getElementById('panel-backdrop');
  if (panel && backdrop) {
    panel.classList.remove('active');
    backdrop.classList.remove('active');
  }
}

function resetFormState() {
  document.getElementById('panel-state-form').style.display = 'flex';
  document.getElementById('panel-state-loading').style.display = 'none';
  document.getElementById('panel-state-result').style.display = 'none';

  // Clear inputs
  document.getElementById('claim-title').value = '';
  document.getElementById('claim-url').value = '';
  document.getElementById('claim-text').value = '';
}

// Visual indicator steps update
function updateConsensusVisualSteps(currentStep) {
  const stepIds = ['step-tx', 'step-scrape', 'step-consensus', 'step-finalize'];
  
  // Set titles
  const titles = {
    1: ['Signing Staked Proposal', 'Please approve the transaction in MetaMask.'],
    2: ['Scraping Authoritative Evidence', 'Consensus nodes are pulling content from the citation URL.'],
    3: ['Running Validator Consensus', 'LLM nodes are checking claims against ophthalmic guidelines.'],
    4: ['Finalizing On-Chain State', 'Verification completed. Writing statement to GenLayer ledger.']
  };

  const titleEl = document.getElementById('loading-title');
  const subEl = document.getElementById('loading-subtitle');
  if (titleEl && titles[currentStep]) titleEl.textContent = titles[currentStep][0];
  if (subEl && titles[currentStep]) subEl.textContent = titles[currentStep][1];

  for (let i = 0; i < stepIds.length; i++) {
    const el = document.getElementById(stepIds[i]);
    if (!el) continue;
    
    if (i + 1 < currentStep) {
      el.className = 'consensus-step completed';
    } else if (i + 1 === currentStep) {
      el.className = 'consensus-step active';
    } else {
      el.className = 'consensus-step';
    }
  }
}

// Submit proposal
async function submitClaimProposal() {
  const title = document.getElementById('claim-title').value.trim();
  const condition = document.getElementById('claim-condition').value;
  const status = document.getElementById('claim-status').value;
  const url = document.getElementById('claim-url').value.trim();
  const text = document.getElementById('claim-text').value.trim();

  if (!title || !url || !text) {
    showToast('Please fill out the Title, Evidence URL, and Claim details.', 'warning');
    return;
  }

  // Connect check
  if (!window.irisynWallet.isConnected) {
    showToast('Connect your wallet first.', 'warning');
    const connected = await connectWallet();
    if (!connected) return;
  }

  // Transition UI to Loader
  document.getElementById('panel-state-form').style.display = 'none';
  document.getElementById('panel-state-loading').style.display = 'flex';
  updateConsensusVisualSteps(1);

  try {
    if (!window.callGenLayer) throw new Error('GenLayer Web3 SDK not loaded.');

    // Pre-check if claim title already exists (free view read)
    try {
      const exists = await window.readGenLayer(CONTRACT_ADDRESS, 'get_cached_claim', [title]);
      const data = typeof exists === 'string' ? JSON.parse(exists) : exists;
      if (data && data.explanation) {
        showToast('Claim already exists! Showing cached record.', 'info');
        renderConsensusResult(data.explanation);
        return;
      }
    } catch(e) { console.warn('Precheck view call failed (non-fatal)', e); }

    // Submit write payable (1 GEN stake)
    showToast('Sign proposal in MetaMask...', 'info');
    const txHash = await window.callGenLayer(
      CONTRACT_ADDRESS,
      'propose_claim',
      [title, text, condition, status, url],
      window.irisynWallet.address,
      "1000000000000000000" // 1 GEN in Wei
    );

    showToast(`Signed! Tx: ${txHash.slice(0, 10)}... Running AI Fact Scan...`, 'success', 8000);
    
    // Poll for finalization
    const receipt = await waitForGenLayerFinalized(txHash, updateConsensusVisualSteps);

    if (receipt.isError) {
      showToast('Consensus execution failed. Check proposal parameters.', 'error');
      resetFormState();
      return;
    }

    // Wait 2s for state update
    await sleep(2000);

    // Read result
    const resultObj = await window.readGenLayer(CONTRACT_ADDRESS, 'get_cached_claim', [title]);
    const parsedResult = typeof resultObj === 'string' ? JSON.parse(resultObj) : resultObj;

    if (parsedResult && parsedResult.explanation) {
      showToast('Verification successfully finalized on-chain!', 'success');
      renderConsensusResult(parsedResult.explanation);
    } else {
      // Check if proposer was wrong -> stake burned (not cached as valid)
      // Check user history to see if it was recorded as rejected
      const historyStr = await window.readGenLayer(CONTRACT_ADDRESS, 'get_user_history', [window.irisynWallet.address]);
      const history = typeof historyStr === 'string' ? JSON.parse(historyStr) : historyStr;
      
      const rejectedClaim = history.find(h => h.title.trim().toLowerCase() === title.trim().toLowerCase() && !h.accepted);
      if (rejectedClaim) {
        showToast('Your proposal was REJECTED by consensus. 1 GEN stake was burned.', 'error', 8000);
        renderConsensusResult({
          title: title,
          claim_text: text,
          condition: condition,
          status: rejectedClaim.status || 'DEBUNKED',
          remark: rejectedClaim.remark || 'Slashing event: Proposed status did not align with actual evidence. Stake burned.',
          reasoning: 'The AI consensus validators inspected the citation URL and evaluated that the proposed classification did not match scientific evidence. As a result, the statement was rejected and the proposal stake was burned.',
          clinical_relevance: 'Always ensure your claims match peer-reviewed facts prior to proposing.',
          anatomy_involved: [],
          key_medical_facts: [],
          evidence_url: url
        });
      } else {
        throw new Error('Verification details could not be found.');
      }
    }

    // Refresh wallet UI balance
    await updateWalletUI();

  } catch (err) {
    showToast(`Proposal error: ${err.message}`, 'error');
    console.error(err);
    resetFormState();
  }
}

// Display result card details
function renderConsensusResult(exp) {
  document.getElementById('panel-state-loading').style.display = 'none';
  document.getElementById('panel-state-result').style.display = 'flex';

  const statusEl = document.getElementById('result-status-text');
  const remarkCont = document.getElementById('result-remark-container');

  statusEl.textContent = exp.status;
  remarkCont.className = 'result-card-remark';
  
  if (exp.status === 'VERIFIED') {
    remarkCont.classList.add('result-remark-verified');
  } else if (exp.status === 'DEBUNKED') {
    remarkCont.classList.add('result-remark-debunked');
  } else {
    remarkCont.classList.add('result-remark-unverified');
  }

  document.getElementById('result-title').textContent = exp.title;
  document.getElementById('result-remark-text').textContent = exp.remark;
  document.getElementById('result-reasoning').textContent = exp.reasoning;
  document.getElementById('result-relevance').textContent = exp.clinical_relevance;

  // Render anatomy badges
  const anatomyList = document.getElementById('result-anatomy-list');
  const anatomyCont = document.getElementById('result-anatomy-container');
  anatomyList.innerHTML = '';
  if (exp.anatomy_involved && exp.anatomy_involved.length > 0) {
    anatomyCont.style.display = 'block';
    exp.anatomy_involved.forEach(part => {
      const badge = document.createElement('span');
      badge.className = 'claim-condition-badge';
      badge.textContent = part;
      anatomyList.appendChild(badge);
    });
  } else {
    anatomyCont.style.display = 'none';
  }

  // Render facts
  const factsList = document.getElementById('result-facts-list');
  const factsCont = document.getElementById('result-facts-container');
  factsList.innerHTML = '';
  if (exp.key_medical_facts && exp.key_medical_facts.length > 0) {
    factsCont.style.display = 'block';
    exp.key_medical_facts.forEach(fact => {
      const li = document.createElement('li');
      li.textContent = fact;
      factsList.appendChild(li);
    });
  } else {
    factsCont.style.display = 'none';
  }

  // Set citation URL
  const link = document.getElementById('result-citation-url');
  link.href = exp.evidence_url;
  link.textContent = exp.evidence_url.length > 30 ? exp.evidence_url.slice(0, 30) + '...' : exp.evidence_url;

  // Refresh database list if on registry page
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage === 'registry.html') {
    loadRegistryClaims();
  }
}

// Load Registry Claims
async function loadRegistryClaims() {
  const displayGrid = document.getElementById('claims-display-grid');
  if (!displayGrid) return;

  try {
    if (!window.readGenLayer) {
      displayGrid.innerHTML = `
        <div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
          <h3>Web3 SDK Not Found</h3>
          <p style="color:var(--mid-gray); margin-top:0.5rem;">Reload the page or try installing MetaMask.</p>
        </div>`;
      return;
    }

    // Call get_recent_claims view
    const rawIds = await window.readGenLayer(CONTRACT_ADDRESS, 'get_recent_claims', []);
    const claimIds = typeof rawIds === 'string' ? JSON.parse(rawIds) : rawIds;

    if (!claimIds || claimIds.length === 0) {
      displayGrid.innerHTML = `
        <div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
          <svg style="width:64px;height:64px;fill:var(--sky-500);margin-bottom:1.5rem;" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          <h3>Registry is Empty</h3>
          <p style="color:var(--mid-gray); margin-top:0.5rem;">Be the first investigator to propose a claim verification and earn GEN rewards!</p>
        </div>`;
      return;
    }

    allClaims = [];
    for (const claimId of claimIds) {
      try {
        const rawClaim = await window.readGenLayer(CONTRACT_ADDRESS, 'get_cached_claim', [claimId]);
        const claimObj = typeof rawClaim === 'string' ? JSON.parse(rawClaim) : rawClaim;
        if (claimObj && claimObj.explanation) {
          allClaims.push(claimObj.explanation);
        }
      } catch(err) { console.error('Failed reading claim', claimId, err); }
    }

    applyFilterAndRender();

  } catch(e) {
    console.error('Failed reading registry:', e);
    displayGrid.innerHTML = `
      <div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
        <h3>Registry Loading Error</h3>
        <p style="color:var(--debunked-color); margin-top:0.5rem;">Error: ${e.message}</p>
      </div>`;
  }
}

// Filter Claims
function handleSearch() {
  applyFilterAndRender();
}

function applyFilterAndRender() {
  const searchVal = (document.getElementById('registry-search')?.value || '').trim().toLowerCase();
  const displayGrid = document.getElementById('claims-display-grid');
  if (!displayGrid) return;

  // Filter list
  filteredClaims = allClaims.filter(claim => {
    // Category match
    const categoryMatch = currentCategory === 'all' || 
      claim.condition.trim().toLowerCase() === currentCategory.trim().toLowerCase() ||
      (currentCategory === 'myopia' && claim.condition.toLowerCase().includes('myopia'));
    
    // Search query match
    const searchMatch = !searchVal || 
      claim.title.toLowerCase().includes(searchVal) ||
      claim.claim_text.toLowerCase().includes(searchVal) ||
      claim.condition.toLowerCase().includes(searchVal);

    return categoryMatch && searchMatch;
  });

  // Render cards
  if (filteredClaims.length === 0) {
    displayGrid.innerHTML = `
      <div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
        <h3>No Statements Found</h3>
        <p style="color:var(--mid-gray); margin-top:0.5rem;">Try adjusting your keyword filter or condition category.</p>
      </div>`;
    return;
  }

  displayGrid.innerHTML = '';
  filteredClaims.forEach(claim => {
    const card = document.createElement('div');
    card.className = 'glass-card claim-card';
    
    const badgeClass = claim.status === 'VERIFIED' ? 'status-verified' : 
                       claim.status === 'DEBUNKED' ? 'status-debunked' : 'status-unverified';

    card.innerHTML = `
      <div class="claim-header">
        <span class="claim-condition-badge">${claim.condition}</span>
        <span class="status-badge ${badgeClass}">
          <span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span>
          ${claim.status}
        </span>
      </div>
      <h3 class="claim-title">${claim.title}</h3>
      <p class="claim-text-excerpt">${claim.claim_text}</p>
      <div style="font-size:0.8rem; border-top:1px solid rgba(0,0,0,0.05); padding-top:0.75rem; margin-bottom:1rem; color:var(--dark-gray);">
        <strong>Remark:</strong> ${claim.remark}
      </div>
      <div class="claim-card-footer">
        <a href="${claim.evidence_url}" target="_blank" class="claim-source-link">
          <svg style="width:14px;height:14px;fill:currentColor;" viewBox="0 0 24 24">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
          ${claim.evidence_url.length > 22 ? claim.evidence_url.slice(0, 22) + '...' : claim.evidence_url}
        </a>
        <button class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="viewClaimDetails('${claim.title}')">
          Details
        </button>
      </div>
    `;
    displayGrid.appendChild(card);
  });
}

// View details for a card in the drawer
async function viewClaimDetails(title) {
  openProposalPanel();
  document.getElementById('panel-state-form').style.display = 'none';
  document.getElementById('panel-state-loading').style.display = 'flex';
  updateConsensusVisualSteps(1);

  try {
    const rawClaim = await window.readGenLayer(CONTRACT_ADDRESS, 'get_cached_claim', [title]);
    const claimObj = typeof rawClaim === 'string' ? JSON.parse(rawClaim) : rawClaim;
    if (claimObj && claimObj.explanation) {
      renderConsensusResult(claimObj.explanation);
    }
  } catch(e) {
    showToast('Failed to retrieve statement details.', 'error');
    closeProposalPanel();
  }
}

// ── PORTFOLIO SCRIPTS (portfolio.html) ──

async function loadPortfolioDetails() {
  const elBalance = document.getElementById('portfolio-wallet-balance');
  const elCount = document.getElementById('portfolio-claims-submitted');
  const elRewards = document.getElementById('portfolio-pending-rewards');
  const elRows = document.getElementById('portfolio-history-rows');
  const elClaimBtn = document.getElementById('btn-claim-rewards');

  if (!window.irisynWallet.isConnected) return;

  try {
    // 1. Balance
    const bal = await window.getNativeBalance(window.irisynWallet.address);
    if (elBalance) elBalance.textContent = `${parseFloat(bal).toFixed(2)} GEN`;

    // 2. Pending Rewards
    const rawRew = await window.readGenLayer(CONTRACT_ADDRESS, 'get_pending_reward', [window.irisynWallet.address]);
    const rewWei = parseInt(rawRew || "0");
    const rewGEN = rewWei / 1e18;
    
    if (elRewards) elRewards.textContent = `${rewGEN.toFixed(2)} GEN`;
    
    if (elClaimBtn) {
      elClaimBtn.textContent = `Claim Payout (${rewGEN.toFixed(2)} GEN)`;
      if (rewGEN > 0) {
        elClaimBtn.removeAttribute('disabled');
      } else {
        elClaimBtn.setAttribute('disabled', 'true');
      }
    }

    // 3. User History Table
    const rawHist = await window.readGenLayer(CONTRACT_ADDRESS, 'get_user_history', [window.irisynWallet.address]);
    const history = typeof rawHist === 'string' ? JSON.parse(rawHist) : rawHist;

    if (elCount) elCount.textContent = history.length;

    if (!history || history.length === 0) {
      if (elRows) {
        elRows.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 3rem 1rem; color: var(--mid-gray);">
              No submissions registered yet. Go to the Registry to make a proposal!
            </td>
          </tr>`;
      }
      return;
    }

    if (elRows) {
      elRows.innerHTML = '';
      history.forEach(item => {
        const row = document.createElement('tr');
        
        const badgeClass = item.status === 'VERIFIED' ? 'status-verified' : 
                           item.status === 'DEBUNKED' ? 'status-debunked' : 'status-unverified';
        
        const outcomeText = item.accepted ? '+1.00 GEN Reward' : 'Stashed Lost (Burned)';
        const outcomeStyle = item.accepted ? 'color:var(--verified-color); font-weight:700;' : 'color:var(--debunked-color); opacity:0.85;';

        row.innerHTML = `
          <td style="font-weight:600;">${item.title}</td>
          <td>Ophthalmology</td>
          <td><span class="status-badge ${badgeClass}">${item.status}</span></td>
          <td style="${outcomeStyle}">${outcomeText}</td>
          <td>
            <button class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="viewClaimDetails('${item.title}')">
              View Consensus
            </button>
          </td>
        `;
        elRows.appendChild(row);
      });
    }

  } catch(e) {
    console.error('Failed reading user profile info:', e);
    showToast('Failed to load investigator portfolio data.', 'error');
  }
}

// Withdraw rewards call
async function withdrawRewards() {
  const elClaimBtn = document.getElementById('btn-claim-rewards');
  if (elClaimBtn) elClaimBtn.setAttribute('disabled', 'true');
  
  showToast('Please sign the withdrawal transaction in MetaMask...', 'info');

  try {
    const txHash = await window.callGenLayer(
      CONTRACT_ADDRESS,
      'withdraw_rewards',
      [],
      window.irisynWallet.address,
      "0" // 0 value needed
    );

    showToast(`Withdrawal broadcasted! Tx: ${txHash.slice(0, 10)}... waiting for finalization.`, 'info');
    
    // Wait for receipt
    const receipt = await waitForGenLayerFinalized(txHash);

    if (receipt.isSuccess) {
      showToast('GEN rewards successfully withdrawn to your wallet!', 'success');
    } else {
      showToast('Withdrawal failed.', 'error');
    }

    // Refresh UI
    await loadPortfolioDetails();
    await updateWalletUI();

  } catch (err) {
    showToast(`Withdrawal error: ${err.message}`, 'error');
    console.error(err);
    if (elClaimBtn) elClaimBtn.removeAttribute('disabled');
  }
}

// ── DOM Initialization ──
document.addEventListener('DOMContentLoaded', async () => {
  initNavbarToggle();
  initParticles('particle-field', 35);
  await restoreWalletSession();

  // Scroll active navbar scroll effect
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  });

  // Attach button listeners (handles both desktop and mobile dropdown views)
  document.querySelectorAll('.btn-connect-wallet').forEach(btn => {
    btn.addEventListener('click', connectWallet);
  });

  document.querySelectorAll('.btn-disconnect-wallet').forEach(btn => {
    btn.addEventListener('click', disconnectWallet);
  });

  // Load screen-specific data
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage === 'registry.html') {
    await loadRegistryClaims();

    // Attach filter category chips
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentCategory = chip.getAttribute('data-condition');
        applyFilterAndRender();
      });
    });
  } else if (currentPage === 'portfolio.html') {
    await loadPortfolioDetails();
  }
});
