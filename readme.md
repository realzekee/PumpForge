# PumpForge

PumpForge is an immersive, fully-featured Web3 meme-coin trading simulator and virtual arcade. It provides a thrilling, risk-free sandbox environment where users can trade fictional digital assets, test market strategies, and test their luck in an integrated casino—all utilizing a real-time reactive interface.

## 🚀 Features

* **Live Market Simulation:** Experience a dynamic, continuously updating ticker of fictional meme-coins. Prices fluctuate in real-time based on simulated market conditions and automated trading bot activity.
* **Robust Trading Engine:** Buy and sell assets seamlessly. Track your total portfolio value, active holdings, average buy prices, and realize your net profits or losses.
* **Virtual Arcade & Casino:** Gamify your experience between trades. Gamble your simulated cash in high-stakes Coinflip matches or unlock Mystery Crates for a chance to win massive cash payouts and gems.
* **Progression & Prestige:** Level up your account as you execute trades and engage with the platform. Unlock prestigious titles and rank up to permanently boost your daily allowance yields.
* **Daily Rewards & Promos:** Claim your free cash allowance every 24 hours (with bonuses scaling off your prestige level) and redeem community promo codes for instant account injections.
* **Real-time Leaderboards & Activity:** Watch live broadcasts of trades happening across the network and compete for the highest net worth.
* **Administrative Control Suite:** Fully equipped Owner/Admin dashboard for managing global game states, distributing assets, generating promo codes, and overriding casino algorithms.

## 💻 Tech Stack

* **Frontend Framework:** React 19 with TypeScript, built on Vite for lightning-fast hot module replacement and optimized production builds.
* **Styling:** Tailwind CSS for a highly responsive, modern, dark-mode-first user interface.
* **Backend & Auth:** Appwrite is used for secure user authentication, session management, and persistent user state routing.
* **Real-Time Database:** Firebase Firestore handles lightning-fast, globally synced live trading feeds and activity broadcasts.
* **UI/UX Enhancements:** Lucide React for crisp SVG iconography and Sonner for unopinionated, smooth toast notifications.

## 🛠️ Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine. You will also need active Appwrite and Firebase projects configured.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/pumpforge.git
   cd pumpforge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**read
   Create a `.env` file in the root directory and add your backend credentials (refer to `.env.example` if available).

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

### Building for Production

To create a production-ready optimized build:

```bash
npm run build
```

The compiled assets will be output to the `dist` directory.

## 🎮 How to Play

1. **Sign Up:** Create a new account to enter the system. You will be granted an initial simulation allowance of caching and gems.
2. **Analyze the Market:** Check the Live Markets tab to see which meme-coins are pumping or dumping.
3. **Execute Trades:** Buy into promising trends and sell when you are in the green to build your total portfolio value.
4. **Hit the Arcade:** Feeling lucky? Head over to the Arcade to wager your extra cash on a coinflip or purchase crates in the Shop.
5. **Level Up:** Keep trading to gain XP, level up your profile, and climb the simulated ranks!

## 📜 License

This project is intended for educational and simulation purposes. The meme-coins and cash values represented within the application are strictly fictional and hold no real-world monetary value.
