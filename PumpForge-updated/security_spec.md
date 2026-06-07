# Security Specification & "Dirty Dozen" Threat Model

This document outlines the security properties and data invariants for MemeExchange Arena, followed by the "Dirty Dozen" threat vectors and a corresponding test suite to ensure secure configurations.

## 1. Data Invariants & Zero-Trust Access Bounds

*   **User Profiles (`/users/{userId}`)**: A user profile belongs strictly to the authenticated user. No other user can read or modify another user's profile. Users are strictly prohibited from changing their own registration username or inflating their cash/gems directly without game rules verification.
*   **User Portfolio Holdings (`/users/{userId}/holdings/{coinId}`)**: Only the owner of the portfolio can read or write to their holdings. Price and amount values must be valid non-negative numbers.
*   **Coins (`/coins/{coinId}`)**: Anyone can read the global list of coins. Only the creator (or our trade ticking systems) can write or rugpull a coin. The price history must be valid.
*   **Trades Logs (`/trades/{tradeId}`)**: Multi-user real-time feed is globally readable. Writing is restricted to signed-in users on behalf of their correct user handle.
*   **Prediction Markets (`/markets/{marketId}`)**: Globally readable. Read/write operations should be restricted appropriately.
*   **User Bets (`/users/{userId}/bets/{marketId}`)**: Only the owner can read or write their own bet placements.

---

## 2. The "Dirty Dozen" Threat Payloads

Here are twelve highly dangerous payloads designed to exploit update gaps, identity spoofing, state shortcuts, and database resource exhaustion:

1.  **Payload T1 (Identity Spoofing - Profile)**: Creating or updating a user profile with `userId` of another player.
2.  **Payload T2 (Cash Inflation)**: A user modifying their own profile to increment `cash` to `$999,999,999` directly via Firestore client-side SDK.
3.  **Payload T3 (Prestige Shortcut)**: A user directly updating their own `prestigeLevel` to 10 without executing the prestige trigger logic.
4.  **Payload T4 (Holding Forgery)**: A user writing directly to `/users/{otherUser}/holdings/{coinId}` to steal or alter their assets.
5.  **Payload T5 (Fake Liquidity Injection)**: A user updating `/users/{userId}/holdings/{coinId}` to set amount to a massive number without deducting cash.
6.  **Payload T6 (Unauthenticated Global Write)**: An unauthenticated guest trying to write to `/coins/test_coin` or `/trades/test_trade`.
7.  **Payload T7 (Self-Appointed Dev Custom Coin)**: Creating a custom coin with a spoofed creator handle that doesn't match the current user's profile.
8.  **Payload T8 (Sneaky Rugpull Trigger)**: A malicious actor calling a write to rugpull a coin owned by another dev creator to ruin their token.
9.  **Payload T9 (Infinity History Poisoning)**: Writing a massive array of length > 1,000,000 to the price history array on a coin to exhaust resource queries.
10. **Payload T10 (Ghost Field Injection)**: Inserting administrative fields such as `isAdmin: true` or `verifiedStatus: "admin"` directly into a user profile.
11. **Payload T11 (Shadow Bet Hijacking)**: A user placing or editing bets under another user's account path `/users/{someoneElse}/bets/{marketId}`.
12. **Payload T12 (Completed Milestone Exploit - Achievement Claim)**: Directly marking an achievement as claimed and setting `current` equal to target without completing the goals.

---

## 3. Test Runner Design

We enforce these checks directly through our Firestore rules. Below is our threat testing definition that our rules will satisfy.
