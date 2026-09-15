export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isGuest: boolean;
  jwt?: string;
}

export interface UserStatsPayload {
  cash: number;
  gems: number;
  prestigeLevel: number;
  tradesCount: number;
  coinsCreatedCount: number;
  nameColor: string;
  dailyStreak?: number;
  lastDailyRewardClaim?: string;
}

export interface TradeRequest {
  coinId: string;
  type: "BUY" | "SELL";
  amountCoins: number;
  expectedPrice?: number;
}

export interface ArcadeWagerRequest {
  game: "coinflip" | "slots" | "dice" | "mines" | "tower";
  action: "play" | "start" | "step" | "cashout";
  bet: number;
  // Coinflip params
  side?: "heads" | "tails";
  // Dice params
  selectedNum?: number;
  // Mines params
  minesCount?: number;
  cellIndex?: number;
  // Tower params
  difficulty?: "easy" | "medium" | "hard";
  colIndex?: number;
}

export interface ShopBuyRequest {
  type: "color" | "crate";
  itemId?: string;
  crateId?: string;
  colorClass?: string;
  name?: string;
  costGems: number;
}

export interface PromocodeRequest {
  code: string;
}

export interface BugReportRequest {
  title: string;
  description: string;
  category?: string;
}

export interface PolymarketWagerRequest {
  marketId: string;
  choice: "YES" | "NO";
  amount: number;
}

export interface PolymarketResolveRequest {
  marketId: string;
  winningChoice: "YES" | "NO" | "CANCEL";
}
