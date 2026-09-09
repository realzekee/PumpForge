/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Sidebar from "./components/Sidebar";
import HomeTab from "./components/HomeTab";
import MarketTab from "./components/MarketTab";
import CoinDetailsTab from "./components/CoinDetailsTab";
import PolymarketTab from "./components/PolymarketTab";
import ArcadeTab from "./components/ArcadeTab";
import LeaderboardTab from "./components/LeaderboardTab";
import ShopTab from "./components/ShopTab";
import PortfolioTab from "./components/PortfolioTab";
import TreemapTab from "./components/TreemapTab";
import CreateCoinTab from "./components/CreateCoinTab";
import NotificationsTab from "./components/NotificationsTab";
import SettingsTab from "./components/SettingsTab";
import AboutTab from "./components/AboutTab";
import ProfileTab from "./components/ProfileTab";
import { TradesHistoryTab } from "./components/TradesHistoryTab";
import PolymarketAdminTab from "./components/PolymarketAdminTab";
import OwnerDashboardTab from "./components/OwnerDashboardTab";
import BugReportModal from "./components/BugReportModal";
import PumpForgeLoadingScreen from "./components/PumpForgeLoadingScreen";
import {
  MemeCoin,
  UserStats,
  PortfolioHolding,
  LiveTrade,
  PredictionMarket,
  ActiveTab,
  NotificationItem,
  SimulatedPlayer,
  Broadcast,
} from "./types";
import { INITIAL_COINS } from "./data/memeCoins";
import {
  Gift,
  Sparkles,
  X,
  ChevronRight,
  Check,
  Gamepad2,
  ShoppingBag,
  PlusCircle,
  Lock,
  LogIn,
  TrendingUp,
  Crown,
  Skull,
  BellRing,
} from "lucide-react";

// Appwrite imports
import { account, databases, client } from "./appwrite";
import { ID, Permission, Role } from "appwrite";
import { useQueryClient } from "@tanstack/react-query";

const syncCoinToAppwrite = async (coinId: string, updatedCoin: MemeCoin) => {
  try {
    const { Query } = await import("appwrite");
    const payload = {
      price: Number(updatedCoin.price),
      marketCap: Math.floor(updatedCoin.marketCap),
      totalLiquidity: Number(updatedCoin.totalLiquidity || 0),
      total_value: Number(updatedCoin.totalLiquidity || 0),
      volume24h: Number(updatedCoin.volume24h || 0),
      change24h: Number(updatedCoin.change24h || 0),
      history: Array.isArray(updatedCoin.history) ? updatedCoin.history : [updatedCoin.price],
    };

    try {
      await databases.updateDocument("pumpforge", "coins", coinId, payload);
      return;
    } catch (err1) {
      try {
        const queryRes = await databases.listDocuments("pumpforge", "coins", [
          Query.equal("coinId", coinId),
        ]);
        if (queryRes.documents.length > 0) {
          await databases.updateDocument(
            "pumpforge",
            "coins",
            queryRes.documents[0].$id,
            payload
          );
          return;
        }
      } catch (err2) {
        // Fall through to create document
      }
    }

    const createPayload = {
      coinId: coinId,
      creator: updatedCoin.creator || "@system",
      creatorId: updatedCoin.creatorId || "system",
      creatorName: updatedCoin.creatorName || "System",
      name: updatedCoin.name,
      symbol: updatedCoin.symbol,
      description: updatedCoin.description || "",
      price: Number(updatedCoin.price),
      marketCap: Math.floor(updatedCoin.marketCap),
      totalLiquidity: Number(updatedCoin.totalLiquidity || 0),
      total_value: Number(updatedCoin.totalLiquidity || 0),
      volume24h: Number(updatedCoin.volume24h || 0),
      change24h: Number(updatedCoin.change24h || 0),
      history: Array.isArray(updatedCoin.history) ? updatedCoin.history : [updatedCoin.price],
      avatarEmoji: updatedCoin.avatarEmoji || "🪙",
      avatarBg: updatedCoin.avatarBg || "bg-zinc-900 border-zinc-800",
      supply: updatedCoin.supply || 1000000,
    };

    try {
      await databases.createDocument("pumpforge", "coins", coinId, createPayload, [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ]);
    } catch (err3) {
      await databases.createDocument("pumpforge", "coins", ID.unique(), createPayload, [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ]);
    }
  } catch (outerErr) {
    console.warn("syncCoinToAppwrite error:", outerErr);
  }
};

const PRESTIGE_NAMES = [
  "Degen Level I",
  "Ape Prestige II",
  "Giga Whaler III",
  "Supreme Lord IV",
  "Absolute Dev V",
  "Interstellar Sage VI",
];

const parseDateToIso = (input: string): string => {
  if (!input || input === "TBD") {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }
  const parsed = Date.parse(input);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  const lower = input.toLowerCase();
  const d = new Date();
  if (lower.includes("hour")) {
    const match = lower.match(/\d+/);
    const hrs = match ? parseInt(match[0]) : 2;
    d.setHours(d.getHours() + hrs);
    return d.toISOString();
  }
  if (lower.includes("day") || lower.includes("tomorrow")) {
    const match = lower.match(/\d+/);
    const days = match ? parseInt(match[0]) : (lower.includes("tomorrow") ? 1 : 3);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }
  if (lower.includes("week") || lower.includes("friday")) {
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }
  if (lower.includes("month")) {
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }
  d.setDate(d.getDate() + 7);
  return d.toISOString();
};

// Safe LocalStorage wrapper to prevent blocking patterns in restrictive browsers
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[safeStorage] getItem failed for "${key}":`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[safeStorage] setItem failed for "${key}":`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[safeStorage] removeItem failed for "${key}":`, e);
    }
  },
  key: (index: number): string | null => {
    try {
      return localStorage.key(index);
    } catch (e) {
      console.warn(`[safeStorage] key failed for index ${index}:`, e);
      return null;
    }
  },
  get length(): number {
    try {
      return localStorage.length;
    } catch (e) {
      console.warn("[safeStorage] length fetch failed:", e);
      return 0;
    }
  },
};

function CoinRouteWrapper({
  coins,
  userStats,
  currentUser,
  holdings,
  onTradeAction,
}: {
  coins: MemeCoin[];
  userStats: UserStats;
  currentUser: any;
  holdings: PortfolioHolding[];
  onTradeAction: any;
}) {
  const { coinId } = useParams();
  const navigate = useNavigate();
  const [localCoin, setLocalCoin] = useState<MemeCoin | null>(coins.find((c) => c.id === coinId) || null);
  const [loading, setLoading] = useState(!localCoin);

  useEffect(() => {
    const c = coins.find((c) => c.id === coinId);
    if (c) {
      setLocalCoin((prev) => {
        if (!prev) return c;
        const bestPrice = Math.max(prev.price || 0, c.price || 0);
        return {
          ...prev,
          ...c,
          price: bestPrice,
          marketCap: Math.floor((c.supply || 1000000) * bestPrice),
        };
      });
      setLoading(false);
    }
  }, [coins, coinId]);

  useEffect(() => {
    if (!coinId) return;
    let unsub: (() => void) | undefined;
    import("./appwrite").then(({ databases, client }) => {
      const updateCoinState = (doc: any) => {
        if (!doc) return;
        setLocalCoin((prev) => {
          const docPrice = Number(doc.price || 0);
          const currentPrice = prev?.price || 0;
          const bestPrice = Math.max(docPrice, currentPrice);
          return {
            id: doc.$id || prev?.id || coinId,
            coinId: doc.coinId || doc.$id || coinId,
            creatorId: doc.creatorId || prev?.creatorId,
            creatorName: doc.creatorName || prev?.creatorName,
            creator: doc.creator || prev?.creator || "@system",
            name: doc.name || prev?.name || "Meme Coin",
            symbol: doc.symbol || prev?.symbol || "COIN",
            description: doc.description || prev?.description || "",
            price: bestPrice > 0 ? bestPrice : currentPrice || 0.01,
            supply: doc.supply || prev?.supply || 1000000,
            totalLiquidity: doc.total_value || doc.totalLiquidity || prev?.totalLiquidity || 0,
            marketCap: Math.floor((doc.supply || prev?.supply || 1000000) * (bestPrice || currentPrice || 0.01)),
            volume24h: Math.max(doc.volume24h || 0, prev?.volume24h || 0),
            change24h: doc.change24h || prev?.change24h || 0,
            avatarEmoji: doc.avatarEmoji || prev?.avatarEmoji || "🪙",
            avatarBg: doc.avatarBg || prev?.avatarBg || "bg-zinc-900 border-zinc-800",
            createdAt: doc.createdAt || prev?.createdAt,
            history:
              doc.history && Array.isArray(doc.history) && doc.history.length > 0
                ? doc.history
                : prev?.history || [bestPrice || 0.01],
          };
        });
        setLoading(false);
      };

      databases.getDocument("pumpforge", "coins", coinId)
        .then(updateCoinState)
        .catch(() => {
          setLoading(false);
        });

      unsub = client.subscribe(`databases.pumpforge.collections.coins.documents.${coinId}`, (response) => {
        updateCoinState(response.payload);
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, [coinId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <PumpForgeLoadingScreen
          variant="inline"
          message="Loading coin metrics & charts..."
          subMessage="Streaming real-time order books"
        />
      </div>
    );
  }

  if (!localCoin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center font-mono animate-fade-in text-white">
        <h2>Coin not found or loading...</h2>
        <button onClick={() => navigate("/market")} className="mt-4 text-orange-500 underline uppercase text-xs font-bold font-mono">Return to Market</button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-2 md:p-6 lg:p-8 animate-fade-in">
      <CoinDetailsTab
        coin={localCoin}
        userStats={userStats}
        currentUser={currentUser}
        holdings={holdings}
        onTradeAction={onTradeAction}
        onBackToList={() => navigate("/market")}
      />
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedCoinIdForMarket, setSelectedCoinIdForMarket] = useState<
    string | null
  >(null);
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    const cached = safeStorage.getItem("cached_appwrite_user");
    return cached ? JSON.parse(cached) : null;
  });
  const [isCheckingRedirect, setIsCheckingRedirect] = useState<boolean>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return !!(urlParams.get("userId") && urlParams.get("secret"));
    } catch (e) {
      return false;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoaded, setIsStatsLoaded] = useState<boolean>(() => {
    return !!safeStorage.getItem("cached_appwrite_stats");
  });

  // Core local states (fallbacks/synced depending on auth)
  const [coins, setCoins] = useState<MemeCoin[]>(() => {
    const cached = safeStorage.getItem("pumpforge_cached_coins");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn("Failed to load cached coins:", e);
      }
    }
    return INITIAL_COINS;
  });
  const [userStats, setUserStats] = useState<UserStats>(() => {
    const cachedUser = safeStorage.getItem("cached_appwrite_user");
    const cachedStats = safeStorage.getItem("cached_appwrite_stats");
    if (cachedUser && cachedStats) {
      try {
        return JSON.parse(cachedStats);
      } catch (e) {
        console.error("Error loading fallback userStats cache:", e);
      }
    }
    return {
      username: "Guest Player",
      handle: "@guest_degen",
      title: "Member",
      isPremium: false,
      nameColor: "text-zinc-400 font-extrabold",
      cash: 5000.0,
      gems: 90,
      prestigeLevel: 0,
      totalProfit: 0,
      coinsCreatedCount: 0,
      tradesCount: 0,
      lastDailyRewardClaim: null,
      email: "",
      createdAt: "2026-05-24T06:40:00Z",
    };
  });
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [liveTrades, setLiveTrades] = useState<LiveTrade[]>([]);
  const [markets, setMarkets] = useState<PredictionMarket[]>(() => {
    const cached = safeStorage.getItem("pumpforge_polymarkets");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn("Failed to load cached polymarkets:", e);
      }
    }
    return [];
  });
  const [userBets, setUserBets] = useState<{
    [marketId: string]: { side: "YES" | "NO"; amount: number };
  }>(() => {
    const cached = safeStorage.getItem("pumpforge_user_bets");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.warn("Failed to load cached user bets:", e);
      }
    }
    return {};
  });
  const [registeredUsers, setRegisteredUsers] = useState<
    (UserStats & { uid: string })[]
  >([]);
  const [simulatedPlayers, setSimulatedPlayers] = useState<SimulatedPlayer[]>(
    () => {
      const saved = safeStorage.getItem("memex_simulated_players");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Error parsing sim players:", e);
        }
      }
      return [
        {
          id: "@zeke",
          name: "Zeke",
          handle: "@zeke",
          profit: 852000.0,
          prestige: 5,
          title: "Whale Dev",
          nameColor: "text-orange-400 font-extrabold text-glow",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-02-14T10:15:30Z",
          activityLog: [
            {
              id: "z1",
              timestamp: "2026-05-24T05:12:00Z",
              action: "Created coin *ZEKEPUMP with liquidity $50,000",
              category: "risk",
            },
            {
              id: "z2",
              timestamp: "2026-05-24T06:20:00Z",
              action:
                "Executed strategic trade on *ZEKEPUMP for $125,000 profit",
              category: "risk",
            },
            {
              id: "z3",
              timestamp: "2026-05-24T06:45:00Z",
              action: "Bought 1,500,000 *ROAD tokens for $45,000",
              category: "trade",
            },
            {
              id: "z4",
              timestamp: "2026-05-24T07:05:00Z",
              action: "Claimed Daily Sandbox Credit multiplier bonus",
              category: "system",
            },
          ],
        },
        {
          id: "@stonks",
          name: "Stonks Master",
          handle: "@stonks",
          profit: 432000.0,
          prestige: 2,
          title: "Giga Trader",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-03-01T15:24:12Z",
          activityLog: [
            {
              id: "s1",
              timestamp: "2026-05-24T01:30:00Z",
              action: "Sold 500,000 *FED coins at peak value for $180k profit",
              category: "trade",
            },
            {
              id: "s2",
              timestamp: "2026-05-24T03:15:00Z",
              action:
                'Placed $50,000 bet on Predict Market: "ROAD valuation of 150K"',
              category: "trade",
            },
            {
              id: "s3",
              timestamp: "2026-05-24T04:40:00Z",
              action: 'Unlocked Achievement: "Giga Hype Lord III"',
              category: "system",
            },
          ],
        },
        {
          id: "@sol_expert",
          name: "Sol Expert",
          handle: "@sol_expert",
          profit: 492000.0,
          prestige: 4,
          title: "Giga Trader",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-01-20T08:05:11Z",
          activityLog: [
            {
              id: "so1",
              timestamp: "2026-05-24T02:11:00Z",
              action: "Bought bottom tier liquidity of *ROAD for $80,000",
              category: "trade",
            },
            {
              id: "so2",
              timestamp: "2026-05-24T04:59:00Z",
              action: "Exchanged gems to unlock Cosmic Slate profile flair",
              category: "system",
            },
          ],
        },
        {
          id: "@degen_ape",
          name: "Degen Ape",
          handle: "@degen_ape",
          profit: 154000.5,
          prestige: 0,
          title: "Degen",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2526-04-10T12:00:00Z",
          activityLog: [
            {
              id: "da1",
              timestamp: "2026-05-24T06:12:00Z",
              action: "Minted custom microcap coin *APEWAY",
              category: "risk",
            },
            {
              id: "da2",
              timestamp: "2026-05-24T06:14:00Z",
              action: "Closed *APEWAY within 120 seconds for $15,000 profit",
              category: "risk",
            },
          ],
        },
        {
          id: "@pump_master",
          name: "Pump Master",
          handle: "@pump_master",
          profit: 238500.0,
          prestige: 1,
          title: "Degen",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-05-18T19:40:00Z",
          activityLog: [
            {
              id: "pm1",
              timestamp: "2026-05-24T03:30:00Z",
              action: "Acquired 100,000,000 *ROAD tokens at standard pool rate",
              category: "trade",
            },
          ],
        },
        {
          id: "@moon_boy",
          name: "Moon Boy",
          handle: "@moon_boy",
          profit: 154000.5,
          prestige: 0,
          title: "Degen",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-05-21T06:15:00Z",
          activityLog: [
            {
              id: "mb1",
              timestamp: "2026-05-24T04:02:00Z",
              action: "Bought *STARS with full available wallet size",
              category: "trade",
            },
          ],
        },
        {
          id: "@alpha",
          name: "Alpha caller",
          handle: "@alpha",
          profit: 407500.0,
          prestige: 3,
          title: "Giga Trader",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-02-28T22:11:44Z",
          activityLog: [
            {
              id: "al1",
              timestamp: "2026-05-24T01:10:00Z",
              action:
                "Published live shill message trigger in Polymarket Lobby",
              category: "system",
            },
            {
              id: "al2",
              timestamp: "2026-05-24T05:44:00Z",
              action:
                "Withdrew $120,000 cash balance into offline wallet vault",
              category: "trade",
            },
          ],
        },
        {
          id: "@whale",
          name: "Crypto Whale",
          handle: "@whale",
          profit: 830000.0,
          prestige: 8,
          title: "Whale Dev",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-01-05T01:30:15Z",
          activityLog: [
            {
              id: "w1",
              timestamp: "2026-05-24T00:05:00Z",
              action: "Bought 85% of standard pool allocation of *ROAD",
              category: "trade",
            },
            {
              id: "w2",
              timestamp: "2026-05-24T03:55:00Z",
              action: "Claimed Daily Extreme multiplier booster of $24,000",
              category: "system",
            },
          ],
        },
        {
          id: "@paper_hands",
          name: "Paper Hands",
          handle: "@paper_hands",
          profit: 154000.5,
          prestige: 0,
          title: "Degen",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-05-02T13:45:00Z",
          activityLog: [
            {
              id: "ph1",
              timestamp: "2026-05-24T05:00:00Z",
              action: "Panic-sold entire *ROAD token balance after -3% dip",
              category: "trade",
            },
          ],
        },
        {
          id: "@diamond_dev",
          name: "Diamond Dev",
          handle: "@diamond_dev",
          profit: 238500.0,
          prestige: 1,
          title: "Degen",
          nameColor: "text-zinc-300",
          isSuspended: false,
          isAdmin: false,
          createdAt: "2026-04-30T10:12:00Z",
          activityLog: [
            {
              id: "dd1",
              timestamp: "2026-05-24T02:30:00Z",
              action: "Acquired Dev credentials token in custom sandbox",
              category: "system",
            },
          ],
        },
      ];
    },
  );
  const [isOfflineDevice, setIsOfflineDevice] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<string[]>(
    () => {
      const saved = safeStorage.getItem("dismissed_broadcasts");
      try {
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    },
  );

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [customToast, setCustomToast] = useState<{
    title: string;
    message: string;
    isError?: boolean;
  } | null>(null);

  const triggerToast = (title: string, message: string, isError = false) => {
    setCustomToast({ title, message, isError });
    setTimeout(() => {
      setCustomToast((current) => {
        if (current?.title === title && current?.message === message) {
          return null;
        }
        return current;
      });
    }, 4500);
  };

  const [showDailyToast, setShowDailyToast] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInReason, setSignInReason] = useState("");
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [coinToDelete, setCoinToDelete] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState<boolean>(false);
  const [isDailyRewardAvailable, setIsDailyRewardAvailable] = useState(() => {
    const cachedLastClaimed = localStorage.getItem("pf_last_claimed");
    if (cachedLastClaimed) {
      const claimTime = new Date(cachedLastClaimed).getTime();
      const now = new Date().getTime();
      const dif = 24 * 60 * 60 * 1000 - (now - claimTime);
      return dif <= 0;
    }
    return true;
  });

  const [dailyRewardTimer, setDailyRewardTimer] = useState(() => {
    const cachedLastClaimed = localStorage.getItem("pf_last_claimed");
    if (cachedLastClaimed) {
      const claimTime = new Date(cachedLastClaimed).getTime();
      const now = new Date().getTime();
      const dif = 24 * 60 * 60 * 1000 - (now - claimTime);
      if (dif > 0) {
        const hrs = Math.floor(dif / (1000 * 60 * 60));
        const mins = Math.floor((dif % (1000 * 60 * 60)) / (1000 * 60));
        return `Next in ${hrs}h ${mins}m`;
      }
    }
    return "Claim Available!";
  });

  // Appwrite Session initializer and handler functions (located below all state declarations)
  useEffect(() => {
    let active = true;

    // Start a failsafe timer to DROP the loading screen after 2.0 seconds under all circumstances
    const failsafeTimer = setTimeout(() => {
      if (active) {
        setIsCheckingRedirect(false);
        setIsLoading(false);
        console.warn(
          "⏳ Loading session failsafe triggered: forcing loaders to false after 2.0 seconds.",
        );
      }
    }, 2000);

    const initSession = async () => {
      // 1. Check for userId and secret parameters inside the URL immediately
      const urlParams = new URLSearchParams(window.location.search);
      const urlUserId = urlParams.get("userId");
      const urlSecret = urlParams.get("secret");

      if (urlUserId && urlSecret) {
        // Strip parameters from the address bar IMMEDIATELY before starting session actions or state shifts
        const cleanUrl =
          window.location.protocol +
          "//" +
          window.location.host +
          window.location.pathname;
        window.history.replaceState(null, "", cleanUrl);
        console.log(
          "⚡ Found OAuth URL parameters. Parameters stripped from URL bar immediately to break loops.",
        );

        try {
          console.log(
            "⚡ Forcing manual Appwrite session creation via URL secret parameters...",
          );
          await account.createSession(urlUserId, urlSecret);
          console.log("⚡ Manual Session creation request completed.");
          // Mirror session validation flag to bypass Firefox ETP dropping the third-party cookie
          localStorage.setItem("pf_session_valid", "true");
          localStorage.setItem("pf_fallback_userId", urlUserId);
        } catch (sessionErr: any) {
          console.error(
            "Forced manual session activation from URL failed:",
            sessionErr,
          );
          triggerToast(
            "Session Activation Error",
            sessionErr?.message || String(sessionErr),
            true,
          );
        }
      }

      if (urlUserId && urlSecret) {
        setIsCheckingRedirect(true);
      }
      setIsLoading(true);

      
      try {
        let user: any = null;

        try {
          user = await account.get();
        } catch (getErr: any) {
          console.warn(
            "Standard account.get() failed. Active Appwrite session not detected.",
            getErr,
          );
          // Chrome 3rd-party cookie fallback hydration
          const isSessionValid = localStorage.getItem("pf_session_valid");
          const fallbackId = localStorage.getItem("pf_fallback_userId");
          if (isSessionValid === "true" && fallbackId) {
            console.log(
              "Hydrating minimal user from localStorage fallback in App.tsx",
            );
            user = {
              $id: fallbackId,
              email: "", // We might not have it, but we can bypass the null check
              name: "Player",
            };
          }
        }

        if (user) {
          let isOwnerEmail = false;
          if (user.email) {
            isOwnerEmail =
              user.email === "realzekeee@gmail.com" ||
              user.email === "realzekee@gmail.com";
          }
          const finalUsername =
            user.name ||
            (user.email ? user.email.split("@")[0] : "Appwrite Player") ||
            "Appwrite Player";
          const finalHandle =
            "@" + finalUsername.toLowerCase().replace(/[^a-z0-9]/g, "");

          // Immediately fetch game data from Appwrite databases if exists or create document
          let profileDoc: any;
          try {
            profileDoc = await databases.getDocument(
              "pumpforge",
              "users",
              user.$id,
            );
          } catch (err: any) {
            const isNotFound =
              err?.code === 404 ||
              String(err).includes("404") ||
              err?.message?.includes("not found");
            if (isNotFound) {
              console.log(
                "Creating brand new Appwrite database profile for user:",
                user.$id,
              );
              profileDoc = await databases.createDocument(
                "pumpforge",
                "users",
                user.$id,
                {
                  userId: user.$id,
                  username: finalUsername,
                  cash: 5000.0, // Initialize new users with the standard 5000 cash balance
                  coins: 0.0,
                  gems: 90,
                  prestigeLevel: 0,
                  lastDailyRewardClaim: "",
                },
                [
                  Permission.read(Role.any()),
                  Permission.update(Role.user(user.$id)),
                  Permission.delete(Role.user(user.$id))
                ]
              );
            } else {
              throw err;
            }
          }

          // Map user and document data to states
          const mappedUser = {
            ...user,
            uid: user.$id,
            displayName: finalUsername,
          };

          const finalUserStats = {
            username: finalUsername,
            handle: finalHandle,
            title: isOwnerEmail ? "Owner" : "Member",
            email: user.email || "",
            isPremium: isOwnerEmail,
            nameColor: isOwnerEmail
              ? "text-rose-500 font-extrabold text-glow tracking-wider"
              : "text-zinc-400 font-bold",
            cash: Number(profileDoc.cash ?? 5000.0),
            gems: parseInt(String(profileDoc.gems ?? 90), 10),
            prestigeLevel: parseInt(String(profileDoc.prestigeLevel ?? 0), 10),
            totalProfit: profileDoc.totalProfit || profileDoc.total_value || 0.0,
            coinsCreatedCount: profileDoc.coins ?? 0.0,
            tradesCount: profileDoc.tradesCount ?? 0.0,
            lastDailyRewardClaim: profileDoc.lastDailyRewardClaim || null,
            createdAt: user.$createdAt || new Date().toISOString(),
          };

          // Cache the states immediately inside safeStorage to prevent flashes
          safeStorage.setItem(
            "cached_appwrite_user",
            JSON.stringify(mappedUser),
          );
          safeStorage.setItem(
            "cached_appwrite_stats",
            JSON.stringify(finalUserStats),
          );

          if (active) {
            setCurrentUser(mappedUser);
            setUserStats(finalUserStats);
            setIsStatsLoaded(true);
          }

          

          // Fetch holdings from Appwrite
          try {
             const { databases } = await import("./appwrite");
             const { Query } = await import("appwrite");
             const uid = user.$id;
             
             // Fetch holdings
             const hDocs = await databases.listDocuments("pumpforge", "holdings", [
                Query.equal("userId", uid)
             ]);
             if (active) {
                setHoldings(hDocs.documents.map(d => ({
                   coinId: d.coinId,
                   amount: d.tokenAmount ?? d.amount ?? 0,
                   avgBuyPrice: d.avgBuyPrice ?? d.avgPrice ?? d.price ?? 0
                })));
             }
          } catch(e) {
             console.error("Failed to fetch holdings from Appwrite", e);
          }
        } else {
          // If search for standard session failed, but we ALREADY have a valid safeStorage cached session,
          // trust this cached state as a recovery fallback so cookie block does not break login state.
          const cachedUserStr = safeStorage.getItem("cached_appwrite_user");
          const cachedStatsStr = safeStorage.getItem("cached_appwrite_stats");

          if (cachedUserStr && cachedStatsStr) {
            console.log(
              "⚡ Standard session blocked, but utilizing valid cached user session state in safeStorage as fallback.",
            );
            const parsedUser = JSON.parse(cachedUserStr);
            const parsedStats = JSON.parse(cachedStatsStr);

            if (active) {
              setCurrentUser(parsedUser);
              setUserStats(parsedStats);
              setIsStatsLoaded(true);
            }

            // Pre-populate from safeStorage caches for this user
            const cachedHoldings = safeStorage.getItem(
              `memex_holdings_${parsedUser.uid || parsedUser.$id}`,
            );
            if (active && cachedHoldings)
              setHoldings(JSON.parse(cachedHoldings));
          } else {
            // Throw error to trigger unauthenticated clean states
            throw new Error(
              "No active session found and no safeStorage cache is available.",
            );
          }
        }
      } catch (err: any) {
        console.log(
          "No Appwrite session found or failed to fetch session:",
          err,
        );

        // Exclude generic 401 unauthenticated signals to avoid popping up alerts on regular guest players,
        // but alert all other unexpected system/network/database errors or oauth failures.
        const isNormalUnauthenticated =
          err?.code === 401 ||
          err?.message?.includes("unauthorized") ||
          String(err).includes("401") ||
          err?.message?.includes("No active session found");
        if (!isNormalUnauthenticated) {
          triggerToast("Diagnostic Error", err?.message || String(err), true);
        }

        // Clean up session caches on standard session failures
        safeStorage.removeItem("cached_appwrite_user");
        safeStorage.removeItem("cached_appwrite_stats");

        if (active) {
          setCurrentUser(null);
          setIsStatsLoaded(false);
          setUserStats({
            username: "Guest Player",
            handle: "@guest_degen",
            title: "Member",
            isPremium: false,
            nameColor: "text-zinc-400 font-extrabold",
            cash: 5000.0,
            gems: 90,
            prestigeLevel: 0,
            totalProfit: 0,
            coinsCreatedCount: 0,
            tradesCount: 0,
            lastDailyRewardClaim: null,
            email: "",
            createdAt: new Date().toISOString(),
          });
          setHoldings([]);
        }
      } finally {
        if (active) {
          setIsCheckingRedirect(false);
          setIsLoading(false);
          clearTimeout(failsafeTimer);
        }
      }
    };

    initSession();

    return () => {
      active = false;
      clearTimeout(failsafeTimer);
    };
  }, []);

  // Sync state changes back to Appwrite Database if user stats are fully loaded
  useEffect(() => {
    if (!currentUser || !isStatsLoaded) return;

    const syncToAppwrite = async () => {
      try {
        const totalCoinsOwned = holdings.reduce((sum, h) => sum + h.amount, 0);
        await databases.updateDocument(
          "pumpforge",
          "users",
          currentUser.uid || currentUser.$id,
          {
            userId: currentUser.uid || currentUser.$id,
            username: userStats.username,
            cash: Number(userStats.cash || 0.0),
            coins: Number(totalCoinsOwned || 0.0),
            gems: parseInt(String(userStats.gems || 0), 10),
            prestigeLevel: parseInt(String(userStats.prestigeLevel || 0), 10),
            lastDailyRewardClaim: userStats.lastDailyRewardClaim || "",
          },
        );

        // Also keep stats storage cache up-to-date with current state modifications
        safeStorage.setItem("cached_appwrite_stats", JSON.stringify(userStats));
      } catch (e) {
        console.error("Failed to sync state to Appwrite databases:", e);
      }
    };

    const handler = setTimeout(syncToAppwrite, 1500);
    return () => clearTimeout(handler);
  }, [
    userStats.cash,
    userStats.gems,
    userStats.prestigeLevel,
    userStats.lastDailyRewardClaim,
    holdings,
    currentUser,
    isStatsLoaded,
  ]);

  // Authentication Callbacks
  const handleGoogleSignIn = async () => {
    setIsCheckingRedirect(true);
    try {
      // Clear legacy storage cache to guarantee fresh login
      safeStorage.removeItem("cached_appwrite_user");
      safeStorage.removeItem("cached_appwrite_stats");
      account.createOAuth2Session(
        "google" as any,
        window.location.origin,
        window.location.origin,
      );
    } catch (e: any) {
      console.error("Appwrite Google sign-in failed:", e);
      alert(
        `Appwrite Auth Error: ${e?.message || "Failed to start OAuth session"}`,
      );
      setIsCheckingRedirect(false);
    }
  };

  const handleSignOut = async () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutConfirm(false);
    toast.loading("Logging out...", { id: "logout-toast" });

    // 1. Optimistically Update the UI Instantly
    setCurrentUser(null);
    setIsStatsLoaded(false);
    setUserStats({
      username: "Guest Player",
      handle: "@guest_degen",
      title: "Member",
      isPremium: false,
      nameColor: "text-zinc-400 font-extrabold",
      cash: 5000.0,
      gems: 90,
      prestigeLevel: 0,
      totalProfit: 0,
      coinsCreatedCount: 0,
      tradesCount: 0,
      lastDailyRewardClaim: null,
      lastClaimed: null,
    });
    setHoldings([]);
    
    // Clear major caches
    safeStorage.removeItem("cached_appwrite_user");
    safeStorage.removeItem("cached_appwrite_stats");
    const keysToClear = [];
    for (let i = 0; i < safeStorage.length; i++) {
        const key = safeStorage.key(i);
        if (key && (key.includes("memex_") || key.includes("cached_appwrite_"))) {
            keysToClear.push(key);
        }
    }
    keysToClear.forEach((k) => safeStorage.removeItem(k));
    localStorage.removeItem("pf_session_valid");
    localStorage.removeItem("pf_fallback_userId");
    localStorage.removeItem("pf_last_claimed");

    // 2. Perform background logout without blocking UI
    setTimeout(async () => {
      try {
        await account.deleteSession("current");
      } catch (e) {
        console.error("Appwrite Sign out error:", e);
      } finally {
        toast.success("Successfully logged out.", { id: "logout-toast" });
        onAddNotification(
          "Signed Out",
          "Returned to Guest Sandbox mode.",
          "info",
        );
        window.location.reload();
      }
    }, 10);
  };

  // 1. GLOBAL USER BETS LISTENER (REAL-TIME SYNCED FROM FIRESTORE)
  useEffect(() => {
    if (!currentUser) {
      setUserBets({});
      return;
    }
  }, [currentUser]);

  // 2. FIRESTORE AUTHENTICATION & MULTI-USER REAL-TIME SUBSCRIPTIONS
  // permanently migrated to Appwrite account.get() & databases.getDocument() on start
  useEffect(() => {
    // Session states are handled via Appwrite in the main initializer
  }, []);

  // 3. GLOBAL SHARED COINS, TRADES FEED & MARKETS SYNC
  useEffect(() => {
    // Coins global listener
    const fetchCoins = async () => {
      try {
        const { Query } = await import("appwrite");
        const res = await databases.listDocuments("pumpforge", "coins", [
          Query.limit(100),
        ]);
        const appwriteCoins = res.documents.map((d) => {
          const c = { ...d } as any;
          delete c.$databaseId;
          delete c.$collectionId;
          delete c.$permissions;
          delete c.$updatedAt;
          if (c.creator === "@zeke" || c.creator === "zeke") {
            c.creator = "@system";
          }
          c.id = d.$id;
          c.createdAt = d.$createdAt;

          c.supply = c.supply || 1000000;
          c.marketCap = c.marketCap || Math.floor((c.price || 0.01) * c.supply);
          c.totalLiquidity = d.total_value || c.totalLiquidity || c.marketCap || 1000;
          c.volume24h = c.volume24h || 0;
          c.change24h = c.change24h || 0;
          c.history =
            c.history && Array.isArray(c.history) && c.history.length > 0
              ? c.history
              : [c.price || 0.01];
          c.avatarEmoji = c.avatarEmoji || "🪙";
          c.avatarBg = c.avatarBg || "bg-zinc-900 border-zinc-800";

          return c as MemeCoin;
        });

        const appwriteMap = new Map(appwriteCoins.map((c) => [c.id, c]));
        const mergedCoins: MemeCoin[] = [];

        INITIAL_COINS.forEach((initCoin) => {
          if (appwriteMap.has(initCoin.id)) {
            mergedCoins.push(appwriteMap.get(initCoin.id)!);
            appwriteMap.delete(initCoin.id);
          } else {
            mergedCoins.push(initCoin);
          }
        });

        appwriteCoins.forEach((appCoin) => {
          if (appwriteMap.has(appCoin.id)) {
            mergedCoins.push(appCoin);
          }
        });

        setCoins((prev) => {
          const prevMap = new Map<string, MemeCoin>((prev || []).map((c) => [c.id, c]));
          const appwriteMap = new Map<string, MemeCoin>(appwriteCoins.map((c) => [c.id, c]));
          const mergedCoins: MemeCoin[] = [];

          INITIAL_COINS.forEach((initCoin) => {
            const fromPrev = prevMap.get(initCoin.id);
            const fromAppwrite = appwriteMap.get(initCoin.id);

            const bestPrice = Math.max(
              initCoin.price || 0,
              fromPrev?.price || 0,
              fromAppwrite?.price || 0
            );
            const bestVol = Math.max(
              fromPrev?.volume24h || 0,
              fromAppwrite?.volume24h || 0,
              initCoin.volume24h || 0
            );
            const bestHist =
              fromPrev?.history && fromPrev.history.length > 1
                ? fromPrev.history
                : fromAppwrite?.history && fromAppwrite.history.length > 1
                ? fromAppwrite.history
                : initCoin.history;

            const baseCoin = fromAppwrite || fromPrev || initCoin;
            const updated: MemeCoin = {
              ...baseCoin,
              price: bestPrice,
              marketCap: Math.floor((baseCoin.supply || 1000000) * bestPrice),
              volume24h: bestVol,
              history: bestHist,
            };
            mergedCoins.push(updated);

            appwriteMap.delete(initCoin.id);
            prevMap.delete(initCoin.id);
          });

          appwriteCoins.forEach((appCoin) => {
            if (appwriteMap.has(appCoin.id)) {
              const fromPrev = prevMap.get(appCoin.id);
              const bestPrice = Math.max(appCoin.price || 0, fromPrev?.price || 0);
              const bestHist =
                fromPrev?.history && fromPrev.history.length > 1
                  ? fromPrev.history
                  : appCoin.history;

              mergedCoins.push({
                ...appCoin,
                price: bestPrice,
                marketCap: Math.floor((appCoin.supply || 1000000) * bestPrice),
                history: bestHist,
              });
              appwriteMap.delete(appCoin.id);
              prevMap.delete(appCoin.id);
            }
          });

          prevMap.forEach((localCoin: MemeCoin) => {
            mergedCoins.push(localCoin);
          });

          safeStorage.setItem("pumpforge_cached_coins", JSON.stringify(mergedCoins));
          return mergedCoins;
        });
      } catch (err) {
        console.error("Appwrite coins fetch error:", err);
      }
    };

    fetchCoins();
    const coinsUnsub = client.subscribe("databases.pumpforge.collections.coins.documents", () => {
       fetchCoins();
    });

    // Prediction markets live feed Appwrite Real-Time
    const fetchPredictionMarkets = async () => {
      try {
        const { Query } = await import("appwrite");
        const res = await databases.listDocuments("pumpforge", "polymarkets", [
          Query.limit(100),
          Query.orderDesc("$createdAt"),
        ]);

        if (res.documents.length > 0) {
          const list: PredictionMarket[] = res.documents.map((d: any) => {
            const parts = (d.question || "").split(" --- ");
            const question = parts[0] || d.question || "Untitled Prediction";
            const description = parts[1] || "";
            const yesPool = Number(d.poolYes || 0);
            const noPool = Number(d.poolNo || 0);
            const total = yesPool + noPool;
            const yesPercentage = total > 0 ? Math.round((yesPool / total) * 100) : 50;

            const endDateIso = d.endDate || undefined;
            const resolvedAt = d.resolvedAt || (d.status === "closed" ? d.$updatedAt : undefined);

            return {
              id: d.$id,
              question,
              description,
              yesPool,
              noPool,
              yesPercentage,
              userBetAmount: 0,
              userBetSide: null,
              resolved: d.status === "closed",
              resolvedOutcome:
                d.winningOutcome === "YES" || d.winningOutcome === "NO"
                  ? d.winningOutcome
                  : null,
              resolvedAt,
              endTime: endDateIso || "TBD",
              endDateIso,
              category: "general",
            };
          });

          // Filter: Active markets always stay; resolved markets only stay for 3 days (72 hours)
          const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
          const nowMs = Date.now();
          const filteredList = list.filter((m) => {
            if (!m.resolved) return true;
            const resolvedTime = new Date(m.resolvedAt || m.endDateIso || m.endTime || 0).getTime();
            if (resolvedTime <= 0) return true;
            return nowMs - resolvedTime <= THREE_DAYS_MS;
          });

          setMarkets(filteredList);
          safeStorage.setItem("pumpforge_polymarkets", JSON.stringify(filteredList));
        } else {
          const nowMs = Date.now();
          const DEFAULT_MARKETS: PredictionMarket[] = [
            {
              id: "m1",
              question: "Will *ROAD hit a $150K valuation by Friday?",
              description: "Based on shill room hype, ROAD represents the premium culture asset.",
              yesPool: 4500,
              noPool: 3200,
              yesPercentage: 58,
              userBetAmount: 0,
              userBetSide: null,
              resolved: false,
              resolvedOutcome: null,
              endTime: new Date(nowMs + 5 * 86400000).toISOString(),
              endDateIso: new Date(nowMs + 5 * 86400000).toISOString(),
              category: "trading",
            },
            {
              id: "m2",
              question: "Will the Slots return a grand Jackpot win on next 10 attempts?",
              description: "Probabilities dictate slot engines have a high variance output.",
              yesPool: 150,
              noPool: 6400,
              yesPercentage: 2,
              userBetAmount: 0,
              userBetSide: null,
              resolved: false,
              resolvedOutcome: null,
              endTime: new Date(nowMs + 2 * 3600000).toISOString(),
              endDateIso: new Date(nowMs + 2 * 3600000).toISOString(),
              category: "arcade",
            },
            {
              id: "m3",
              question: "Will Zeke reach Prestige I status inside the next 12 hours?",
              description: "Requires $100K liquid cash balance to trigger Prestige system.",
              yesPool: 8500,
              noPool: 1000,
              yesPercentage: 89,
              userBetAmount: 0,
              userBetSide: null,
              resolved: true,
              resolvedOutcome: "YES",
              endTime: new Date(nowMs - 86400000).toISOString(),
              endDateIso: new Date(nowMs - 86400000).toISOString(),
              category: "general",
            },
          ];
          setMarkets(DEFAULT_MARKETS as any[]);
        }
      } catch (err) {
        console.error("Failed to fetch Appwrite polymarkets:", err);
      }
    };

    fetchPredictionMarkets();

    const polymarketsUnsub = client.subscribe(
      "databases.pumpforge.collections.polymarkets.documents",
      () => {
        fetchPredictionMarkets();
      }
    );
          
    // Trades live feed Appwrite Real-Time
    const fetchTrades = async () => {
      try {
        const { Query } = await import("appwrite");
        const res = await databases.listDocuments("pumpforge", "trades", [
          Query.equal("isSimulated", false),
          Query.orderDesc("$createdAt"),
          Query.limit(15)
        ]);
        
        const list: LiveTrade[] = res.documents.map((d: any) => {
             const coinDetails = coins.find(c => c.id === d.coinId);
             
             return {
                 id: d.$id,
                 timestamp: new Date(d.$createdAt).toLocaleTimeString(),
                 type: d.type as any,
                 coinId: d.coinId,
                 coinSymbol: d.coinTicker || coinDetails?.symbol || "UNKNOWN",
                 coinTicker: d.coinTicker,
                 coinName: coinDetails?.name || "Unknown",
                 amountTokens: 0,
                 amountUsd: d.amount, 
                 userHandle: d.userName || d.userId, // use userName if available
                 userName: d.userName,
                 userId: d.userId
             };
        });
        
        setLiveTrades(list);

      } catch (err) {
        console.error("Failed to fetch Appwrite trades:", err);
      }
    };
    
    fetchTrades();
    
    const tradesUnsub = client.subscribe("databases.pumpforge.collections.trades.documents", (response) => {
       fetchTrades();
    });

    // Real-time dynamic synced participants list from database
    const usersUnsub = () => {}; setRegisteredUsers([]);

    // Broadcasts global real-time listener & initial fetch
    const fetchBroadcasts = async () => {
      try {
        const { Query } = await import("appwrite");
        const res = await databases.listDocuments("pumpforge", "broadcasts", [
          Query.orderDesc("timestamp"),
          Query.limit(50),
        ]);
        const now = Date.now();
        const activeBroadcasts = res.documents
          .map((doc: any) => ({
            id: doc.id || doc.$id,
            title: doc.title || "Announcement",
            message: doc.message || "",
            type: (doc.type || "info") as "info" | "trade" | "crash" | "achievement",
            timestamp: doc.timestamp || doc.$createdAt,
            expiresAt: doc.expiresAt,
          }))
          .filter((b: any) => {
            if (b.expiresAt) {
              return new Date(b.expiresAt).getTime() > now;
            }
            return true;
          });
        setBroadcasts(activeBroadcasts);
      } catch (err) {
        console.warn("Failed to fetch Appwrite broadcasts:", err);
      }
    };

    fetchBroadcasts();

    let broadcastsUnsub = () => {};
    try {
      broadcastsUnsub = client.subscribe(
        "databases.pumpforge.collections.broadcasts.documents",
        () => {
          fetchBroadcasts();
        }
      );
    } catch (e) {
      console.warn("Broadcasts subscription error:", e);
    }

    return () => {
      coinsUnsub();
      tradesUnsub();
      usersUnsub();
      broadcastsUnsub();
      polymarketsUnsub();
    };
  }, []);

  // Removed redundant Appwrite POLLS sync here (migrated to PolymarketTab.tsx)

  useEffect(() => {
    let unsub = () => {};
    let wagersUnsub = () => {};

    if (currentUser?.uid || currentUser?.$id) {
      const uid = currentUser?.uid || currentUser?.$id;
      // Appwrite Real-time Notifications Subscription for active user
      try {
        unsub = client.subscribe(
          "databases.pumpforge.collections.notifications.documents",
          (response) => {
            if (response.events.includes("databases.*.collections.*.documents.*.create")) {
              const doc = response.payload as any;
              if (doc.userId === uid) {
                // Trigger local alert using existing helper
                onAddNotification(doc.title, doc.message, doc.type || "info");
              }
            }
          }
        );
      } catch (e) {
        console.warn("Appwrite Realtime subscription failed. (Skipping)", e);
      }

      // Appwrite Real-time Wagers Subscription & Fetch
      const fetchUserWagers = async () => {
        try {
          const { Query } = await import("appwrite");
          const res = await databases.listDocuments("pumpforge", "wagers", [
            Query.equal("userId", uid),
            Query.limit(100),
          ]);
          const betsMap: { [marketId: string]: { side: "YES" | "NO"; amount: number } } = {};
          for (const w of res.documents) {
            betsMap[w.polymarketId] = {
              side: w.choice === "YES" || w.choice === "NO" ? w.choice : "YES",
              amount: Number(w.amount || 0),
            };
          }
          setUserBets((prev) => {
            const merged = { ...prev, ...betsMap };
            safeStorage.setItem("pumpforge_user_bets", JSON.stringify(merged));
            return merged;
          });
        } catch (err) {
          console.warn("Failed to fetch user wagers from Appwrite:", err);
        }
      };

      fetchUserWagers();

      try {
        wagersUnsub = client.subscribe(
          "databases.pumpforge.collections.wagers.documents",
          () => {
            fetchUserWagers();
          }
        );
      } catch (e) {
        console.warn("Wagers realtime subscription failed:", e);
      }
    }
    return () => {
      unsub();
      wagersUnsub();
    };
  }, [currentUser]);

  // 4. WORKER INTERVALS
  // DAILY COOLDOWN INTERVAL WORKER
  useEffect(() => {
    const updateDailyCooldown = () => {
      // Priority 1: Check localStorage first for instant initial render sync
      // Priority 2: userStats from Appwrite Context later
      const cachedLastClaimed = localStorage.getItem("pf_last_claimed");
      let lastClaim = userStats?.lastClaimed || cachedLastClaimed;
      
      // Handle legacy nomenclature
      if (!lastClaim && userStats?.lastDailyRewardClaim) {
        lastClaim = userStats.lastDailyRewardClaim;
      }

      if (!lastClaim) {
        setIsDailyRewardAvailable(true);
        setDailyRewardTimer("Claim Available!");
        return;
      }

      const claimTime = new Date(lastClaim).getTime();
      const now = new Date().getTime();
      const dif = 24 * 60 * 60 * 1000 - (now - claimTime);

      if (dif <= 0) {
        setIsDailyRewardAvailable(true);
        setDailyRewardTimer("Claim Available!");
      } else {
        setIsDailyRewardAvailable(false);
        const hrs = Math.floor(dif / (1000 * 60 * 60));
        const mins = Math.floor((dif % (1000 * 60 * 60)) / (1000 * 60));
        setDailyRewardTimer(`Next in ${hrs}h ${mins}m`);
      }
    };

    updateDailyCooldown();
    const timer = setInterval(updateDailyCooldown, 45000); // refresh timer check
    return () => clearInterval(timer);
  }, [userStats?.lastClaimed, userStats?.lastDailyRewardClaim]);

  // Check for suspension expiration to auto-unsuspend
  useEffect(() => {
    if (userStats?.isSuspended && userStats.suspendedUntil) {
      if (userStats.suspendedUntil <= Date.now()) {
        if (currentUser) {
          
        } else {
          setUserStats((prev) => ({
            ...prev,
            isSuspended: false,
            suspendedUntil: undefined,
          }));
        }
      }
    }
  }, [userStats?.isSuspended, userStats?.suspendedUntil, currentUser]);

  // LIVE MARKET TICKING INTERVAL (removed to use real database)
  // [Removed interval]

  function onAddNotification(
    title: string,
    msg: string,
    type: "info" | "achievement" | "trade" | "crash" = "info",
  ) {
    const newItem: NotificationItem = {
      id: "notif-" + Math.random().toString(36).substring(3),
      title,
      message: msg,
      timestamp: new Date().toLocaleTimeString(),
      type,
    };
    setNotifications((prev) => [newItem, ...prev.slice(0, 5)]);

    // Trigger universal toast popup system (marked as error type if it is a black swan / crash)
    triggerToast(title, msg, type === "crash");
  }

  function handleDismissBroadcast(id: string) {
    setDismissedBroadcastIds((prev) => {
      const nextDismissed = [...prev, id];
      safeStorage.setItem(
        "dismissed_broadcasts",
        JSON.stringify(nextDismissed),
      );
      return nextDismissed;
    });
  }

  const handleClaimDailyReward = async () => {
    // Daily claim yields $1500 + 25% for each prestige level
    const mult = 1 + (userStats.prestigeLevel || 0) * 0.25;
    const cashYield = Math.floor(1500 * mult);

    if (!currentUser) {
      setSignInReason(
        `claim your $${cashYield.toLocaleString()} daily allowance`,
      );
      setShowSignInModal(true);
      return;
    }

    const cachedLastClaimed = localStorage.getItem("pf_last_claimed");
    let lastClaim = userStats.lastClaimed || cachedLastClaimed;
    if (!lastClaim && userStats.lastDailyRewardClaim) {
      lastClaim = userStats.lastDailyRewardClaim;
    }

    if (lastClaim) {
      const claimTime = new Date(lastClaim).getTime();
      const now = new Date().getTime();
      const dif = 24 * 60 * 60 * 1000 - (now - claimTime);
      if (dif > 0) {
        toast.error("Daily reward is not available yet. Please wait.");
        return;
      }
    }

    const nextClaimTime = new Date().toISOString();
    const nextCash = (userStats.cash || 5000) + cashYield;

    // Cache immediately in local storage for instant sync across refreshes
    localStorage.setItem("pf_last_claimed", nextClaimTime);

    try {
      if (currentUser.$id) {
        await databases.updateDocument("pumpforge", "users", currentUser.$id, {
          cash: Number(nextCash.toFixed(2)),
          lastClaimed: nextClaimTime,
        });
      }

      setUserStats((prev) => ({
        ...prev,
        cash: nextCash,
        lastClaimed: nextClaimTime,
      }));

      toast.success(`Claimed $${cashYield.toLocaleString()} daily reward!`);
      onAddNotification(
        "Daily claimed",
        `Gained $${cashYield.toLocaleString()} cash reward (Includes prestige mult)!`,
        "info",
      );
    } catch (e: any) {
      console.error("Daily claim Appwrite error:", e);
      toast.error(`Error claiming reward: ${e.message}`);
    }
  };

  const tradeAction = async (
    coinId: string,
    amountCoins: number,
    type: "BUY" | "SELL",
  ) => {
    const coin = coins.find((c) => c.id === coinId);
    if (!coin) return;

    const totalUsdVal = amountCoins * coin.price;

    if (type === "BUY") {
      if (!currentUser) {
        setSignInReason("buy meme-coin assets");
        setShowSignInModal(true);
        return;
      }

      if (userStats.cash < totalUsdVal) {
        triggerToast(
          "Transaction Failed",
          "Insufficient cash balance to purchase this asset!",
          true,
        );
        return;
      }
    } else {
      const existingHolding = holdings.find((h) => h.coinId === coinId);
      if (!existingHolding || existingHolding.amount < amountCoins) {
        triggerToast(
          "Transaction Failed",
          "You do not own that many tokens to sell!",
          true,
        );
        return;
      }
    }

    // Dynamic bonding curve price impact calculation with high surge capacity for meme coin buys
    const poolLiquidity = Math.max(100, coin.totalLiquidity || 250);
    const tradeRatio = totalUsdVal / poolLiquidity;

    let finalPrice: number;
    let newLiquidity: number;

    if (type === "BUY") {
      // 1. Exponential percentage multiplier for high raise
      const baseMultiplier = Math.pow(1 + tradeRatio * 1.5, 2.0);
      
      // 2. Direct dollar boost so buys easily push prices above $1.00+
      const dollarLift = (totalUsdVal / 100) * 0.75;
      
      const calculatedPrice = coin.price * baseMultiplier + dollarLift;
      finalPrice = Number(calculatedPrice.toFixed(4));
      newLiquidity = (coin.totalLiquidity || poolLiquidity) + totalUsdVal;
    } else {
      const sellImpact = Math.min(0.85, (totalUsdVal / (poolLiquidity + totalUsdVal)) * 1.2);
      const dollarDrop = (totalUsdVal / 100) * 0.35;
      const calculatedPrice = Math.max(0.000001, coin.price * (1 - sellImpact) - dollarDrop);
      finalPrice = Number(calculatedPrice.toFixed(4));
      newLiquidity = Math.max(50, (coin.totalLiquidity || poolLiquidity) - totalUsdVal);
    }

    const newMarketCap = Math.floor((coin.supply || 1000000) * finalPrice);
    const newVolume24h = (coin.volume24h || 0) + totalUsdVal;
    const historyArr = Array.isArray(coin.history) && coin.history.length > 0 ? coin.history : [coin.price];
    const nextHistory = [...historyArr.slice(-14), finalPrice];
    const firstHistPrice = nextHistory[0] || finalPrice;
    const newChange24h = Number((((finalPrice - firstHistPrice) / firstHistPrice) * 100).toFixed(2));

    const updatedCoin: MemeCoin = {
      ...coin,
      price: finalPrice,
      marketCap: newMarketCap,
      totalLiquidity: newLiquidity,
      volume24h: newVolume24h,
      change24h: newChange24h,
      history: nextHistory,
    };

    // ALWAYS update local coins state immediately and cache
    setCoins((prev) => {
      const next = prev.map((c) => (c.id === coinId ? updatedCoin : c));
      safeStorage.setItem("pumpforge_cached_coins", JSON.stringify(next));
      return next;
    });

    // ALWAYS sync updated coin state to Appwrite database
    syncCoinToAppwrite(coinId, updatedCoin);

    if (type === "BUY") {
      const existingHolding = holdings.find((h) => h.coinId === coinId);
      let nextAmount = amountCoins;
      let nextAvgBuyPrice = coin.price;

      if (existingHolding) {
        nextAmount = existingHolding.amount + amountCoins;
        nextAvgBuyPrice =
          (existingHolding.amount * existingHolding.avgBuyPrice + totalUsdVal) /
          nextAmount;
      }

      const nextCash = userStats.cash - totalUsdVal;
      const nextTradesCount = userStats.tradesCount + 1;

      setHoldings((prev) => {
        if (existingHolding) {
          return prev.map((h) =>
            h.coinId === coinId
              ? { ...h, amount: nextAmount, avgBuyPrice: nextAvgBuyPrice }
              : h,
          );
        } else {
          return [
            ...prev,
            { coinId, amount: amountCoins, avgBuyPrice: coin.price },
          ];
        }
      });

      setUserStats((prev) => ({
        ...prev,
        cash: nextCash,
        tradesCount: nextTradesCount,
      }));

      if (currentUser) {
        try {
          const uid = currentUser.uid || currentUser.$id;

          await databases.updateDocument("pumpforge", "users", uid, {
            cash: Number(nextCash.toFixed(2)),
            tradesCount: nextTradesCount,
          });

          // Sync holdings in Appwrite
          try {
            const { Query } = await import("appwrite");
            const holdingDocs = await databases.listDocuments("pumpforge", "holdings", [
              Query.equal("userId", uid),
              Query.equal("coinId", coinId)
            ]);

            if (holdingDocs.documents.length > 0) {
              await databases.updateDocument("pumpforge", "holdings", holdingDocs.documents[0].$id, {
                tokenAmount: nextAmount
              });
            } else {
              await databases.createDocument("pumpforge", "holdings", ID.unique(), {
                userId: uid,
                coinId: coinId,
                tokenAmount: nextAmount
              }, [
                 Permission.read(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())
              ]);
            }
          } catch (appwriteHoldingsErr) {
             console.warn("Appwrite holdings update skipped/failed:", appwriteHoldingsErr);
          }

          // Sync coin price update in Appwrite
          if (coinId) {
            try {
              await databases.updateDocument("pumpforge", "coins", coinId, {
                price: finalPrice,
                marketCap: newMarketCap,
                totalLiquidity: newLiquidity,
                total_value: newLiquidity,
                volume24h: newVolume24h,
                change24h: newChange24h,
                history: nextHistory,
              });
            } catch (updateErr) {
              try {
                await databases.createDocument("pumpforge", "coins", coinId, {
                  coinId: coinId,
                  creator: coin.creator || "@system",
                  name: coin.name,
                  symbol: coin.symbol,
                  description: coin.description || "",
                  price: finalPrice,
                  marketCap: newMarketCap,
                  totalLiquidity: newLiquidity,
                  total_value: newLiquidity,
                  volume24h: newVolume24h,
                  change24h: newChange24h,
                  history: nextHistory,
                  avatarEmoji: coin.avatarEmoji || "🪙",
                  avatarBg: coin.avatarBg || "bg-zinc-900 border-zinc-800",
                  supply: coin.supply || 1000000,
                }, [
                  Permission.read(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())
                ]);
              } catch (createErr) {
                console.warn("Failed to create missing coin in Appwrite on buy:", createErr);
              }
            }
          }

          // Log trade in Appwrite
          try {
            await databases.createDocument("pumpforge", "trades", ID.unique(), {
              coinId: coinId,
              userId: uid,
              userName: userStats.username || "Unknown",
              coinTicker: coin.symbol || "UNKNOWN",
              type: "BUY",
              amount: totalUsdVal,
              isSimulated: false
            }, [
              Permission.read(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())
            ]);
          } catch (tradeErr) {
            console.warn("Appwrite trade log skipped:", tradeErr);
          }
        } catch (e: any) {
          console.error("Appwrite trade buy error:", e);
        }
      }

      onAddNotification(
        "Buy Order filled",
        `Successfully bought ${amountCoins.toLocaleString()} *${coin.symbol} for $${totalUsdVal.toFixed(2)}`,
        "trade",
      );
    } else {
      // SELL
      const existingHolding = holdings.find((h) => h.coinId === coinId)!;
      const nextAmount = existingHolding.amount - amountCoins;
      const profitDelta = amountCoins * (coin.price - existingHolding.avgBuyPrice);
      const nextCash = userStats.cash + totalUsdVal;
      const nextProfit = userStats.totalProfit + profitDelta;
      const nextTradesCount = userStats.tradesCount + 1;

      setHoldings((prev) => {
        return prev
          .map((h) => {
            if (h.coinId === coinId) {
              return { ...h, amount: h.amount - amountCoins };
            }
            return h;
          })
          .filter((h) => h.amount > 0);
      });

      setUserStats((prev) => ({
        ...prev,
        cash: nextCash,
        totalProfit: nextProfit,
        tradesCount: nextTradesCount,
      }));

      if (currentUser) {
        try {
          const uid = currentUser.uid || currentUser.$id;

          await databases.updateDocument("pumpforge", "users", uid, {
            cash: Number(nextCash.toFixed(2)),
            totalProfit: Number(nextProfit.toFixed(4)),
            tradesCount: nextTradesCount,
          });

          // Sync holdings in Appwrite
          try {
            const { Query } = await import("appwrite");
            const holdingDocs = await databases.listDocuments("pumpforge", "holdings", [
              Query.equal("userId", uid),
              Query.equal("coinId", coinId)
            ]);

            if (holdingDocs.documents.length > 0) {
              const holdingId = holdingDocs.documents[0].$id;
              if (nextAmount <= 0) {
                await databases.deleteDocument("pumpforge", "holdings", holdingId);
              } else {
                await databases.updateDocument("pumpforge", "holdings", holdingId, {
                  tokenAmount: nextAmount
                });
              }
            }
          } catch (sellHoldErr) {
             console.warn("Appwrite sell holdings sync skipped:", sellHoldErr);
          }

          // Sync coin price update in Appwrite
          if (coinId) {
            try {
              await databases.updateDocument("pumpforge", "coins", coinId, {
                price: finalPrice,
                marketCap: newMarketCap,
                totalLiquidity: newLiquidity,
                total_value: newLiquidity,
                volume24h: newVolume24h,
                change24h: newChange24h,
                history: nextHistory,
              });
            } catch (updateErr) {
              try {
                await databases.createDocument("pumpforge", "coins", coinId, {
                  coinId: coinId,
                  creator: coin.creator || "@system",
                  name: coin.name,
                  symbol: coin.symbol,
                  description: coin.description || "",
                  price: finalPrice,
                  marketCap: newMarketCap,
                  totalLiquidity: newLiquidity,
                  total_value: newLiquidity,
                  volume24h: newVolume24h,
                  change24h: newChange24h,
                  history: nextHistory,
                  avatarEmoji: coin.avatarEmoji || "🪙",
                  avatarBg: coin.avatarBg || "bg-zinc-900 border-zinc-800",
                  supply: coin.supply || 1000000,
                }, [
                  Permission.read(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())
                ]);
              } catch (createErr) {
                console.warn("Failed to create missing coin in Appwrite on sell:", createErr);
              }
            }
          }

          // Log trade
          try {
            await databases.createDocument("pumpforge", "trades", ID.unique(), {
              coinId: coinId,
              userId: uid,
              userName: userStats.username || "Unknown",
              coinTicker: coin.symbol || "UNKNOWN",
              type: "SELL",
              amount: totalUsdVal,
              isSimulated: false
            }, [
              Permission.read(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())
            ]);
          } catch (tradeErr) {
            console.warn("Appwrite sell trade log skipped:", tradeErr);
          }
        } catch (e: any) {
          console.error("Appwrite trade sell error:", e);
        }
      }

      onAddNotification(
        "Sell order filled",
        `Sold ${amountCoins.toLocaleString()} *${coin.symbol} for $${totalUsdVal.toFixed(2)}`,
        "trade",
      );
    }
  };

  const handleLaunchOwnCoin = async (
    name: string,
    symbol: string,
    desc: string,
    emoji: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      setSignInReason("launch custom coins");
      setShowSignInModal(true);
      return { success: false, error: "User not signed in" };
    }

    const userOwnCoins = coins.filter((c) => c.creator === userStats.handle);
    if (userOwnCoins.length >= 10) {
      return {
        success: false,
        error: `❌ 10-COIN LIMIT: You already have 10 active coins. Delete one before launching another!`,
      };
    }

    if (userStats.cash < 1100) {
      return {
        success: false,
        error: `❌ INSUFFICIENT FUNDS: Launching a coin costs $1,100 list fee.`,
      };
    }

    const listPrice = 0.005;
    const cleanSymbol = symbol.toLowerCase().replace(/[^a-z0-9_\-]/g, "");
    const cleanRand = Math.random()
      .toString(36)
      .substring(2)
      .replace(/[^a-z0-9]/g, "");
    const coinId = `${cleanSymbol}-${cleanRand}`;

    const newMeme: MemeCoin = {
      id: coinId,
      name,
      symbol,
      creator: userStats.handle,
      description: desc,
      avatarEmoji: emoji,
      avatarBg: "bg-emerald-950 text-emerald-300 border-emerald-500",
      price: listPrice,
      marketCap: 1000,
      supply: 200000,
      volume24h: 300,
      change24h: 0,
      history: [listPrice, listPrice, listPrice, listPrice],
      isUserCreated: true,
    };

    const nextCash = userStats.cash - 1100;
    const nextCreatedCount = userStats.coinsCreatedCount + 1;

    if (currentUser) {
      try {
        // Appwrite persistent coin cache document initialization
        try {
          await databases.createDocument("pumpforge", "coins", coinId, {
            coinId: coinId,
            creatorId: currentUser.$id,
            creatorName: currentUser.name || "Zeke",
            creator: userStats.handle,
            name,
            symbol,
            description: desc,
            price: Number(listPrice),
            marketCap: 1000.0,
            volume24h: 300,
            change24h: 0,
          }, [
            Permission.read(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any())
          ]);
          console.log("Appwrite: Successfully cached coin document.");
        } catch (appwriteCoinErr) {
          console.warn(
            "Appwrite: Could not write coin, proceeding:",
            appwriteCoinErr,
          );
        }

        
        setUserStats((prev) => ({
          ...prev,
          cash: nextCash,
          coinsCreatedCount: nextCreatedCount,
        }));
      } catch (e: any) {
         console.error("Error creating coin:", e);
      }
    } else {
      setCoins((prev) => [newMeme, ...prev]);
      setUserStats((prev) => ({
        ...prev,
        cash: nextCash,
        coinsCreatedCount: nextCreatedCount,
      }));
    }

    onAddNotification(
      "Coin Created!",
      `Launched custom token *${symbol} as dev creator!`,
      "info",
    );
    return { success: true };
  };

  const handleDeleteOwnCoin = (coinId: string) => {
    setCoinToDelete(coinId);
  };

  const handleConfirmDeleteOwnCoin = async () => {
    if (!coinToDelete) return;
    const coinId = coinToDelete;
    setCoinToDelete(null);

    if (!currentUser) {
      setSignInReason("delete your created coins");
      setShowSignInModal(true);
      return;
    }

    const coin = coins.find((c) => c.id === coinId);
    if (!coin) return;

    if (currentUser) {
      try {
        // Delete document from Appwrite databases coins collection as requested
        try {
          await databases.deleteDocument("pumpforge", "coins", coinId);
          console.log(`Success deleting coin ${coinId} from Appwrite.`);
        } catch (appwriteDelErr) {
          console.warn(
            `Could not delete coin from Appwrite databases:`,
            appwriteDelErr,
          );
        }

        } catch (e) {}
    }

    // Immediately filter the local React state array to remove the item from the marketplace list dynamically
    setCoins((prev) => prev.filter((c) => c.id !== coinId));
    onAddNotification(
      "COIN DELETED",
      `Permanently removed *${coin.symbol} from listing records.`,
      "info",
    );
  };

  const handlePlacePolymarketBet = async (
    marketId: string,
    side: "YES" | "NO",
    amount: number,
  ) => {
    if (!currentUser) {
      setSignInReason("place prediction bets and earn money");
      setShowSignInModal(true);
      return;
    }

    if (amount <= 0) {
      toast.error("Please enter a valid bet amount.");
      return;
    }

    if (userStats.cash < amount) {
      toast.error("Insufficient cash balance for this bet.");
      return;
    }

    const market = markets.find((m) => m.id === marketId);
    if (!market) {
      toast.error("Market not found.");
      return;
    }

    if (market.resolved) {
      toast.error("This prediction market has already been resolved.");
      return;
    }

    const uid = currentUser.$id || currentUser.uid;
    const nextCash = userStats.cash - amount;

    // 1. Optimistic updates
    setUserStats((prev) => ({
      ...prev,
      cash: nextCash,
    }));

    const newYesPool = side === "YES" ? (market.yesPool || 0) + amount : (market.yesPool || 0);
    const newNoPool = side === "NO" ? (market.noPool || 0) + amount : (market.noPool || 0);
    const totalPool = newYesPool + newNoPool;
    const newYesPct = totalPool > 0 ? Math.round((newYesPool / totalPool) * 100) : 50;

    setMarkets((prev) =>
      prev.map((m) =>
        m.id === marketId
          ? {
              ...m,
              yesPool: newYesPool,
              noPool: newNoPool,
              yesPercentage: newYesPct,
            }
          : m
      )
    );

    setUserBets((prev) => {
      const updated = {
        ...prev,
        [marketId]: { side, amount },
      };
      safeStorage.setItem("pumpforge_user_bets", JSON.stringify(updated));
      return updated;
    });

    toast.success(`Position confirmed: $${amount.toLocaleString()} on ${side}!`);
    onAddNotification(
      "BET PLACED",
      `Wagered $${amount.toLocaleString()} on ${side} for "${market.question.slice(0, 32)}..."`,
      "trade"
    );

    // 2. Persist to Appwrite
    try {
      const { databases } = await import("./appwrite");
      const { ID, Permission, Role } = await import("appwrite");

      // Update user cash
      await databases.updateDocument("pumpforge", "users", uid, {
        cash: nextCash,
      });

      // Create wager document
      await databases.createDocument(
        "pumpforge",
        "wagers",
        ID.unique(),
        {
          userId: uid,
          polymarketId: marketId,
          amount: Number(amount),
          choice: side,
          isPaid: false,
        },
        [
          Permission.read(Role.any()),
          Permission.update(Role.any()),
        ]
      );

      // Update market pool numbers
      await databases.updateDocument("pumpforge", "polymarkets", marketId, {
        poolYes: newYesPool,
        poolNo: newNoPool,
      });
    } catch (e: any) {
      console.error("Polymarket wager sync error:", e);
    }
  };

  const handlePrestigeSystem = async () => {
    if (!currentUser) {
      setSignInReason("trigger Prestige resets and earn prestige rewards");
      setShowSignInModal(true);
      return;
    }

    try {
      const uid = currentUser.uid || currentUser.$id;
      // Fetch latest document state from Appwrite
      let latestUserDoc;
      try {
        latestUserDoc = await databases.getDocument("pumpforge", "users", uid);
      } catch (err) {
        console.error(
          "Appwrite: Could not fetch latest user state for prestige lookup.",
          err,
        );
      }

      const trueCashLevel = latestUserDoc?.cash ?? userStats.cash;
      const trueGemsLevel = latestUserDoc?.gems ?? userStats.gems;
      const truePrestigeLevel =
        latestUserDoc?.prestigeLevel ?? userStats.prestigeLevel;

      if (trueCashLevel < 100000.0) {
        triggerToast(
          "Requirement Not Met",
          `You must accumulate at least $100.00K in Cash Reserves. (Current: $${trueCashLevel.toLocaleString()})`,
          true,
        );
        return;
      }

      const nextLvl = truePrestigeLevel + 1;
      const title = PRESTIGE_NAMES[nextLvl - 1] || "Galactic Legend";

      try {
        await databases.updateDocument("pumpforge", "users", uid, {
          prestigeLevel: nextLvl,
          cash: 5000.0,
          gems: trueGemsLevel + 500,
          coins: 0.0,
        });
        console.log("Appwrite: Prestige Reset saved successfully.");
      } catch (appwritePrestigeErr) {
        console.error(
          "Appwrite: Could not write prestige progress update:",
          appwritePrestigeErr,
        );
      }

      // Reset local holdings cleanly
      setHoldings([]);

      setUserStats((prev) => ({
        ...prev,
        cash: 5000.0,
        gems: trueGemsLevel + 500,
        prestigeLevel: nextLvl,
        title,
        totalProfit: 0,
        tradesCount: 0,
        coinsCreatedCount: 0,
      }));

      onAddNotification(
        "PRESTIGE ACQUIRED",
        `Advanced to ${title}! Daily reward multiplier active!`,
        "achievement",
      );
      triggerToast(
        "Prestige Completed!",
        `Leveled up to Prestige Level ${nextLvl}! Your cash and holdings have reset with bonuses.`,
      );
    } catch (e) {
      console.error("Critical Prestige system execution error:", e);
      triggerToast(
        "Prestige Error",
        "Failed to complete prestige pipeline successfully.",
        true,
      );
    } finally {
      // Completely close the prestige modal context cleanly without freezing the screen layout
      setShowPrestigeModal(false);
    }
  };

  const handleSubmitBug = async (
    title: string,
    description: string,
    category: string,
  ): Promise<boolean> => {
    if (!currentUser) {
      setSignInReason("submit a bug report");
      setShowSignInModal(true);
      return false;
    }

    // Fast-rate limiting check via localStorage to protect database writes
    const rateLimitKey = `last_bug_reported_${currentUser.uid}`;
    const lastReport = safeStorage.getItem(rateLimitKey);
    if (lastReport) {
      const elapsed = Date.now() - parseInt(lastReport);
      const limitMs = 30 * 1000; // 30 seconds limit to avoid spam or accidental double submissions
      if (elapsed < limitMs) {
        const remaining = Math.ceil((limitMs - elapsed) / 1000);
        triggerToast(
          "Rate Limit Active",
          `Please wait ${remaining}s before reporting another issue.`,
          true,
        );
        return false;
      }
    }

    const bugId = `bug-${Date.now()}`;
    const newBug = {
      id: bugId,
      title,
      description,
      category,
      userId: currentUser.uid || currentUser.$id,
      userHandle: userStats.handle,
      userName:
        currentUser.displayName || userStats.username || "Appwrite Player",
      userEmail: currentUser.email || "",
      reportedBy: `${currentUser.displayName || userStats.username || "Appwrite Player"} (${currentUser.email || "No Email"}) [${userStats.handle || "@guest"}]`,
      timestamp: new Date().toISOString(),
      status: "open",
    };

    try {
      const { databases } = await import("./appwrite");
      const { ID } = await import("appwrite");
      await databases.createDocument("pumpforge", "bugs", ID.unique(), newBug);
    } catch (e) {
      console.error("Appwrite bug report failed", e);
    }
    
    safeStorage.setItem(rateLimitKey, Date.now().toString());
    onAddNotification(
      "Report Sent",
      "Your bug report has been logged. Thank you!",
      "info"
    );
    return true;
  };

  const handleUpdateStats = (updater: (stats: UserStats) => void) => {
    setUserStats((prev) => {
      const clone = { ...prev };
      updater(clone);

      if (currentUser) {
         import("./appwrite").then(({ databases }) => {
            databases.updateDocument("pumpforge", "users", currentUser.uid || currentUser.$id, {
               cash: Number(clone.cash.toFixed(2)),
               gems: clone.gems,
               totalProfit: clone.totalProfit,
               tradesCount: clone.tradesCount,
               prestigeLevel: clone.prestigeLevel,
               title: clone.title,
               username: clone.username,
               handle: clone.handle,
               nameColor: clone.nameColor,
               isPremium: clone.isPremium,
            }).catch(e => console.error("Appwrite stats auto-save err:", e));
         });
      }

      return clone;
    });
  };

  if (isCheckingRedirect || isLoading) {
    return <PumpForgeLoadingScreen />;
  }

  if (userStats?.isSuspended || userStats?.isBanned) {
    const isBannedObj = !!userStats?.isBanned;
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none font-mono">
        <div
          className={`max-w-md bg-zinc-900/60 border rounded-2xl p-8 flex flex-col items-center gap-6 shadow-2xl transition-all ${
            isBannedObj
              ? "border-red-600/40 shadow-[0_0_50px_rgba(220,38,38,0.12)]"
              : "border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.08)]"
          }`}
        >
          <div
            className={`w-16 h-16 rounded-full border flex items-center justify-center shadow-lg animate-pulse ${
              isBannedObj
                ? "bg-red-500/10 border-red-550/30 text-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                : "bg-amber-500/10 border-amber-550/30 text-amber-550 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
            }`}
          >
            {isBannedObj ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h1
              className={`text-xl font-black uppercase tracking-widest ${isBannedObj ? "text-red-500" : "text-amber-500"}`}
            >
              {isBannedObj ? "Profile Banned" : "Profile Suspended"}
            </h1>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-extrabold font-mono">
              {isBannedObj
                ? "Permanent Account Exclusion"
                : "Temporary Sandbox Cool Down"}
            </p>
          </div>
          <div className="text-sm text-zinc-400 font-mono leading-relaxed bg-zinc-950/60 p-4 rounded-xl border border-zinc-900">
            {isBannedObj ? (
              <span>
                "Your profile{" "}
                <span className="text-red-400 font-extrabold">
                  {userStats.handle}
                </span>{" "}
                has been{" "}
                <span className="text-red-500 underline font-black">
                  permanently banned
                </span>{" "}
                by administrative operators due to safety checks, security
                rules, or sandbox terminal violations. Both suspension and ban
                states can be lifted by an authorized administrator/owner."
              </span>
            ) : (
              <span>
                "Your profile{" "}
                <span className="text-amber-400 font-extrabold">
                  {userStats.handle}
                </span>{" "}
                is{" "}
                <span className="text-amber-500 underline font-extrabold">
                  temporarily suspended
                </span>{" "}
                by administrative operators due to safety, risk auditing, or
                trading-volume parameters. Administrators can lift
                this state at any time."
              </span>
            )}
          </div>
          <div
            className={`text-[10px] uppercase tracking-widest font-black flex items-center gap-1.5 pt-2 ${isBannedObj ? "text-red-650" : "text-amber-600"}`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${isBannedObj ? "bg-red-600" : "bg-amber-500"}`}
            ></span>
            {isBannedObj
              ? "Administrative Permanent Exclusion"
              : "Administrative Temporary Lockdown"}
          </div>
          <button
            onClick={() => handleConfirmSignOut()}
            className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-250 text-xs font-black uppercase tracking-wider rounded-lg transition-all"
          >
            Sign Out Profile
          </button>
        </div>
      </div>
    );
  }

  const handleHardResetGame = async () => {
    setUserStats(prev => ({ ...prev, cash: 5000, gems: 0, coinsCreatedCount: 0, totalProfit: 0, tradesCount: 0, prestigeLevel: 0 }));
    setHoldings([]);
    setUserBets({});
    toast.success("Game reset to defaults.");
  };

  const mergedMarkets = markets.map((m) => {
    const userBet = userBets[m.id];
    if (userBet) {
      return {
        ...m,
        userBetAmount: userBet.amount,
        userBetSide: userBet.side,
      };
    }
    return m;
  });

  const handleCreatePredictionLocal = async (marketData: any) => {
    try {
      const { databases } = await import("./appwrite");
      const { ID, Permission, Role } = await import("appwrite");

      const isoDate = marketData.endDateIso || parseDateToIso(marketData.endTime);
      const combinedQuestion = marketData.description
        ? `${marketData.question} --- ${marketData.description}`
        : marketData.question;

      const doc = await databases.createDocument(
        "pumpforge",
        "polymarkets",
        ID.unique(),
        {
          question: combinedQuestion,
          endDate: isoDate,
          status: "active",
          poolYes: 0,
          poolNo: 0,
          winningOutcome: null,
        },
        [
          Permission.read(Role.any()),
          Permission.update(Role.any()),
        ]
      );

      const newMarket: PredictionMarket = {
        id: doc.$id,
        question: marketData.question,
        description: marketData.description || "",
        yesPool: 0,
        noPool: 0,
        yesPercentage: 50,
        userBetAmount: 0,
        userBetSide: null,
        resolved: false,
        resolvedOutcome: null,
        endTime: isoDate,
        endDateIso: isoDate,
        category: "general",
      };

      setMarkets((prev) => [newMarket, ...prev]);
      safeStorage.setItem("pumpforge_polymarkets", JSON.stringify([newMarket, ...markets]));
      toast.success("Prediction market proposed & published live!");
      onAddNotification(
        "MARKET PROPOSED",
        `New prediction market created: "${marketData.question}"`,
        "info"
      );
    } catch (err: any) {
      console.error("Error creating polymarket in Appwrite:", err);
      const localId = "m_" + Date.now();
      const fallbackMarket: PredictionMarket = {
        id: localId,
        question: marketData.question,
        description: marketData.description || "",
        yesPool: 0,
        noPool: 0,
        yesPercentage: 50,
        userBetAmount: 0,
        userBetSide: null,
        resolved: false,
        resolvedOutcome: null,
        endTime: marketData.endTime || "TBD",
        category: "general",
      };
      setMarkets((prev) => [fallbackMarket, ...prev]);
      toast.success("Prediction market created locally.");
    }
  };

  const handleSendMoney = async (handle: string, amount: number, type: string) => {
    if (!currentUser) return { success: false, message: "Not logged in" };
    
    if (type === "gem") {
      if (userStats.gems < amount) {
        return { success: false, message: "Not enough gems" };
      }
      setUserStats(prev => ({ ...prev, gems: prev.gems - Math.floor(amount) }));
    } else {
      if (userStats.cash < amount) {
        return { success: false, message: "Not enough cash" };
      }
      setUserStats(prev => ({ ...prev, cash: prev.cash - amount }));
    }
    
    // Attempt Appwrite doc update theoretically for receiver if possible
    try {
      const { Query } = await import("appwrite");
      const { databases: db } = await import("./appwrite");
      
      const res = await db.listDocuments("pumpforge", "users", [Query.equal("handle", handle)]);
      if (res.documents.length > 0) {
        const receiver = res.documents[0];
        if (type === "gem") {
           await db.updateDocument("pumpforge", "users", receiver.$id, { gems: (receiver.gems || 0) + Math.floor(amount) });
        } else {
           await db.updateDocument("pumpforge", "users", receiver.$id, { cash: (receiver.cash || 0) + amount });
        }
      }
    } catch (e) {
      console.warn("Appwrite send money error:", e);
    }
    
    return { success: true, message: `Sent to ${handle}` };
  };

  return (
    <div className="flex min-h-screen bg-[#09090d] text-zinc-100 flex-col md:flex-row relative selection:bg-rose-500/30 selection:text-white overflow-hidden">
      {/* Dynamic ambient luminous backdrop for genuine glass refraction */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-br from-rose-600/12 via-pink-600/5 to-transparent blur-3xl" />
        <div className="absolute top-[35%] -right-[10%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-bl from-indigo-600/10 via-purple-600/5 to-transparent blur-3xl" />
        <div className="absolute -bottom-[20%] left-[25%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-t from-emerald-600/8 via-teal-600/4 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.08),rgba(255,255,255,0))]" />
      </div>

      <Sidebar
        userStats={userStats}
        onClaimDailyReward={handleClaimDailyReward}
        liveTrades={liveTrades}
        registeredUsers={registeredUsers}
        onOpenPrestigeModal={() => setShowPrestigeModal(true)}
        onResetProgress={handleHardResetGame}
        dailyRewardTimer={dailyRewardTimer}
        isDailyRewardAvailable={isDailyRewardAvailable}
        currentUser={currentUser}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        coins={coins}
        holdings={holdings}
        onOpenBugReportModal={() => setShowBugReportModal(true)}
      />

      <main className="flex-1 min-w-0 p-5 md:p-8 max-w-7xl mx-auto flex flex-col gap-6 overflow-x-hidden relative z-10">
        {/* Real-time Synced Broadcast Banners */}
        {broadcasts
          .filter(
            (b) =>
              !dismissedBroadcastIds.includes(b.id) &&
              (!b.expiresAt || new Date(b.expiresAt).getTime() > Date.now()),
          )
          .map((b) => {
            // Determine styling theme based on type
            let icon = <BellRing className="w-5 h-5 text-indigo-400" />;
            let containerStyle =
              "glass-card border-indigo-500/20 text-indigo-300";
            let labelStyle = "text-indigo-400 bg-indigo-500/15 border border-indigo-500/30";

            if (b.type === "trade") {
              icon = <TrendingUp className="w-5 h-5 text-emerald-400" />;
              containerStyle =
                "glass-card border-emerald-500/20 text-emerald-300";
              labelStyle = "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30";
            } else if (b.type === "achievement") {
              icon = <Crown className="w-5 h-5 text-amber-400" />;
              containerStyle =
                "glass-card border-amber-500/20 text-amber-300";
              labelStyle = "text-amber-400 bg-amber-500/15 border border-amber-500/30";
            } else if (b.type === "crash") {
              icon = <Skull className="w-5 h-5 text-rose-450 animate-pulse" />;
              containerStyle =
                "glass-card border-rose-500/25 text-rose-300";
              labelStyle = "text-rose-400 bg-rose-500/15 border border-rose-500/30";
            } else if (b.type === "info") {
              icon = <Sparkles className="w-5 h-5 text-cyan-400" />;
              containerStyle =
                "glass-card border-cyan-500/20 text-cyan-300";
              labelStyle = "text-cyan-400 bg-cyan-500/15 border border-cyan-500/30";
            }

            return (
              <div
                key={b.id}
                className={`relative border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ease-in-out shadow-lg animate-fade-in ${containerStyle}`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-1 sm:mt-0 p-2 bg-black/40 rounded-xl border border-white/5 shrink-0 flex items-center justify-center">
                    {icon}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm tracking-wide text-white">
                        {b.title}
                      </span>
                      <span
                        className={`text-[8.5px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded ${labelStyle}`}
                      >
                        System Broadcast
                      </span>
                    </div>
                    <span className="text-xs text-zinc-350 leading-relaxed font-semibold">
                      {b.message}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(b.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() => handleDismissBroadcast(b.id)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white hover:text-white border border-white/10 hover:border-white/25 text-xs font-black rounded-xl tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Acknowledge</span>
                  </button>
                </div>
              </div>
            );
          })}

        {/* Tab Workspace Views content */}
        <Routes>
          <Route
            path="/"
            element={
              <HomeTab
                coins={coins}
                userStats={userStats}
                onTradeCoin={(coinId) => {
                  navigate(`/coin/${coinId}`);
                }}
              />
            }
          />

          <Route
            path="/coin/:coinId"
            element={
              <CoinRouteWrapper
                coins={coins}
                userStats={userStats}
                currentUser={currentUser}
                holdings={holdings}
                onTradeAction={tradeAction}
              />
            }
          />

          <Route
            path="/market"
            element={
              <MarketTab
                coins={coins}
                userStats={userStats}
                currentUser={currentUser}
                holdings={holdings}
                onTradeAction={tradeAction}
                onDeleteOwnCoin={handleDeleteOwnCoin}
              />
            }
          />

          <Route
            path="/polymarket"
            element={
              <PolymarketTab
                markets={mergedMarkets}
                onPlaceBet={handlePlacePolymarketBet}
                onCreateMarket={handleCreatePredictionLocal}
              />
            }
          />

          <Route
            path="/arcade"
            element={
              !currentUser ? (
                <div
                  className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center font-mono animate-fade-in max-w-xl mx-auto select-none"
                  id="arcade-lock-screen"
                >
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-805 flex items-center justify-center text-rose-500 mb-6 shadow-xl relative">
                    <Gamepad2 className="w-8 h-8" />
                    <Lock className="w-4 h-4 text-zinc-400 absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-1 box-content" />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">
                    Arcade Simulator Locked
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-8">
                    You are playing in Guest Sandbox. High-stakes arcade
                    operations (Coinflip, Slots, Mines, Dice, and Tower) require
                    a dynamic Google-authenticated profile to prevent session
                    loss and secure cash drops.
                  </p>
                  <button
                    onClick={handleGoogleSignIn}
                    className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2.5 shadow-lg shadow-rose-950/20 active:scale-98 transition-all text-xs uppercase tracking-wider font-mono"
                  >
                    <LogIn className="w-4 h-4 text-white" />
                    <span>Connect Google Profile</span>
                  </button>
                </div>
              ) : (
                <ArcadeTab
                  userStats={userStats}
                  onUpdateStats={handleUpdateStats}
                  onAddNotification={onAddNotification}
                />
              )
            }
          />

          <Route
            path="/leaderboard"
            element={
              <LeaderboardTab
                userStats={userStats}
                simulatedPlayers={simulatedPlayers}
              />
            }
          />

          <Route
            path="/shop"
            element={
              !currentUser ? (
                <div
                  className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center font-mono animate-fade-in max-w-xl mx-auto select-none"
                  id="shop-lock-screen"
                >
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-805 flex items-center justify-center text-amber-500 mb-6 shadow-xl relative">
                    <ShoppingBag className="w-8 h-8 font-bold" />
                    <Lock className="w-4 h-4 text-zinc-400 absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-1 box-content" />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">
                    Forge Shop Locked
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-8">
                    Purchasing rare profile colors and high-volume Mystery
                    Crates requires a Cloud Sync Profile. Secure your progress
                    and sync with our Appwrite database.
                  </p>
                  <button
                    onClick={handleGoogleSignIn}
                    className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2.5 shadow-lg shadow-rose-950/20 active:scale-98 transition-all text-xs uppercase tracking-wider font-mono"
                  >
                    <LogIn className="w-4 h-4 text-white" />
                    <span>Connect Google Profile</span>
                  </button>
                </div>
              ) : (
                <ShopTab
                  userStats={userStats}
                  onUpdateStats={handleUpdateStats}
                  onAddNotification={onAddNotification}
                />
              )
            }
          />

          <Route
            path="/portfolio"
            element={
              <PortfolioTab
                userStats={userStats}
                holdings={holdings}
                coins={coins}
                onUpdateStats={handleUpdateStats}
                onAddNotification={onAddNotification}
                onSendMoney={handleSendMoney}
                registeredUsers={registeredUsers}
              />
            }
          />

          <Route
            path="/treemap"
            element={
              <TreemapTab
                coins={coins}
                onTradeCoin={(coinId) => {
                  navigate(`/coin/${coinId}`);
                }}
              />
            }
          />

          <Route
            path="/create-coin"
            element={
              !currentUser ? (
                <div
                  className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center font-mono animate-fade-in max-w-xl mx-auto select-none"
                  id="create-lock-screen"
                >
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-805 flex items-center justify-center text-teal-500 mb-6 shadow-xl relative">
                    <PlusCircle className="w-8 h-8" />
                    <Lock className="w-4 h-4 text-zinc-400 absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-1 box-content" />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">
                    Create Token Locked
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-8">
                    Becoming a dev to mint custom coins, aggregate bot tracking
                    volume, and execute strategic trades requires Google profile
                    credentials.
                  </p>
                  <button
                    onClick={handleGoogleSignIn}
                    className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2.5 shadow-lg shadow-rose-950/20 active:scale-98 transition-all text-xs uppercase tracking-wider font-mono"
                  >
                    <LogIn className="w-4 h-4 text-white" />
                    <span>Connect Google Profile</span>
                  </button>
                </div>
              ) : (
                <CreateCoinTab setCoins={setCoins} coins={coins} />
              )
            }
          />

          <Route
            path="/notifications"
            element={<NotificationsTab notifications={notifications} />}
          />

          <Route
            path="/settings"
            element={
              <SettingsTab
                userStats={userStats}
                onUpdateStats={handleUpdateStats}
                currentUserEmail={currentUser?.email}
              />
            }
          />

          <Route
            path="/owner-dashboard"
            element={(() => {
              const isOwnerEmail =
                (currentUser?.email || "").trim().toLowerCase() ===
                  "realzekeee@gmail.com" ||
                (currentUser?.email || "").trim().toLowerCase() ===
                  "realzekee@gmail.com";
              const isStaff =
                userStats.title.toLowerCase() === "owner" ||
                userStats.title.toLowerCase() === "admin";
              const hasOwnerDashboard = isOwnerEmail || isStaff;

              if (!hasOwnerDashboard) {
                return (
                  <div
                    id="access-denied-panel"
                    className="flex flex-col items-center justify-center min-h-[500px] border border-red-950/40 bg-zinc-950 rounded-2xl p-8 font-mono text-center max-w-lg mx-auto my-12 animate-fade-in"
                  >
                    <div className="text-red-500 font-extrabold text-3xl mb-4">
                      🚨 ACCESS DENIED
                    </div>
                    <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
                      This control panel is strictly restricted to administrator
                      developers. Your attempts have been logged.
                    </p>
                    <button
                      id="return-home-btn"
                      onClick={() => navigate("/")}
                      className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-all duration-200"
                    >
                      Return to Safe Zone
                    </button>
                  </div>
                );
              }

              return (
                <OwnerDashboardTab
                  coins={coins}
                  setCoins={setCoins}
                  onAddNotification={onAddNotification}
                  simulatedPlayers={simulatedPlayers}
                  setSimulatedPlayers={setSimulatedPlayers}
                  liveTrades={liveTrades}
                  registeredUsers={registeredUsers}
                  currentUserEmail={currentUser?.email}
                />
              );
            })()}
          />

          <Route
            path="/owner/polymarket-resolve"
            element={(() => {
              const isOwnerEmail =
                (currentUser?.email || "").trim().toLowerCase() ===
                  "realzekeee@gmail.com" ||
                (currentUser?.email || "").trim().toLowerCase() ===
                  "realzekee@gmail.com";
              const isStaff =
                userStats.title.toLowerCase() === "owner" ||
                userStats.title.toLowerCase() === "admin";
              const hasOwnerDashboard = isOwnerEmail || isStaff;

              if (!hasOwnerDashboard) {
                return (
                  <div className="flex flex-col items-center justify-center min-h-[500px] border border-red-950/40 bg-zinc-950 rounded-2xl p-8 font-mono text-center max-w-lg mx-auto my-12 animate-fade-in">
                    <div className="text-red-500 font-extrabold text-3xl mb-4">🚨 ACCESS DENIED</div>
                    <button onClick={() => navigate("/")} className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-white font-bold text-xs rounded-xl uppercase">Return to Safe Zone</button>
                  </div>
                );
              }

              return <PolymarketAdminTab />;
            })()}
          />

          <Route path="/about" element={<AboutTab />} />
          <Route path="/trades" element={<TradesHistoryTab coins={coins} registeredUsers={registeredUsers} />} />

          <Route
            path="/profile"
            element={
              <ProfileTab
                userStats={userStats}
                holdings={holdings}
                coins={coins}
                liveTrades={liveTrades}
                onUpdateStats={handleUpdateStats}
                onOpenPrestigeModal={() => setShowPrestigeModal(true)}
              />
            }
          />
        </Routes>
      </main>

      {/* Extreme prestige popup confirmation */}
      {showPrestigeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="glass-modal p-6 rounded-2xl max-w-sm w-full relative font-mono text-center select-none animate-slide-up">
            <button
              onClick={() => setShowPrestigeModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-orange-500/15 border border-orange-500/30 text-orange-400 rounded-xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg shadow-orange-950/40 animate-pulse">
              👑
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Prestige Reset System
            </h3>
            <p className="text-xs text-zinc-300 mb-4 leading-relaxed font-semibold">
              Ready to reset your current gains to lock in permanent
              perks? Resetting requires{" "}
              <strong className="text-white">
                $100,000.00 cash reserves
              </strong>
              .
            </p>

            <div className="glass-card p-3.5 rounded-xl border border-white/10 text-xs text-left mb-4 flex flex-col gap-1.5 leading-normal">
              <span className="text-[10px] text-zinc-400 uppercase font-black">
                Prestige Gains:
              </span>
              <span className="text-emerald-400 font-bold">
                • Permanently increases daily rewards by +25%
              </span>
              <span className="text-cyan-400 font-bold">
                • Immediately unlocks +500 Gems
              </span>
              <span className="text-amber-400 font-bold">
                • Upgrades your public title next to name
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handlePrestigeSystem}
                className="w-full bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 py-3 rounded-xl font-bold font-mono text-xs text-white shadow-lg border border-white/20 active:scale-98 transition-all cursor-pointer"
              >
                Confirm Prestige Reset
              </button>
              <button
                onClick={() => setShowPrestigeModal(false)}
                className="w-full glass-card hover:bg-white/[0.08] py-2 rounded-xl text-zinc-400 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal customToast notifications */}
      {customToast && (
        <div
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md glass-panel border ${
            customToast.isError ? "border-rose-500/50 shadow-rose-950/50" : "border-cyan-500/50 shadow-cyan-950/50"
          } p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4 z-50 animate-fade-in`}
        >
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">
              {customToast.isError ? "❌" : "🔔"}
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-black text-white">
                {customToast.title}
              </span>
              <span className="text-[10px] text-zinc-300 mt-0.5">
                {customToast.message}
              </span>
            </div>
          </div>
          <button
            onClick={() => setCustomToast(null)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Sign-In Intercept Modal */}
      {showSignInModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          id="google-auth-intercept-modal"
        >
          <div className="glass-modal p-6 rounded-2xl max-w-sm w-full relative font-mono text-center select-none animate-slide-up">
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInReason("");
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg animate-pulse">
              🔒
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Authentication Required
            </h3>
            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              Google authentication is required to{" "}
              <span className="text-rose-400 font-semibold">
                {signInReason || "interact with this feature"}
              </span>
              . Sign in to link your progress, trade securely, and back up
              assets!
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  setShowSignInModal(false);
                  setSignInReason("");
                  await handleGoogleSignIn();
                }}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 py-3 rounded-xl font-bold font-mono text-xs text-white shadow-lg border border-white/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                id="modal-google-signin-btn"
              >
                <LogIn className="w-4 h-4 text-white" />
                <span>Sign in with Google</span>
              </button>
              <button
                onClick={() => {
                  setShowSignInModal(false);
                  setSignInReason("");
                }}
                className="w-full glass-card hover:bg-white/[0.08] py-2 rounded-xl text-zinc-400 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showBugReportModal && (
        <BugReportModal
          userStats={userStats}
          currentUser={currentUser}
          onClose={() => setShowBugReportModal(false)}
          onSubmitBug={handleSubmitBug}
        />
      )}

      {/* Delete Coin Confirmation Modal */}
      {coinToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="glass-modal p-6 rounded-2xl max-w-sm w-full relative font-mono text-center select-none animate-slide-up">
            <button
              onClick={() => setCoinToDelete(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg">
              🗑️
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Delete Listed Token?
            </h3>
            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="text-rose-400 font-bold">
                *{coins.find((c) => c.id === coinToDelete)?.symbol || "Token"}
              </span>{" "}
              from the listing records? This action is permanent and cannot be
              undone.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmDeleteOwnCoin}
                className="w-full bg-rose-600 hover:bg-rose-500 py-3 rounded-xl font-bold font-mono text-xs text-white shadow-lg border border-white/20 flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
              >
                Permanently Delete
              </button>
              <button
                onClick={() => setCoinToDelete(null)}
                className="w-full glass-card hover:bg-white/[0.08] py-2 rounded-xl text-zinc-400 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
              >
                Keep Listing (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="glass-modal p-6 rounded-2xl max-w-sm w-full relative font-mono text-center select-none animate-slide-up">
            <button
              onClick={() => setShowSignOutConfirm(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg">
              👋
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Log Out of Profile?
            </h3>
            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              Are you sure you want to sign out? You will be returned to Guest
              Sandbox mode, where progress is saved locally but not synced with
              the cloud.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmSignOut}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 py-3 rounded-xl font-bold font-mono text-xs text-white shadow-lg border border-white/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                Sign Out
              </button>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="w-full glass-card hover:bg-white/[0.08] py-2 rounded-xl text-zinc-400 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
