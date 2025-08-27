# Solana Wallet Scanner

A professional Chrome extension to scan Solana wallet addresses and view all tokens and NFTs.

## Features

- Clean, professional interface
- Real-time Solana wallet scanning
- View fungible tokens and NFTs
- **Recent transactions history (last 10)**
- **Transaction details with timestamps**
- **Click to view transactions on Solscan**
- Responsive design
- Fast and reliable

## Installation

### 1. Load in Chrome

- Go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the extension folder

## Usage

1. Click the extension icon
2. Enter a Solana wallet address (44 characters)
3. Click "Scan Wallet"
4. View tokens, NFTs, and recent transactions
5. Click on any transaction to view details on Solscan

## Technical Details

- **Manifest Version**: 3
- **API**: Helius Solana API (configured)
- **Styling**: Pure CSS
- **JavaScript**: Vanilla JS

## File Structure

```
├── manifest.json          # Extension manifest
├── popup.html            # Main interface
├── popup.js              # Core functionality
├── styles.css            # Professional styling
├── config.js             # API configuration (ready)
├── icons/                # Extension icons
└── README.md             # This file
```

## License

MIT License
