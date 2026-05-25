export interface MemeCoin {
  id: string;
  name: string;
  symbol: string;
  creator: string;
  description: string;
  avatarEmoji: string;
  avatarBg: string;
  price: number;
  marketCap: number;
  supply: number;
  volume24h: number;
  change24h: number;
  history: number[]; // Price history ticks
  isUserCreated?: boolean;
}

export interface UserStats {
  username: string;
  handle: string;
  title: string;
  isPremium: boolean;
  nameColor: string; // Tailwind color class or hex
  cash: number;
  gems: number;
  prestigeLevel: number;
  totalProfit: number;
  coinsCreatedCount: number;
  tradesCount: number;
  lastDailyRewardClaim?: string | null; // ISO date or null when not claimed yet
  createdAt?: string; // Account registration ISO date
  isSuspended?: boolean;
  isBanned?: boolean;
  suspendedUntil?: number | null; // ms timestamp or null if permanent/lifted
  isAdmin?: boolean;
  isCasinoRigged?: boolean;
  rainbowCosmetics?: boolean;
  customAdminBadge?: string;
  activityLog?: Array<{
    id: string;
    timestamp: string;
    action: string;
    category: 'trade' | 'system' | 'auth' | 'risk';
  }>;
}

export interface PortfolioHolding {
  coinId: string;
  amount: number;
  avgBuyPrice: number;
}

export interface LiveTrade {
  id: string;
  timestamp: string;
  type: 'BUY' | 'SELL' | 'CREATE';
  coinId: string;
  coinSymbol: string;
  coinName: string;
  amountUsd: number;
  amountTokens?: number;
  userHandle: string;
  message?: string;
}

export interface PredictionMarket {
  id: string;
  question: string;
  description: string;
  yesPool: number;
  noPool: number;
  yesPercentage: number;
  userBetAmount: number;
  userBetSide: 'YES' | 'NO' | null;
  resolved: boolean;
  resolvedOutcome: 'YES' | 'NO' | null;
  endTime: string;
  category: 'trading' | 'general' | 'arcade';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'trading' | 'wealth' | 'creation' | 'arcade' | 'prestige';
  target: number;
  current: number;
  claimed: boolean;
  cashReward: number;
  gemReward: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  costGems: number;
  type: 'color' | 'crate';
  value: string; // The hex color or crate difficulty
  unlocked?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'achievement' | 'trade' | 'crash';
}

export type ActiveTab =
  | 'home'
  | 'market'
  | 'hopium'
  | 'arcade'
  | 'leaderboard'
  | 'shop'
  | 'achievements'
  | 'portfolio'
  | 'treemap'
  | 'create-coin'
  | 'notifications'
  | 'about'
  | 'profile'
  | 'settings'
  | 'owner-dashboard';

export interface SimulatedPlayer {
  id: string;
  name: string;
  handle: string;
  profit: number;
  prestige: number;
  title: string;
  nameColor: string;
  isSuspended: boolean;
  isBanned?: boolean;
  suspendedUntil?: string | null; // ISO timestamp or null if permanent/lifted
  isAdmin: boolean;
  createdAt?: string; // Account registration ISO date
  activityLog?: Array<{
    id: string;
    timestamp: string;
    action: string;
    category: 'trade' | 'system' | 'auth' | 'risk';
  }>;
}

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'trade' | 'achievement' | 'crash';
  timestamp: string;
  expiresAt?: string;
}


