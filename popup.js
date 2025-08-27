class SolanaWalletScanner {
  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.heliusApiKey = CONFIG.HELIUS_API_KEY;
    this.heliusEndpoint = CONFIG.HELIUS_ENDPOINT;

    // Check if API key is configured
    if (this.heliusApiKey === "YOUR_HELIUS_API_KEY") {
      this.showError("Please configure your Helius API key in config.js");
    }
  }

  initializeElements() {
    this.walletInput = document.getElementById("walletAddress");
    this.scanButton = document.getElementById("scanButton");
    this.errorMessage = document.getElementById("errorMessage");
    this.loadingSpinner = document.getElementById("loadingSpinner");
    this.results = document.getElementById("results");
    this.tokenCount = document.getElementById("tokenCount");
    this.fungibleTokens = document.getElementById("fungibleTokens");
    this.nftTokens = document.getElementById("nftTokens");
    this.recentTransactions = document.getElementById("recentTransactions");
    this.transactionsHeader = document.getElementById("transactionsHeader");
  }

  bindEvents() {
    this.scanButton.addEventListener("click", () => this.scanWallet());
    this.walletInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.scanWallet();
      }
    });

    // Auto-format wallet address input - allow base58 characters
    this.walletInput.addEventListener("input", (e) => {
      let value = e.target.value.replace(/[^A-Za-z0-9]/g, "");
      if (value.length > 44) {
        value = value.substring(0, 44);
      }
      e.target.value = value;
    });

    // Focus on input when popup opens
    this.walletInput.focus();

    // Add click handler for transactions header
    this.transactionsHeader.addEventListener("click", () => {
      this.toggleTransactionsSection();
    });
  }

  validateWalletAddress(address) {
    if (!address || address.trim() === "") {
      return "Please enter a wallet address";
    }

    const cleanAddress = address.trim();

    // Solana addresses are base58 encoded and typically 32-44 characters
    if (cleanAddress.length < 32 || cleanAddress.length > 44) {
      return "Wallet address must be between 32 and 44 characters long";
    }

    // Check for valid base58 characters (A-Z, a-z, 0-9, excluding 0, O, I, l)
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(cleanAddress)) {
      return "Wallet address contains invalid characters";
    }

    return null;
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove("hidden");
    this.hideLoading();
    this.hideResults();
  }

  hideError() {
    this.errorMessage.classList.add("hidden");
  }

  showLoading() {
    this.loadingSpinner.classList.remove("hidden");
    this.scanButton.disabled = true;
    this.scanButton.textContent = "Scanning...";
    this.hideError();
    this.hideResults();
  }

  hideLoading() {
    this.loadingSpinner.classList.add("hidden");
    this.scanButton.disabled = false;
    this.scanButton.textContent = "Scan Wallet";
  }

  showResults() {
    this.results.classList.remove("hidden");
  }

  hideResults() {
    this.results.classList.add("hidden");
  }

  async scanWallet() {
    const address = this.walletInput.value.trim();

    // Validate input
    const validationError = this.validateWalletAddress(address);
    if (validationError) {
      this.showError(validationError);
      return;
    }

    this.showLoading();

    try {
      const [tokens, transactions] = await Promise.all([
        this.fetchWalletTokens(address),
        this.fetchRecentTransactions(address),
      ]);
      this.displayResults(tokens, transactions);
    } catch (error) {
      console.error("Error scanning wallet:", error);
      this.showError(this.getErrorMessage(error));
    }
  }

  async fetchWalletTokens(address) {
    const url = `${this.heliusEndpoint}/addresses/${address}/balances?api-key=${this.heliusApiKey}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Wallet address not found");
      } else if (response.status === 400) {
        throw new Error("Invalid wallet address");
      } else if (response.status === 401) {
        throw new Error("Invalid API key");
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    }

    const data = await response.json();
    return this.processTokenData(data);
  }

  async getTokenMetadata(mintAddress) {
    try {
      const url = `${this.heliusEndpoint}/token-metadata?api-key=${this.heliusApiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mintAccounts: [mintAddress],
          includeOffChain: true,
          disableCache: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data[0]) {
          return data[0];
        }
      }
    } catch (error) {
      console.warn("Failed to fetch token metadata:", error);
    }

    return null;
  }

  async fetchRecentTransactions(address) {
    try {
      const url = `${this.heliusEndpoint}/addresses/${address}/transactions?api-key=${this.heliusApiKey}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn("Failed to fetch transactions:", response.status);
        return [];
      }

      const data = await response.json();
      return this.processTransactionData(data);
    } catch (error) {
      console.warn("Error fetching transactions:", error);
      return [];
    }
  }

  processTransactionData(data) {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    // Take only the last 10 transactions
    const recentTransactions = data.slice(0, 10);

    return recentTransactions.map((tx) => {
      const timestamp = tx.timestamp
        ? new Date(tx.timestamp * 1000)
        : new Date();
      const signature =
        tx.signature || tx.transaction?.signatures?.[0] || "Unknown";

      // Determine transaction type and amount
      let type = "Transfer";
      let amount = "0";
      let token = "SOL";

      // Check for token transfers
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        const transfer = tx.tokenTransfers[0];
        type = "Token Transfer";
        amount = this.formatBalance(transfer.amount, transfer.decimals || 0);
        token = transfer.mint || "Unknown Token";
      }
      // Check for SOL transfers
      else if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        const transfer = tx.nativeTransfers[0];
        type = "SOL Transfer";
        amount = (transfer.amount / 1e9).toFixed(9); // Convert lamports to SOL
        token = "SOL";
      }
      // Check for NFT transfers
      else if (tx.nftTransfers && tx.nftTransfers.length > 0) {
        type = "NFT Transfer";
        amount = "1";
        token = "NFT";
      }

      return {
        signature: signature,
        type: type,
        amount: amount,
        token: token,
        timestamp: timestamp,
        status: tx.meta?.err ? "Failed" : "Success",
        fee: tx.meta?.fee ? (tx.meta.fee / 1e9).toFixed(9) : "0",
      };
    });
  }

  async processTokenData(data) {
    const tokens = {
      fungible: [],
      nfts: [],
    };

    if (data.tokens) {
      // Process tokens in parallel for better performance
      const tokenPromises = data.tokens.map(async (token) => {
        // Get token metadata
        const metadata = await this.getTokenMetadata(token.mint);

        const tokenInfo = {
          mint: token.mint,
          amount: token.amount,
          decimals: token.decimals || 0,
          name: this.getTokenName(token, metadata),
          symbol: this.getTokenSymbol(token, metadata),
          balance: this.formatBalance(token.amount, token.decimals || 0),
        };

        // Determine if it's an NFT or fungible token
        if (token.amount === "1" && token.decimals === 0) {
          tokens.nfts.push(tokenInfo);
        } else {
          tokens.fungible.push(tokenInfo);
        }
      });

      // Wait for all token metadata to be fetched
      await Promise.all(tokenPromises);
    }

    return tokens;
  }

  getTokenName(token, metadata) {
    // Try metadata first
    if (
      metadata &&
      metadata.onChainMetadata &&
      metadata.onChainMetadata.metadata
    ) {
      const name = metadata.onChainMetadata.metadata.data.name;
      if (name && name.trim()) {
        return name.trim();
      }
    }

    // Try off-chain metadata
    if (
      metadata &&
      metadata.offChainMetadata &&
      metadata.offChainMetadata.metadata
    ) {
      const name = metadata.offChainMetadata.metadata.name;
      if (name && name.trim()) {
        return name.trim();
      }
    }

    // Fallback to token data
    if (token.name && token.name.trim()) {
      return token.name.trim();
    }

    // Final fallback
    return "Unknown Token";
  }

  getTokenSymbol(token, metadata) {
    // Try metadata first
    if (
      metadata &&
      metadata.onChainMetadata &&
      metadata.onChainMetadata.metadata
    ) {
      const symbol = metadata.onChainMetadata.metadata.data.symbol;
      if (symbol && symbol.trim()) {
        return symbol.trim();
      }
    }

    // Try off-chain metadata
    if (
      metadata &&
      metadata.offChainMetadata &&
      metadata.offChainMetadata.metadata
    ) {
      const symbol = metadata.offChainMetadata.metadata.symbol;
      if (symbol && symbol.trim()) {
        return symbol.trim();
      }
    }

    // Fallback to token data
    if (token.symbol && token.symbol.trim()) {
      return token.symbol.trim();
    }

    // Final fallback
    return "UNKNOWN";
  }

  formatBalance(amount, decimals) {
    if (!amount || amount === "0") {
      return "0";
    }

    // Convert string amount to number and apply decimals
    const numAmount = parseFloat(amount);
    const actualAmount = numAmount / Math.pow(10, decimals);

    // Format with appropriate decimal places
    if (decimals === 0) {
      return actualAmount.toLocaleString();
    } else if (decimals <= 6) {
      return actualAmount.toFixed(decimals);
    } else {
      return actualAmount.toFixed(6);
    }
  }

  displayResults(tokens, transactions) {
    this.hideLoading();

    const totalTokens = tokens.fungible.length + tokens.nfts.length;
    this.tokenCount.textContent = totalTokens;

    this.displayFungibleTokens(tokens.fungible);
    this.displayNFTs(tokens.nfts);
    this.displayRecentTransactions(transactions);

    this.showResults();
  }

  displayFungibleTokens(tokens) {
    this.fungibleTokens.innerHTML = "";

    if (tokens.length === 0) {
      this.fungibleTokens.innerHTML = `
        <div class="empty-state">
          <p>No fungible tokens found</p>
        </div>
      `;
      return;
    }

    tokens.forEach((token) => {
      const tokenElement = this.createTokenElement(token);
      this.fungibleTokens.appendChild(tokenElement);
    });
  }

  displayNFTs(tokens) {
    this.nftTokens.innerHTML = "";

    if (tokens.length === 0) {
      this.nftTokens.innerHTML = `
        <div class="empty-state">
          <p>No NFTs found</p>
        </div>
      `;
      return;
    }

    tokens.forEach((token) => {
      const tokenElement = this.createTokenElement(token);
      this.nftTokens.appendChild(tokenElement);
    });
  }

  createTokenElement(token) {
    const element = document.createElement("div");
    element.className = "token-item";
    element.innerHTML = `
      <div class="token-info">
        <div class="token-name">${this.escapeHtml(token.name)}</div>
        <div class="token-symbol">${this.escapeHtml(token.symbol)}</div>
      </div>
      <div class="token-balance">${token.balance}</div>
    `;
    return element;
  }

  displayRecentTransactions(transactions) {
    this.recentTransactions.innerHTML = "";

    if (transactions.length === 0) {
      this.recentTransactions.innerHTML = `
        <div class="empty-state">
          <p>No recent transactions found</p>
        </div>
      `;
      return;
    }

    transactions.forEach((tx) => {
      const txElement = this.createTransactionElement(tx);
      this.recentTransactions.appendChild(txElement);
    });

    // Show transaction count in header
    const transactionCount = transactions.length;
    const headerText =
      this.transactionsHeader.querySelector("span:first-child");
    headerText.textContent = `Recent Transactions (${transactionCount})`;
  }

  createTransactionElement(tx) {
    const element = document.createElement("div");
    element.className = "transaction-item";

    const statusClass = tx.status === "Success" ? "success" : "failed";
    const formattedTime = this.formatTimestamp(tx.timestamp);

    element.innerHTML = `
      <div class="transaction-info">
        <div class="transaction-type">${this.escapeHtml(tx.type)}</div>
        <div class="transaction-details">
          <span class="transaction-amount">${tx.amount} ${this.escapeHtml(
      tx.token
    )}</span>
          <span class="transaction-fee">Fee: ${tx.fee} SOL</span>
        </div>
        <div class="transaction-time">${formattedTime}</div>
      </div>
      <div class="transaction-status ${statusClass}">
        <span class="status-text">${tx.status}</span>
      </div>
    `;

    // Add click handler to view transaction on Solscan
    element.addEventListener("click", () => {
      this.openTransactionOnSolscan(tx.signature);
    });

    return element;
  }

  formatTimestamp(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) {
      return "Just now";
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }

  openTransactionOnSolscan(signature) {
    if (signature && signature !== "Unknown") {
      const url = `https://solscan.io/tx/${signature}`;
      chrome.tabs.create({ url: url });
    }
  }

  toggleTransactionsSection() {
    const isCollapsed = this.recentTransactions.classList.contains("collapsed");
    const expandIcon = this.transactionsHeader.querySelector(".expand-icon");

    if (isCollapsed) {
      this.recentTransactions.classList.remove("collapsed");
      expandIcon.textContent = "▲";
    } else {
      this.recentTransactions.classList.add("collapsed");
      expandIcon.textContent = "▼";
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  getErrorMessage(error) {
    if (error.message.includes("not found")) {
      return "Wallet address not found or has no tokens";
    } else if (error.message.includes("Invalid")) {
      return "Invalid wallet address format";
    } else if (error.message.includes("API key")) {
      return "Invalid API key. Please check your configuration.";
    } else if (error.message.includes("API error")) {
      return "Unable to connect to Solana network. Please try again.";
    } else if (error.message.includes("Failed to fetch")) {
      return "Network error. Please check your connection.";
    } else {
      return "An unexpected error occurred. Please try again.";
    }
  }
}

// Initialize the scanner when the popup loads
document.addEventListener("DOMContentLoaded", () => {
  new SolanaWalletScanner();
});
