import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppContext } from "../context/AppContext";
import {
  ShieldAlert,
  Coins,
  Flame,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Plus,
  Minus,
  UserPlus,
  BellRing,
  Crown,
  Database,
  Skull,
  UserCheck,
  UserX,
  ShieldCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Clock,
  ClipboardList,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  Copy,
  Zap,
  Award,
  Sliders,
  DollarSign,
  Radio,
  Trash2,
  Edit3,
  Bot,
  Activity,
  Layers,
  Bug,
  Tag,
  CheckCircle2,
  XCircle,
  BarChart3,
  ChevronRight,
  Send,
  Ticket,
  Mail,
  Fingerprint,
  Star,
  RotateCcw,
  BadgeCheck,
  Lock,
  Unlock,
} from "lucide-react";
import { SkeletonLoader } from "./SkeletonLoader";
import {
  getStoredSanctions,
  saveStoredSanction,
  getStoredTitles,
  saveStoredTitle,
  getStoredRoles,
  saveStoredRole,
  clearStoredUserMeta,
} from "../utils/userMetaStorage";
import {
  UserStats,
  MemeCoin,
  SimulatedPlayer,
  LiveTrade,
} from "../types";
import { databases } from "../appwrite";
import { ID, Permission, Role, Query } from "appwrite";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface OwnerDashboardProps {
  coins: MemeCoin[];
  setCoins: React.Dispatch<React.SetStateAction<MemeCoin[]>>;
  onAddNotification: (
    title: string,
    message: string,
    type?: "info" | "achievement" | "trade" | "crash",
  ) => void;
  simulatedPlayers?: SimulatedPlayer[];
  setSimulatedPlayers?: React.Dispatch<React.SetStateAction<SimulatedPlayer[]>>;
  liveTrades?: LiveTrade[];
  registeredUsers?: any[];
  currentUserEmail?: string;
}

type AdminSubTab = "overview" | "users" | "market" | "coins" | "announcements" | "bugs";

export default function OwnerDashboardTab({
  coins,
  setCoins,
  onAddNotification,
  simulatedPlayers = [],
  setSimulatedPlayers,
  liveTrades = [],
  registeredUsers = [],
  currentUserEmail,
}: OwnerDashboardProps) {
  const navigate = useNavigate();
  const { userStats, cash, setCash, gems, setGems, userId, adminSettings, setAdminSettings } = useAppContext();
  const queryClient = useQueryClient();

  // Active sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>("overview");

  // Registered users query from Appwrite
  const { data: usersQueryData = [], isError: isUsersError, error: usersError } = useQuery({
    queryKey: ["registeredUsers"],
    queryFn: async () => {
      const res = await databases.listDocuments("pumpforge", "users", [Query.limit(1000)]);
      return res.documents;
    },
  });

  // Creator minting controls
  const [customCash, setCustomCash] = useState<number>(50000);
  const [customGems, setCustomGems] = useState<number>(500);

  // Announcement state
  const [alertTitle, setAlertTitle] = useState<string>("🚨 MARKET OVERDRIVE ACTIVE");
  const [alertMsg, setAlertMsg] = useState<string>("Central liquidity reserves injected into top circulation pools!");
  const [alertType, setAlertType] = useState<"info" | "trade" | "crash" | "achievement">("trade");
  const [broadcastTimeLimit, setBroadcastTimeLimit] = useState<number>(60); // minutes
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState(false);
  const [activeBroadcastsList, setActiveBroadcastsList] = useState<any[]>([]);

  // Bot Raid State
  const [botRaidCoinId, setBotRaidCoinId] = useState<string>("");
  const [botRaidDirection, setBotRaidDirection] = useState<"BUY" | "SELL">("BUY");
  const [botRaidIsRunning, setBotRaidIsRunning] = useState<boolean>(false);

  // Coin custom price inputs map
  const [customCoinPrices, setCustomCoinPrices] = useState<Record<string, string>>({});

  // Directory filter of players
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [suspendDurationDays, setSuspendDurationDays] = useState<number>(1);
  const [userMoneyDelta, setUserMoneyDelta] = useState<Record<string, number>>({});
  const [userGemsDelta, setUserGemsDelta] = useState<Record<string, number>>({});
  const [userExactCashInput, setUserExactCashInput] = useState<Record<string, string>>({});
  const [userExactGemsInput, setUserExactGemsInput] = useState<Record<string, string>>({});
  const [userCustomTitleDraft, setUserCustomTitleDraft] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedPlayerHandle, setExpandedPlayerHandle] = useState<string | null>(null);
  const [customActionTexts, setCustomActionTexts] = useState<Record<string, string>>({});

  // Local fallback activity logs
  const [localUserLogs, setLocalUserLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      action: string;
      category: "trade" | "system" | "auth" | "risk";
    }>
  >([
    {
      id: "u0",
      timestamp: new Date().toISOString(),
      action: "Authorized as administrative sandbox operator.",
      category: "auth",
    },
  ]);

  // Bug reports local real-time state
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [isPruningBugs, setIsPruningBugs] = useState(false);

  // User mutation loading state
  const [isMutatingUser, setIsMutatingUser] = useState<string | null>(null);

  // Promo Code Publisher State
  const [promoPubIsLoading, setPromoPubIsLoading] = useState(false);
  const [promoPubCode, setPromoPubCode] = useState("");
  const [promoPubType, setPromoPubType] = useState<"cash" | "gems">("cash");
  const [promoPubAmount, setPromoPubAmount] = useState("");
  const [promoPubExpiresAt, setPromoPubExpiresAt] = useState("");

  // User Management Dropdown State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");

  // Permissions error toast effect
  useEffect(() => {
    if (isUsersError && (usersError as any)?.code === 403) {
      toast.error("Owner Dashboard Error (403): Appwrite permissions restriction.");
    }
  }, [isUsersError, usersError]);

  // Fetch bugs from Appwrite
  useEffect(() => {
    let active = true;
    const fetchBugs = async () => {
      try {
        const res = await databases.listDocuments("pumpforge", "bugs", [Query.orderDesc("timestamp"), Query.limit(100)]);
        if (active) {
          setBugReports(res.documents.map((d) => ({ id: d.$id, ...d })));
        }
      } catch (err) {
        // Appwrite collection might be fresh
      }
    };
    fetchBugs();
    return () => {
      active = false;
    };
  }, []);

  // Fetch active broadcasts from Appwrite
  const fetchActiveBroadcasts = async () => {
    try {
      const res = await databases.listDocuments("pumpforge", "broadcasts", [
        Query.orderDesc("timestamp"),
        Query.limit(50),
      ]);
      setActiveBroadcastsList(res.documents);
    } catch (e) {
      // fresh collection
    }
  };

  useEffect(() => {
    fetchActiveBroadcasts();
  }, []);

  const appwriteUsers = usersQueryData;

  // Sync state update helper
  const onUpdateStats = (updater: (stats: UserStats) => void) => {
    const newStats = { ...(userStats || {}) } as UserStats;
    updater(newStats);
    if (newStats.cash !== undefined) setCash(newStats.cash);
    if (newStats.gems !== undefined) setGems(newStats.gems);
    const targetId = userId || (userStats as any)?.$id || userStats?.userId;
    if (targetId) {
      databases.updateDocument("pumpforge", "users", targetId, {
        cash: newStats.cash,
        gems: newStats.gems,
        prestigeLevel: newStats.prestigeLevel,
      }).catch((e) => console.warn("Failed to persist stats update to Appwrite:", e));
    }
  };

  // Helper to persist coin updates to Appwrite
  const updateCoinInAppwrite = async (coinId: string, updates: Partial<MemeCoin>) => {
    try {
      const payload: any = {};
      if (updates.price !== undefined) payload.price = Number(updates.price);
      if (updates.history !== undefined) payload.history = updates.history;
      if (updates.change24h !== undefined) payload.change24h = Number(updates.change24h);
      if (updates.marketCap !== undefined) payload.marketCap = Math.floor(Number(updates.marketCap));
      if (updates.volume24h !== undefined) payload.volume24h = Number(updates.volume24h);
      if (updates.totalLiquidity !== undefined) {
        payload.totalLiquidity = Number(updates.totalLiquidity);
        payload.total_value = Number(updates.totalLiquidity);
      }

      try {
        await databases.updateDocument("pumpforge", "coins", coinId, payload);
        return;
      } catch (err1) {
        const res = await databases.listDocuments("pumpforge", "coins", [Query.equal("coinId", coinId)]);
        if (res.documents.length > 0) {
          await databases.updateDocument("pumpforge", "coins", res.documents[0].$id, payload);
        }
      }
    } catch (e) {
      console.warn("Appwrite coin update sync notice:", e);
    }
  };

  // ==========================================
  // --- MARKET MANIPULATION CONTROLLERS ---
  // ==========================================

  // Global +50% Pump
  const handleForceGlobalPump = async () => {
    if (coins.length === 0) {
      toast.error("No active coins available to pump.");
      return;
    }
    toast.loading("Rallying global market by +50% across all tokens...", { id: "global-pump" });
    
    const updatedCoins = coins.map((coin) => {
      const newPrice = Math.max(0.0001, Number(coin.price || 1) * 1.5);
      const newHistory = [...(coin.history || [coin.price]), newPrice].slice(-24);
      const newChange = Number(coin.change24h || 0) + 50;
      const newCap = Math.floor(newPrice * (Number(coin.supply) || 1000000));
      return {
        ...coin,
        price: newPrice,
        history: newHistory,
        change24h: newChange,
        marketCap: newCap,
      };
    });

    setCoins(updatedCoins);

    // Sync all to Appwrite in parallel
    await Promise.allSettled(
      updatedCoins.map((c) =>
        updateCoinInAppwrite(c.id, {
          price: c.price,
          history: c.history,
          change24h: c.change24h,
          marketCap: c.marketCap,
        })
      )
    );

    toast.success("Global +50% Market Overdrive successfully executed!", { id: "global-pump" });
    onAddNotification(
      "📈 Global Market Overdrive",
      "System administrators triggered a global +50% price rally across all active tokens!",
      "trade",
    );
  };

  // Global -50% Dump
  const handleForceGlobalDump = async () => {
    if (coins.length === 0) {
      toast.error("No active coins to crash.");
      return;
    }
    toast.loading("Triggering global -50% market liquidation...", { id: "global-dump" });
    
    const updatedCoins = coins.map((coin) => {
      const newPrice = Math.max(0.00001, Number(coin.price || 1) * 0.5);
      const newHistory = [...(coin.history || [coin.price]), newPrice].slice(-24);
      const newChange = Number(coin.change24h || 0) - 50;
      const newCap = Math.floor(newPrice * (Number(coin.supply) || 1000000));
      return {
        ...coin,
        price: newPrice,
        history: newHistory,
        change24h: newChange,
        marketCap: newCap,
      };
    });

    setCoins(updatedCoins);

    await Promise.allSettled(
      updatedCoins.map((c) =>
        updateCoinInAppwrite(c.id, {
          price: c.price,
          history: c.history,
          change24h: c.change24h,
          marketCap: c.marketCap,
        })
      )
    );

    toast.success("Global -50% Market Flash Crash completed!", { id: "global-dump" });
    onAddNotification(
      "📉 Market Flash Crash",
      "ALERT: System administrators forced a global -50% flash crash across all tokens!",
      "crash",
    );
  };

  // Global Black Swan Crash
  const handleTriggerGlobalBlackSwan = async () => {
    if (coins.length === 0) return;
    toast.loading("Executing Catastrophic Black Swan Event across all tokens...", { id: "black-swan" });
    
    const updatedCoins = coins.map((c) => {
      const dropMultiplier = 0.2; // 80% drop
      const newPrice = Math.max(0.00001, Number(c.price || 1) * dropMultiplier);
      const newHistory = [...(c.history || [c.price]), newPrice].slice(-24);
      return {
        ...c,
        price: newPrice,
        history: newHistory,
        change24h: -80,
        marketCap: Math.floor(newPrice * (Number(c.supply) || 1000000)),
      };
    });

    setCoins(updatedCoins);

    await Promise.allSettled(
      updatedCoins.map((c) =>
        updateCoinInAppwrite(c.id, {
          price: c.price,
          history: c.history,
          change24h: c.change24h,
          marketCap: c.marketCap,
        })
      )
    );

    // Auto dispatch black swan announcement
    try {
      await databases.createDocument(
        "pumpforge",
        "broadcasts",
        ID.unique(),
        {
          title: "🚨 BLACK SWAN DETECTED",
          message: "Catastrophic liquidity drainage detected across the decentralized market matrix!",
          type: "crash",
          timestamp: new Date().toISOString(),
        },
        [
          Permission.read(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ]
      );
      fetchActiveBroadcasts();
    } catch (e) {
      console.warn(e);
    }

    toast.success("Black Swan Liquidation Event completed!", { id: "black-swan" });
    onAddNotification(
      "🚨 BLACK SWAN COLLAPSE",
      "System liquidity crunch initiated: All circulating coin prices plunged by 80%!",
      "crash",
    );
  };

  // Algorithmic Bot Raid
  const handleExecuteBotRaid = async () => {
    if (!botRaidCoinId) {
      toast.error("Please select a target coin for the bot raid.");
      return;
    }
    const targetCoin = coins.find((c) => c.id === botRaidCoinId);
    if (!targetCoin) return;

    setBotRaidIsRunning(true);
    toast.loading(`Deploying 50 High-Frequency Bot swarm on *${targetCoin.symbol}...`, { id: "bot-raid" });

    try {
      const multiplier = botRaidDirection === "BUY" ? 4.8 : 0.08;
      const finalPrice = Math.max(0.00001, Number(targetCoin.price) * multiplier);
      const newHistory = [...(targetCoin.history || [targetCoin.price]), finalPrice].slice(-24);
      const changeDelta = botRaidDirection === "BUY" ? 380 : -92;
      const newChange = Number(targetCoin.change24h || 0) + changeDelta;
      const newCap = Math.floor(finalPrice * (Number(targetCoin.supply) || 1000000));

      setCoins((prev) =>
        prev.map((c) =>
          c.id === botRaidCoinId
            ? { ...c, price: finalPrice, history: newHistory, change24h: newChange, marketCap: newCap }
            : c
        )
      );

      await updateCoinInAppwrite(botRaidCoinId, {
        price: finalPrice,
        history: newHistory,
        change24h: newChange,
        marketCap: newCap,
      });

      toast.success(
        `Bot Raid Finished: *${targetCoin.symbol} shifted from $${targetCoin.price} to $${finalPrice.toFixed(4)} (${botRaidDirection === "BUY" ? "+380% PUMP" : "-92% DUMP"})!`,
        { id: "bot-raid" }
      );

      onAddNotification(
        `🤖 Bot Swarm ${botRaidDirection === "BUY" ? "Rally" : "Dump"}`,
        `50 automated Bot traders executed coordinated orders on *${targetCoin.symbol}, updating price to $${finalPrice.toFixed(4)}!`,
        botRaidDirection === "BUY" ? "trade" : "crash",
      );
    } catch (e: any) {
      console.error(e);
      toast.error("Bot Raid failed: " + e.message, { id: "bot-raid" });
    } finally {
      setBotRaidIsRunning(false);
    }
  };

  // ==========================================
  // --- COIN SPECIFIC ACTIONS ---
  // ==========================================

  const handleForcePumpSingle = async (coinId: string, multiplier = 2.0) => {
    const coin = coins.find((c) => c.id === coinId);
    if (!coin) return;

    toast.loading(`Pumping *${coin.symbol}...`, { id: "pump-" + coinId });
    const newPrice = Math.max(0.0001, Number(coin.price) * multiplier);
    const newHistory = [...(coin.history || [coin.price]), newPrice].slice(-24);
    const changeBoost = Math.round((multiplier - 1) * 100);
    const newChange = Number(coin.change24h || 0) + changeBoost;
    const newCap = Math.floor(newPrice * (Number(coin.supply) || 1000000));

    setCoins((prev) =>
      prev.map((c) =>
        c.id === coinId
          ? { ...c, price: newPrice, history: newHistory, change24h: newChange, marketCap: newCap }
          : c
      )
    );

    await updateCoinInAppwrite(coinId, {
      price: newPrice,
      history: newHistory,
      change24h: newChange,
      marketCap: newCap,
    });

    toast.success(`*${coin.symbol} pumped to $${newPrice.toFixed(4)} (+${changeBoost}%)!`, { id: "pump-" + coinId });
    onAddNotification(
      "🚀 Price Boost",
      `Admin forced price pump on *${coin.symbol}: Now $${newPrice.toFixed(4)}!`,
      "trade",
    );
  };

  const handleForceDumpSingle = async (coinId: string, dropRatio = 0.5) => {
    const coin = coins.find((c) => c.id === coinId);
    if (!coin) return;

    toast.loading(`Dumping *${coin.symbol}...`, { id: "dump-" + coinId });
    const newPrice = Math.max(0.00001, Number(coin.price) * dropRatio);
    const newHistory = [...(coin.history || [coin.price]), newPrice].slice(-24);
    const changeDrop = Math.round((1 - dropRatio) * 100);
    const newChange = Number(coin.change24h || 0) - changeDrop;
    const newCap = Math.floor(newPrice * (Number(coin.supply) || 1000000));

    setCoins((prev) =>
      prev.map((c) =>
        c.id === coinId
          ? { ...c, price: newPrice, history: newHistory, change24h: newChange, marketCap: newCap }
          : c
      )
    );

    await updateCoinInAppwrite(coinId, {
      price: newPrice,
      history: newHistory,
      change24h: newChange,
      marketCap: newCap,
    });

    toast.success(`*${coin.symbol} dumped to $${newPrice.toFixed(4)} (-${changeDrop}%)!`, { id: "dump-" + coinId });
    onAddNotification(
      "📉 Price Dump",
      `Admin forced price dump on *${coin.symbol}: Now $${newPrice.toFixed(4)}!`,
      "crash",
    );
  };

  const handleForcedelist = async (coinId: string) => {
    const coin = coins.find((c) => c.id === coinId);
    if (!coin) return;

    toast.loading(`Draining liquidity for *${coin.symbol}...`, { id: "drain-" + coinId });
    const newPrice = 0.000001;
    const newHistory = [...(coin.history || [coin.price]), newPrice].slice(-24);

    setCoins((prev) =>
      prev.map((c) =>
        c.id === coinId
          ? {
              ...c,
              price: newPrice,
              history: newHistory,
              change24h: -99.9,
              totalLiquidity: 0,
              marketCap: 0,
            }
          : c
      )
    );

    await updateCoinInAppwrite(coinId, {
      price: newPrice,
      history: newHistory,
      change24h: -99.9,
      totalLiquidity: 0,
      marketCap: 0,
    });

    toast.error(`💀 Liquidity drained on *${coin.symbol}!`, { id: "drain-" + coinId });
    onAddNotification(
      "💀 LIQUIDITY DRAINED",
      `Developer drained 100% of liquidity on *${coin.symbol}! Token price collapsed to $0.000001.`,
      "crash",
    );
  };

  const handleDeleteCoin = async (coinId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this coin from Appwrite?")) return;
    try {
      try {
        await databases.deleteDocument("pumpforge", "coins", coinId);
      } catch (err1) {
        const res = await databases.listDocuments("pumpforge", "coins", [Query.equal("coinId", coinId)]);
        if (res.documents.length > 0) {
          await databases.deleteDocument("pumpforge", "coins", res.documents[0].$id);
        }
      }
      setCoins((prev) => prev.filter((c) => c.id !== coinId));
      toast.success("Coin permanently deleted from database.");
      onAddNotification("🗑️ Coin Removed", "Coin permanently purged from database.", "trade");
    } catch (e: any) {
      console.error("Failed to delete coin:", e);
      toast.error("Failed to delete coin: " + e.message);
    }
  };

  const handleSetCustomCoinPrice = async (coinId: string) => {
    const rawVal = customCoinPrices[coinId];
    const val = Number(rawVal);
    if (!rawVal || isNaN(val) || val <= 0) {
      toast.error("Please enter a valid positive price.");
      return;
    }
    const coin = coins.find((c) => c.id === coinId);
    if (!coin) return;

    toast.loading(`Setting *${coin.symbol} to $${val}...`, { id: "custom-" + coinId });
    const newPrice = val;
    const newHistory = [...(coin.history || [coin.price]), newPrice].slice(-24);
    const oldPrice = Number(coin.price) || 1;
    const change = Math.round(((newPrice - oldPrice) / oldPrice) * 100);
    const newCap = Math.floor(newPrice * (Number(coin.supply) || 1000000));

    setCoins((prev) =>
      prev.map((c) =>
        c.id === coinId
          ? { ...c, price: newPrice, history: newHistory, change24h: change, marketCap: newCap }
          : c
      )
    );

    await updateCoinInAppwrite(coinId, {
      price: newPrice,
      history: newHistory,
      change24h: change,
      marketCap: newCap,
    });

    setCustomCoinPrices((prev) => ({ ...prev, [coinId]: "" }));
    toast.success(`*${coin.symbol} price set to $${newPrice}!`, { id: "custom-" + coinId });
  };

  // ==========================================
  // --- ANNOUNCEMENTS DISPATCHER ---
  // ==========================================

  const handleDispatchAnnouncement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!alertTitle.trim() || !alertMsg.trim()) {
      toast.error("Please provide both a title and a message.");
      return;
    }

    setIsPublishingBroadcast(true);
    toast.loading("Broadcasting system announcement to all users...", { id: "announcement" });

    const expiresAt =
      broadcastTimeLimit > 0
        ? new Date(Date.now() + broadcastTimeLimit * 60000).toISOString()
        : null;

    const payload = {
      title: alertTitle.trim(),
      message: alertMsg.trim(),
      type: alertType,
      timestamp: new Date().toISOString(),
      expiresAt: expiresAt,
    };

    try {
      await databases.createDocument(
        "pumpforge",
        "broadcasts",
        ID.unique(),
        payload,
        [
          Permission.read(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ]
      );

      toast.success("Broadcast dispatched globally!", { id: "announcement" });
      onAddNotification(
        "📢 Global Broadcast Live",
        `Dispatched bulletin: "${alertTitle.trim()}" to all users.`,
        "achievement"
      );
      setAlertTitle("");
      setAlertMsg("");
      fetchActiveBroadcasts();
    } catch (err: any) {
      console.error("Error dispatching broadcast:", err);
      toast.error(`Broadcast failed: ${err.message}`, { id: "announcement" });
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (broadcastId: string) => {
    try {
      await databases.deleteDocument("pumpforge", "broadcasts", broadcastId);
      toast.success("Broadcast banner removed.");
      fetchActiveBroadcasts();
    } catch (e: any) {
      toast.error("Failed to delete broadcast: " + e.message);
    }
  };

  // ==========================================
  // --- PROMO CODE PUBLISHER ---
  // ==========================================

  const handlePublishPromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoPubCode || !promoPubAmount) {
      toast.error("Please enter a promo code and reward amount.");
      return;
    }

    setPromoPubIsLoading(true);
    toast.loading("Publishing promo code...", { id: "promo-publish" });
    try {
      await databases.createDocument(
        "pumpforge",
        "promocodes",
        ID.unique(),
        {
          code: promoPubCode.trim().toUpperCase(),
          rewardType: promoPubType,
          rewardAmount: Number(promoPubAmount),
          isActive: true,
          claimedBy: [],
          expiresAt: promoPubExpiresAt ? new Date(promoPubExpiresAt).toISOString() : null,
        },
        [
          Permission.read(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ]
      );
      toast.success(`Promo code ${promoPubCode.toUpperCase()} published!`, { id: "promo-publish" });
      setPromoPubCode("");
      setPromoPubAmount("");
      setPromoPubExpiresAt("");
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to publish: ${e.message}`, { id: "promo-publish" });
    } finally {
      setPromoPubIsLoading(false);
    }
  };

  // ==========================================
  // --- ARCADE MECHANICS RIGGING ---
  // ==========================================

  const handleSetArcadeRigMode = async (mode: "lose" | "fair" | "win") => {
    setAdminSettings((prev) => ({
      ...prev,
      arcadeRigMode: mode,
      isCasinoRigged: mode === "win",
    }));

    try {
      localStorage.setItem("pf_arcade_rig_mode", mode);
      await databases.updateDocument("pumpforge", "admin_settings", "global", {
        arcadeRigMode: mode,
        isCasinoRigged: mode === "win",
      });
    } catch (e) {
      console.warn("Failed to persist arcade rig mode remotely:", e);
    }

    const title =
      mode === "win"
        ? "🎰 100% ALL WIN RIGGED"
        : mode === "lose"
          ? "💀 100% ALL LOSE RIGGED"
          : "⚖️ NORMAL FAIR RNG ACTIVATED";
    toast.success(title);
    onAddNotification(
      "🎰 Arcade Mechanics Override",
      `Operator modified arcade mechanics to: ${
        mode === "win" ? "100% ALL WIN" : mode === "lose" ? "100% ALL LOSE" : "NORMAL FAIR RNG"
      }! Coinflip, Slots, Mines, Dice, Tower conform.`,
      mode === "win" ? "achievement" : mode === "lose" ? "crash" : "info",
    );
  };

  // ==========================================
  // --- MINT RESOURCES FOR OWNER ---
  // ==========================================

  const handleMintCash = async () => {
    try {
      const currentUserReg = registeredUsers.find(
        (u) =>
          u.handle &&
          userStats?.handle &&
          u.handle.toLowerCase() === userStats.handle.toLowerCase(),
      );
      const uid = currentUserReg?.uid || userId || (userStats as any)?.$id || userStats?.userId;
      const amountToAdd = Number(customCash) || 0;
      const targetCash = (Number(userStats?.cash) || 0) + amountToAdd;

      if (uid) {
        await databases.updateDocument("pumpforge", "users", uid, { cash: targetCash });
        queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
      }

      onUpdateStats((stats) => {
        stats.cash = (Number(stats.cash) || 0) + amountToAdd;
      });
      toast.success(`Minted $${amountToAdd.toLocaleString()} cash!`);
      onAddNotification(
        "💸 Central Reserve Mint",
        `Minted $${amountToAdd.toLocaleString()} cash from central reserve.`,
        "achievement",
      );
    } catch (e: any) {
      console.error("Failed to mint cash:", e);
      toast.error("Failed to sync cash mint with Appwrite.");
    }
  };

  const handleMintGems = async () => {
    try {
      const currentUserReg = registeredUsers.find(
        (u) =>
          u.handle &&
          userStats?.handle &&
          u.handle.toLowerCase() === userStats.handle.toLowerCase(),
      );
      const uid = currentUserReg?.uid || userId || (userStats as any)?.$id || userStats?.userId;
      const amountToAdd = Number(customGems) || 0;
      const targetGems = (Number(userStats?.gems) || 0) + amountToAdd;

      if (uid) {
        await databases.updateDocument("pumpforge", "users", uid, { gems: targetGems });
        queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
      }

      onUpdateStats((stats) => {
        stats.gems = (Number(stats.gems) || 0) + amountToAdd;
      });
      toast.success(`Minted ${amountToAdd.toLocaleString()} gems!`);
      onAddNotification(
        "💎 Central Gem Mint",
        `Minted ${amountToAdd.toLocaleString()} gems directly to your profile.`,
        "achievement",
      );
    } catch (e: any) {
      console.error("Failed to mint gems:", e);
      toast.error("Failed to sync gems mint with Appwrite.");
    }
  };

  // Reset simulated players database
  const handleResetSimulatedDatabase = () => {
    if (setSimulatedPlayers) {
      setSimulatedPlayers([
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
          ],
        },
      ]);
      toast.success("Leaderboard database restored to factory defaults.");
    }
  };

  // ==========================================
  // --- USER MANAGEMENT CONTROLLERS ---
  // ==========================================

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`Copied ${label} to clipboard!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.info(`Value: ${text}`);
    }
  };

  const handleUserCashOperation = async (
    playerHandle: string,
    isUser: boolean,
    mode: "add" | "deduct" | "set",
    amount: number,
    targetUid?: string,
  ) => {
    setIsMutatingUser(playerHandle);
    toast.loading(`Updating cash balance for ${playerHandle}...`, {
      id: "mutate-" + playerHandle,
    });

    if (isUser) {
      const currentCash = Number(userStats?.cash) || 0;
      let newCash = currentCash;
      if (mode === "add") newCash += amount;
      else if (mode === "deduct") newCash = Math.max(0, currentCash - amount);
      else if (mode === "set") newCash = Math.max(0, amount);

      try {
        const uid = targetUid || userId || (userStats as any)?.$id || userStats?.userId;
        if (uid) {
          await databases.updateDocument("pumpforge", "users", uid, { cash: newCash });
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        onUpdateStats((stats) => {
          stats.cash = newCash;
        });
        toast.success(
          mode === "set"
            ? `Cash balance set to $${newCash.toLocaleString()}`
            : `Successfully ${mode === "add" ? "credited" : "debited"} $${amount.toLocaleString()}`,
          { id: "mutate-" + playerHandle }
        );
        onAddNotification(
          "💵 Cash Balance Updated",
          `Central Treasury adjusted your cash balance: Now $${newCash.toLocaleString()}`,
          "achievement"
        );
      } catch (err: any) {
        console.error(err);
        toast.error("Cash update failed: " + err.message, { id: "mutate-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    } else {
      try {
        const uid = targetUid;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          const userDoc = await databases.getDocument("pumpforge", "users", uid);
          const currentBal = Number(userDoc?.cash) || 5000;
          let finalCash = currentBal;
          if (mode === "add") finalCash += amount;
          else if (mode === "deduct") finalCash = Math.max(0, currentBal - amount);
          else if (mode === "set") finalCash = Math.max(0, amount);

          await databases.updateDocument("pumpforge", "users", uid, { cash: finalCash });
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }

        if (setSimulatedPlayers) {
          setSimulatedPlayers((prev) =>
            prev.map((p) => {
              if (p.handle?.toLowerCase() === playerHandle.toLowerCase()) {
                const cur = Number(p.profit) || 0;
                const newProfit = mode === "add" ? cur + amount : mode === "deduct" ? cur - amount : amount;
                return { ...p, profit: newProfit };
              }
              return p;
            })
          );
        }

        toast.success(
          mode === "set"
            ? `Cash for ${playerHandle} set to $${amount.toLocaleString()}`
            : `Successfully ${mode === "add" ? "credited" : "debited"} $${amount.toLocaleString()} for ${playerHandle}`,
          { id: "mutate-" + playerHandle }
        );
      } catch (e: any) {
        toast.error(`Update failed: ${e.message}`, { id: "mutate-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    }
  };

  const handleUserGemsOperation = async (
    playerHandle: string,
    isUser: boolean,
    mode: "add" | "deduct" | "set",
    amount: number,
    targetUid?: string,
  ) => {
    setIsMutatingUser(playerHandle);
    toast.loading(`Updating gems reserve for ${playerHandle}...`, {
      id: "mutate-gems-" + playerHandle,
    });

    if (isUser) {
      const currentGems = Number(userStats?.gems) || 0;
      let newGems = currentGems;
      if (mode === "add") newGems += amount;
      else if (mode === "deduct") newGems = Math.max(0, currentGems - amount);
      else if (mode === "set") newGems = Math.max(0, amount);

      try {
        const uid = targetUid || userId || (userStats as any)?.$id || userStats?.userId;
        if (uid) {
          await databases.updateDocument("pumpforge", "users", uid, { gems: newGems });
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        onUpdateStats((stats) => {
          stats.gems = newGems;
        });
        toast.success(
          mode === "set"
            ? `Gems reserve set to 💎 ${newGems.toLocaleString()}`
            : `Successfully ${mode === "add" ? "added" : "deducted"} 💎 ${amount.toLocaleString()} gems`,
          { id: "mutate-gems-" + playerHandle }
        );
      } catch (err: any) {
        console.error(err);
        toast.error("Gems update failed: " + err.message, { id: "mutate-gems-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    } else {
      try {
        const uid = targetUid;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          const userDoc = await databases.getDocument("pumpforge", "users", uid);
          const currentGems = Number(userDoc?.gems) || 100;
          let finalGems = currentGems;
          if (mode === "add") finalGems += amount;
          else if (mode === "deduct") finalGems = Math.max(0, currentGems - amount);
          else if (mode === "set") finalGems = Math.max(0, amount);

          await databases.updateDocument("pumpforge", "users", uid, { gems: finalGems });
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }

        if (setSimulatedPlayers) {
          setSimulatedPlayers((prev) =>
            prev.map((p) => {
              if (p.handle?.toLowerCase() === playerHandle.toLowerCase()) {
                const cur = Number((p as any).gems) || 350;
                const newGems = mode === "add" ? cur + amount : mode === "deduct" ? Math.max(0, cur - amount) : amount;
                return { ...p, gems: newGems };
              }
              return p;
            })
          );
        }

        toast.success(
          mode === "set"
            ? `Gems for ${playerHandle} set to 💎 ${amount.toLocaleString()}`
            : `Successfully ${mode === "add" ? "credited" : "debited"} 💎 ${amount.toLocaleString()} gems for ${playerHandle}`,
          { id: "mutate-gems-" + playerHandle }
        );
      } catch (e: any) {
        toast.error(`Update failed: ${e.message}`, { id: "mutate-gems-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    }
  };

  const [metaUpdateTick, setMetaUpdateTick] = useState(0);

  useEffect(() => {
    const handleMetaUpdate = () => setMetaUpdateTick((t) => t + 1);
    window.addEventListener("pf_user_meta_updated", handleMetaUpdate);
    return () => window.removeEventListener("pf_user_meta_updated", handleMetaUpdate);
  }, []);

  const handleUserPrestigeUpdate = async (
    playerHandle: string,
    isUser: boolean,
    targetLevel: number,
    targetUid?: string,
  ) => {
    const level = Math.max(0, Math.min(10, targetLevel));
    setIsMutatingUser(playerHandle);
    toast.loading(`Setting prestige level ${level} for ${playerHandle}...`, { id: "prestige-" + playerHandle });

    if (isUser) {
      try {
        const uid = targetUid || userId || (userStats as any)?.$id || userStats?.userId;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          try {
            await databases.updateDocument("pumpforge", "users", uid, { prestigeLevel: level });
          } catch (appwriteErr) {
            console.warn("Appwrite doc update for prestigeLevel:", appwriteErr);
          }
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        onUpdateStats((stats) => {
          stats.prestigeLevel = level;
        });
        toast.success(`Prestige tier updated to Level ${level}!`, { id: "prestige-" + playerHandle });
      } catch (e: any) {
        toast.error("Failed to update prestige: " + e.message, { id: "prestige-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    } else {
      try {
        const uid = targetUid;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          try {
            await databases.updateDocument("pumpforge", "users", uid, { prestigeLevel: level });
          } catch (appwriteErr) {
            console.warn("Appwrite doc update for prestigeLevel:", appwriteErr);
          }
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        if (setSimulatedPlayers) {
          setSimulatedPlayers((prev) =>
            prev.map((p) => (p.handle?.toLowerCase() === playerHandle.toLowerCase() ? { ...p, prestige: level, prestigeLevel: level } : p))
          );
        }
        toast.success(`Prestige set to Level ${level} for ${playerHandle}`, { id: "prestige-" + playerHandle });
      } catch (e: any) {
        toast.error("Failed to set prestige: " + e.message, { id: "prestige-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    }
  };

  const handleUserTitleUpdate = async (
    playerHandle: string,
    isUser: boolean,
    newTitle: string,
    targetUid?: string,
  ) => {
    const title = newTitle.trim() || "Trader";
    setIsMutatingUser(playerHandle);
    toast.loading(`Updating title for ${playerHandle}...`, { id: "title-" + playerHandle });

    // Persist in custom user meta storage
    const primaryKey = targetUid || playerHandle;
    saveStoredTitle(primaryKey, title);
    saveStoredTitle(playerHandle, title);
    if (targetUid) saveStoredTitle(targetUid, title);

    if (isUser) {
      try {
        const uid = targetUid || userId || (userStats as any)?.$id || userStats?.userId;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          try {
            await databases.updateDocument("pumpforge", "users", uid, { title });
          } catch (appwriteErr) {
            // Appwrite users collection lacks 'title' attribute; gracefully handled by our storage layer
            console.warn("Appwrite title attribute not declared, using local store:", appwriteErr);
          }
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        onUpdateStats((stats) => {
          stats.title = title;
        });
        toast.success(`User title set to "${title}"!`, { id: "title-" + playerHandle });
      } catch (e: any) {
        toast.error("Failed to update title: " + e.message, { id: "title-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    } else {
      try {
        const uid = targetUid;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          try {
            await databases.updateDocument("pumpforge", "users", uid, { title });
          } catch (appwriteErr) {
            console.warn("Appwrite title attribute not declared, using local store:", appwriteErr);
          }
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        if (setSimulatedPlayers) {
          setSimulatedPlayers((prev) =>
            prev.map((p) => (p.handle?.toLowerCase() === playerHandle.toLowerCase() ? { ...p, title } : p))
          );
        }
        toast.success(`Title for ${playerHandle} updated to "${title}"`, { id: "title-" + playerHandle });
      } catch (e: any) {
        toast.error("Failed to set title: " + e.message, { id: "title-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    }
  };

  const handleUserRoleToggle = async (
    playerHandle: string,
    isUser: boolean,
    makeAdmin: boolean,
    targetUid?: string,
  ) => {
    setIsMutatingUser(playerHandle);
    toast.loading(`Updating permissions for ${playerHandle}...`, { id: "role-" + playerHandle });

    const primaryKey = targetUid || playerHandle;
    saveStoredRole(primaryKey, makeAdmin);
    saveStoredRole(playerHandle, makeAdmin);
    if (targetUid) saveStoredRole(targetUid, makeAdmin);
    const assignedTitle = makeAdmin ? "Admin" : "Member";
    saveStoredTitle(primaryKey, assignedTitle);
    saveStoredTitle(playerHandle, assignedTitle);

    if (isUser) {
      try {
        const uid = targetUid || userId || (userStats as any)?.$id || userStats?.userId;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          try {
            await databases.updateDocument("pumpforge", "users", uid, {
              isAdmin: makeAdmin,
              title: assignedTitle,
            });
          } catch (appwriteErr) {
            console.warn("Appwrite role attribute not declared, using local store:", appwriteErr);
          }
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        onUpdateStats((stats) => {
          stats.isAdmin = makeAdmin;
          stats.title = assignedTitle;
        });
        toast.success(`Admin permissions ${makeAdmin ? "granted" : "revoked"}!`, { id: "role-" + playerHandle });
      } catch (e: any) {
        toast.error("Role update failed: " + e.message, { id: "role-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    } else {
      try {
        const uid = targetUid;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          try {
            await databases.updateDocument("pumpforge", "users", uid, {
              isAdmin: makeAdmin,
              title: assignedTitle,
            });
          } catch (appwriteErr) {
            console.warn("Appwrite role attribute not declared, using local store:", appwriteErr);
          }
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        if (setSimulatedPlayers) {
          setSimulatedPlayers((prev) =>
            prev.map((p) =>
              p.handle?.toLowerCase() === playerHandle.toLowerCase()
                ? { ...p, isAdmin: makeAdmin, title: assignedTitle }
                : p
            )
          );
        }
        toast.success(`${playerHandle} is ${makeAdmin ? "now an Admin" : "now a standard Trader"}`, {
          id: "role-" + playerHandle,
        });
      } catch (e: any) {
        toast.error("Role update failed: " + e.message, { id: "role-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    }
  };

  const handleResetUserAccount = async (
    playerHandle: string,
    isUser: boolean,
    targetUid?: string,
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to reset all profile data for ${playerHandle} back to initial defaults ($5,000 cash, 100 gems, prestige 0, and clear all penalties)?`
      )
    ) {
      return;
    }

    setIsMutatingUser(playerHandle);
    toast.loading(`Resetting data for ${playerHandle}...`, { id: "reset-" + playerHandle });

    // Clear stored penalties and custom overrides
    const primaryKey = targetUid || playerHandle;
    clearStoredUserMeta(primaryKey);
    clearStoredUserMeta(playerHandle);
    if (targetUid) clearStoredUserMeta(targetUid);

    if (isUser) {
      try {
        const uid = targetUid || userId || (userStats as any)?.$id || userStats?.userId;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          // Strictly send valid Appwrite schema attributes
          await databases.updateDocument("pumpforge", "users", uid, {
            cash: 5000,
            gems: 100,
            prestigeLevel: 0,
          });
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        onUpdateStats((stats) => {
          stats.cash = 5000;
          stats.gems = 100;
          stats.prestigeLevel = 0;
          stats.totalProfit = 0;
          stats.isSuspended = false;
          stats.isBanned = false;
          stats.suspendedUntil = null;
        });
        toast.success("Profile restored to starting defaults.", { id: "reset-" + playerHandle });
      } catch (e: any) {
        toast.error("Reset failed: " + e.message, { id: "reset-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    } else {
      try {
        const uid = targetUid;
        if (uid && !uid.startsWith("sim_") && !uid.startsWith("usr_")) {
          await databases.updateDocument("pumpforge", "users", uid, {
            cash: 5000,
            gems: 100,
            prestigeLevel: 0,
          });
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        if (setSimulatedPlayers) {
          setSimulatedPlayers((prev) =>
            prev.map((p) => {
              if (p.handle?.toLowerCase() === playerHandle.toLowerCase()) {
                return {
                  ...p,
                  profit: 0,
                  cash: 5000,
                  gems: 100,
                  prestige: 0,
                  prestigeLevel: 0,
                  isSuspended: false,
                  isBanned: false,
                };
              }
              return p;
            })
          );
        }
        toast.success(`Account data for ${playerHandle} restored to defaults.`, { id: "reset-" + playerHandle });
      } catch (e: any) {
        toast.error("Reset failed: " + e.message, { id: "reset-" + playerHandle });
      } finally {
        setIsMutatingUser(null);
      }
    }
  };

  const handleToggleSanction = async (
    playerHandle: string,
    isUser: boolean,
    action: "suspend" | "ban" | "lift",
    targetUid?: string,
    customDays?: number,
  ) => {
    const isNowSuspended = action === "suspend";
    const isNowBanned = action === "ban";
    const days = customDays !== undefined ? customDays : suspendDurationDays || 1;
    const suspendMs = Date.now() + days * 86400000;

    const sanctionPayload = {
      isSuspended: isNowSuspended,
      isBanned: isNowBanned,
      suspendedUntil: isNowSuspended ? suspendMs : null,
    };

    const primaryKey = targetUid || playerHandle;
    saveStoredSanction(primaryKey, sanctionPayload);
    saveStoredSanction(playerHandle, sanctionPayload);
    if (targetUid) saveStoredSanction(targetUid, sanctionPayload);

    if (isUser) {
      onUpdateStats((stats) => {
        stats.isSuspended = isNowSuspended;
        stats.isBanned = isNowBanned;
        stats.suspendedUntil = isNowSuspended ? suspendMs : null;
      });
      toast.success(action === "lift" ? "Sanctions lifted on your account" : `Account ${action} applied.`);
    } else {
      try {
        if (targetUid && !targetUid.startsWith("sim_") && !targetUid.startsWith("usr_")) {
          try {
            await databases.updateDocument("pumpforge", "users", targetUid, {
              isSuspended: isNowSuspended,
              isBanned: isNowBanned,
              suspendedUntil: isNowSuspended ? suspendMs : null,
            });
          } catch (appwriteErr) {
            console.warn("Appwrite sanction attributes not declared, using local store:", appwriteErr);
          }
          queryClient.invalidateQueries({ queryKey: ["registeredUsers"] });
        }
        if (setSimulatedPlayers) {
          setSimulatedPlayers((prev) =>
            prev.map((p) => {
              if (p.handle?.toLowerCase() === playerHandle.toLowerCase()) {
                return { ...p, isSuspended: isNowSuspended, isBanned: isNowBanned };
              }
              return p;
            })
          );
        }
        toast.success(`Sanction update applied to ${playerHandle}`);
      } catch (e: any) {
        toast.error("Failed to apply sanction: " + e.message);
      }
    }
  };

  // Bug report actions
  const handleToggleBugStatus = async (bugId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === "open" ? "resolved" : "open";
      await databases.updateDocument("pumpforge", "bugs", bugId, { status: nextStatus });
      setBugReports((prev) => prev.map((b) => (b.id === bugId ? { ...b, status: nextStatus } : b)));
      toast.success(`Bug marked as ${nextStatus}!`);
    } catch (e: any) {
      toast.error("Failed to update status: " + e.message);
    }
  };

  const handleDeleteBugReport = async (bugId: string) => {
    try {
      await databases.deleteDocument("pumpforge", "bugs", bugId);
      setBugReports((prev) => prev.filter((b) => b.id !== bugId));
      toast.success("Bug report deleted.");
    } catch (e: any) {
      toast.error("Failed to delete bug report: " + e.message);
    }
  };

  const handlePruneResolvedBugs = async () => {
    setIsPruningBugs(true);
    try {
      const resolvedList = bugReports.filter((b) => b.status === "resolved");
      if (resolvedList.length === 0) {
        toast.info("No resolved bugs to prune.");
        return;
      }
      for (const bug of resolvedList) {
        await databases.deleteDocument("pumpforge", "bugs", bug.id);
      }
      setBugReports((prev) => prev.filter((b) => b.status !== "resolved"));
      toast.success(`Pruned ${resolvedList.length} resolved bug reports.`);
    } catch (e: any) {
      toast.error("Failed to prune bugs: " + e.message);
    } finally {
      setIsPruningBugs(false);
    }
  };

  // ==========================================
  // --- PRESTIGE TIERS & TITLES ---
  // ==========================================

  const PRESTIGE_TIERS = [
    { level: 0, title: "Novice Trader", color: "text-zinc-400", badge: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30" },
    { level: 1, title: "Apprentice Speculator", color: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
    { level: 2, title: "Verified Scalper", color: "text-cyan-400", badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30" },
    { level: 3, title: "Pro Swing Trader", color: "text-blue-400", badge: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
    { level: 4, title: "High Roller VIP", color: "text-indigo-400", badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30" },
    { level: 5, title: "Whale Dev", color: "text-purple-400", badge: "bg-purple-500/10 text-purple-300 border-purple-500/30" },
    { level: 6, title: "Market Maker", color: "text-amber-400", badge: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
    { level: 7, title: "Liquidity Monarch", color: "text-orange-400", badge: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
    { level: 8, title: "Central Titan", color: "text-rose-400", badge: "bg-rose-500/10 text-rose-300 border-rose-500/30" },
    { level: 9, title: "Sovereign Apex", color: "text-fuchsia-400", badge: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30" },
    { level: 10, title: "Grandmaster Overlord", color: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-400/50" },
  ];

  // ==========================================
  // --- USERS LIST AGGREGATOR ---
  // ==========================================

  const storedSanctions = getStoredSanctions();
  const storedTitles = getStoredTitles();
  const storedRoles = getStoredRoles();

  const rawSystemUsersList = [
    (() => {
      const uId = userId || (userStats as any)?.userId || (userStats as any)?.$id || "user_operator";
      const uHandle = userStats?.handle || "@operator";
      const cleanH = uHandle.toLowerCase().trim();
      const cleanUid = String(uId).toLowerCase().trim();
      const sanction = storedSanctions[cleanUid] || storedSanctions[cleanH];
      const customTitle = storedTitles[cleanUid] || storedTitles[cleanH] || userStats?.title || "Owner";
      const customAdmin = storedRoles[cleanUid] ?? storedRoles[cleanH] ?? true;

      return {
        uid: uId,
        name: `${userStats?.username || "Operator"} (You)`,
        handle: uHandle,
        email: currentUserEmail || (userStats as any)?.email || "operator@pumpforge.io",
        profit: (userStats?.totalProfit ?? 0) + (((userStats?.cash ?? 5000)) - 5000),
        cash: userStats?.cash ?? 5000,
        gems: userStats?.gems ?? 90,
        prestige: userStats?.prestigeLevel ?? 0,
        title: customTitle,
        isUser: true,
        isSuspended: sanction ? sanction.isSuspended : !!userStats?.isSuspended,
        isBanned: sanction ? sanction.isBanned : !!userStats?.isBanned,
        suspendedUntil: sanction ? sanction.suspendedUntil : userStats?.suspendedUntil || null,
        isAdmin: customAdmin,
        createdAt: (userStats as any)?.createdAt || (userStats as any)?.$createdAt || "2026-05-24T06:40:00Z",
        coinsCreatedCount: coins.filter(
          (c) =>
            (c.creator?.toLowerCase() === (userStats?.handle || "").toLowerCase()) ||
            (c.creator?.toLowerCase() === (userStats?.username || "").toLowerCase()) ||
            (c.creatorName?.toLowerCase() === (userStats?.username || "").toLowerCase())
        ).length,
        tradesCount: liveTrades.filter(
          (t) =>
            t.userHandle?.toLowerCase() === (userStats?.handle || "").toLowerCase() ||
            t.userName?.toLowerCase() === (userStats?.username || "").toLowerCase()
        ).length,
        activityLog: localUserLogs,
      };
    })(),
    ...appwriteUsers
      .filter((r) => {
        const rId = r.$id || r.userId;
        const curId = userId || (userStats as any)?.userId || (userStats as any)?.$id;
        return rId && rId !== curId;
      })
      .map((r) => {
        const uId = r.$id || r.userId;
        const handle = r.handle || `@trader_${(r.$id || "").slice(0, 5)}`;
        const name = r.username || r.name || "Appwrite Trader";
        const cleanH = handle.toLowerCase().trim();
        const cleanUid = String(uId).toLowerCase().trim();
        const sanction = storedSanctions[cleanUid] || storedSanctions[cleanH];
        const customTitle = storedTitles[cleanUid] || storedTitles[cleanH] || r.title || (r.isAdmin ? "Admin" : "Member");
        const customAdmin = storedRoles[cleanUid] ?? storedRoles[cleanH] ?? (!!r.isAdmin || r.title?.toLowerCase() === "owner" || r.title?.toLowerCase() === "admin");

        return {
          uid: uId,
          name,
          handle,
          email: r.email || `${(r.username || "user").toLowerCase().replace(/[^a-z0-9]/g, "")}@pumpforge.io`,
          profit: (r.totalProfit ?? 0) + ((r.cash ?? 5000) - 5000),
          cash: r.cash ?? 5000,
          gems: r.gems ?? 100,
          prestige: r.prestigeLevel || 0,
          title: customTitle,
          isUser: false,
          isSuspended: sanction ? sanction.isSuspended : !!r.isSuspended,
          isBanned: sanction ? sanction.isBanned : !!r.isBanned,
          suspendedUntil: sanction ? sanction.suspendedUntil : r.suspendedUntil || null,
          isAdmin: customAdmin,
          createdAt: r.$createdAt || r.createdAt || "2026-05-24T06:40:00Z",
          coinsCreatedCount: coins.filter(
            (c) =>
              c.creator?.toLowerCase() === handle.toLowerCase() ||
              c.creator?.toLowerCase() === name.toLowerCase() ||
              c.creatorName?.toLowerCase() === name.toLowerCase()
          ).length,
          tradesCount: liveTrades.filter(
            (t) =>
              t.userHandle?.toLowerCase() === handle.toLowerCase() ||
              t.userName?.toLowerCase() === name.toLowerCase()
          ).length,
          activityLog: [],
        };
      }),
    ...(simulatedPlayers || []).map((p) => {
      const uId = p.id || `sim_${p.handle.replace("@", "")}`;
      const cleanH = p.handle.toLowerCase().trim();
      const cleanUid = String(uId).toLowerCase().trim();
      const sanction = storedSanctions[cleanUid] || storedSanctions[cleanH];
      const customTitle = storedTitles[cleanUid] || storedTitles[cleanH] || p.title || "Network Trader";
      const customAdmin = storedRoles[cleanUid] ?? storedRoles[cleanH] ?? !!p.isAdmin;

      return {
        uid: uId,
        name: p.name || p.handle,
        handle: p.handle,
        email: `${p.handle.replace("@", "").toLowerCase()}@pumpforge.io`,
        profit: (p as any).totalProfit ?? p.profit ?? 0,
        cash: (p as any).cash ?? 12500,
        gems: (p as any).gems ?? 350,
        prestige: (p as any).prestigeLevel ?? p.prestige ?? 0,
        title: customTitle,
        isUser: false,
        isSuspended: sanction ? sanction.isSuspended : !!p.isSuspended,
        isBanned: sanction ? sanction.isBanned : !!p.isBanned,
        suspendedUntil: sanction ? sanction.suspendedUntil : null,
        isAdmin: customAdmin,
        createdAt: p.createdAt || "2026-05-01T12:00:00Z",
        coinsCreatedCount: coins.filter(
          (c) =>
            c.creator?.toLowerCase() === p.handle.toLowerCase() ||
            c.creator?.toLowerCase() === (p.name || "").toLowerCase()
        ).length,
        tradesCount: liveTrades.filter(
          (t) =>
            t.userHandle?.toLowerCase() === p.handle.toLowerCase() ||
            t.userName?.toLowerCase() === (p.name || "").toLowerCase()
        ).length,
        activityLog: p.activityLog || [],
      };
    }),
  ];

  // Deduplicate users by handle
  const seenHandles = new Set<string>();
  const systemUsersList = rawSystemUsersList.filter((u) => {
    const h = (u.handle || "").toLowerCase();
    if (seenHandles.has(h)) return false;
    seenHandles.add(h);
    return true;
  });

  const selectedUser =
    systemUsersList.find((u) => u.uid === selectedUserId || u.handle === selectedUserId) ||
    systemUsersList[0];

  const filteredDropdownUsers = systemUsersList.filter((u) => {
    const q = dropdownSearch.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.handle || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.title || "").toLowerCase().includes(q)
    );
  });

  if (!userStats || Object.keys(userStats).length === 0) {
    return <SkeletonLoader type="dashboard" />;
  }

  return (
    <div className="flex-1 flex flex-col gap-6 animate-fade-in text-zinc-100 font-sans pb-16 max-w-7xl mx-auto w-full px-2 sm:px-4">
      {/* ==================================================== */}
      {/* --- COMMAND CENTER HEADER & STATS BAR --- */}
      {/* ==================================================== */}
      <div className="glass-panel border border-rose-500/20 bg-gradient-to-r from-zinc-950 via-rose-950/20 to-zinc-950 p-5 md:p-7 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600/30 to-amber-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/40 shrink-0">
              <ShieldAlert className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  System Command Center
                </h1>
                <span className="text-[10px] bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
                  ROOT ADMIN
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                Real-time market engine manipulation, token mechanics, account sanctions, and global announcements.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <button
              onClick={handleResetSimulatedDatabase}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Sandbox
            </button>
            <button
              onClick={() => navigate("/market")}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-600/80 hover:bg-rose-500 border border-rose-400/40 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-950/30 active:scale-95 cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5" />
              Live Market
            </button>
          </div>
        </div>

        {/* Quick telemetry pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-3">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Circulating Tokens</span>
            <div className="text-lg font-black text-emerald-400 mt-0.5">{coins.length} Coins</div>
          </div>
          <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-3">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Active Accounts</span>
            <div className="text-lg font-black text-indigo-400 mt-0.5">{systemUsersList.length} Registered</div>
          </div>
          <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-3">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Arcade Mechanics</span>
            <div className="text-lg font-black text-amber-400 mt-0.5 uppercase">
              {adminSettings?.arcadeRigMode || "FAIR RNG"}
            </div>
          </div>
          <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-3">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Open Bug Reports</span>
            <div className="text-lg font-black text-rose-400 mt-0.5">
              {bugReports.filter((b) => b.status !== "resolved").length} Open
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* --- RESPONSIVE NAVIGATION SUB-TABS --- */}
      {/* ==================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-white/10">
        {[
          { id: "overview" as const, label: "Overview & Mint", icon: Sliders },
          { id: "market" as const, label: "Market Overdrive", icon: TrendingUp, badge: "PUMP/DUMP" },
          { id: "coins" as const, label: "Coin Manager", icon: Coins, count: coins.length },
          { id: "users" as const, label: "User Terminal", icon: UserCheck, count: systemUsersList.length },
          { id: "announcements" as const, label: "Announcements", icon: BellRing, count: activeBroadcastsList.length },
          { id: "bugs" as const, label: "Bug Reports", icon: Bug, count: bugReports.filter((b) => b.status === "open").length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50 border border-rose-400/40"
                  : "bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-400 hover:text-white border border-white/5"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-zinc-400"}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-mono font-black">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-300"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================================================== */}
      {/* --- TAB 1: OVERVIEW & RESOURCE MINTING --- */}
      {/* ==================================================== */}
      {activeSubTab === "overview" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Minting & Balance Injections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash Mint Box */}
            <div className="glass-panel border border-emerald-500/20 bg-emerald-950/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Central Cash Reserve Mint</h3>
                    <p className="text-xs text-zinc-400">Credit operator account with fiat capital</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Cur: ${(Number(userStats?.cash) || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span>
                  <input
                    type="number"
                    value={customCash}
                    onChange={(e) => setCustomCash(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-zinc-950/80 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                    placeholder="50000"
                  />
                </div>
                <button
                  onClick={handleMintCash}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Mint Cash
                </button>
              </div>

              {/* Preset quick buttons */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
                {[10000, 50000, 250000, 1000000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCustomCash(amt)}
                    className="text-[10px] font-mono px-2 py-1 bg-white/5 hover:bg-white/10 text-emerald-400/80 hover:text-emerald-300 rounded-lg border border-white/5 transition"
                  >
                    +${(amt / 1000).toLocaleString()}k
                  </button>
                ))}
              </div>
            </div>

            {/* Gems Mint Box */}
            <div className="glass-panel border border-cyan-500/20 bg-cyan-950/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Central Gem Reserve Mint</h3>
                    <p className="text-xs text-zinc-400">Credit operator profile with arcade gems</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  Cur: 💎 {(Number(userStats?.gems) || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 font-bold">💎</span>
                  <input
                    type="number"
                    value={customGems}
                    onChange={(e) => setCustomGems(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-zinc-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-cyan-400 focus:outline-none focus:border-cyan-500/50"
                    placeholder="500"
                  />
                </div>
                <button
                  onClick={handleMintGems}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/40 border border-cyan-400/40 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Mint Gems
                </button>
              </div>

              {/* Preset quick buttons */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
                {[100, 500, 2500, 10000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCustomGems(amt)}
                    className="text-[10px] font-mono px-2 py-1 bg-white/5 hover:bg-white/10 text-cyan-400/80 hover:text-cyan-300 rounded-lg border border-white/5 transition"
                  >
                    💎 {amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Arcade Mechanics Rigging */}
          <div className="glass-panel border border-amber-500/20 bg-amber-950/5 rounded-3xl p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Casino & Arcade Probability Rigging</h3>
                  <p className="text-xs text-zinc-400">Force outcomes on Coinflip, Slots, Mines, Dice, Tower, and Crates</p>
                </div>
              </div>
              <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                MODE: {adminSettings?.arcadeRigMode?.toUpperCase() || "FAIR"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => handleSetArcadeRigMode("win")}
                className={`p-4 rounded-2xl border text-left transition flex flex-col gap-1.5 cursor-pointer ${
                  adminSettings?.arcadeRigMode === "win"
                    ? "bg-emerald-500/20 border-emerald-500/50 text-white shadow-lg shadow-emerald-950/40"
                    : "bg-zinc-900/60 hover:bg-zinc-800/80 border-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> 100% ALL WIN
                  </span>
                  {adminSettings?.arcadeRigMode === "win" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Every arcade wager guarantees instant Jackpot wins.
                </p>
              </button>

              <button
                onClick={() => handleSetArcadeRigMode("fair")}
                className={`p-4 rounded-2xl border text-left transition flex flex-col gap-1.5 cursor-pointer ${
                  !adminSettings?.arcadeRigMode || adminSettings?.arcadeRigMode === "fair"
                    ? "bg-indigo-500/20 border-indigo-500/50 text-white shadow-lg shadow-indigo-950/40"
                    : "bg-zinc-900/60 hover:bg-zinc-800/80 border-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-indigo-400 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" /> FAIR STANDARD RNG
                  </span>
                  {(!adminSettings?.arcadeRigMode || adminSettings?.arcadeRigMode === "fair") && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Default mathematical casino probability house edge.
                </p>
              </button>

              <button
                onClick={() => handleSetArcadeRigMode("lose")}
                className={`p-4 rounded-2xl border text-left transition flex flex-col gap-1.5 cursor-pointer ${
                  adminSettings?.arcadeRigMode === "lose"
                    ? "bg-rose-500/20 border-rose-500/50 text-white shadow-lg shadow-rose-950/40"
                    : "bg-zinc-900/60 hover:bg-zinc-800/80 border-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-rose-400 flex items-center gap-1.5">
                    <Skull className="w-4 h-4" /> 100% ALL LOSE
                  </span>
                  {adminSettings?.arcadeRigMode === "lose" && <CheckCircle2 className="w-4 h-4 text-rose-400" />}
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Every user game outcome guarantees a brutal bust.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* --- TAB 2: MARKET OVERDRIVE & MANIPULATION --- */}
      {/* ==================================================== */}
      {activeSubTab === "market" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Global Market Shockers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Global Pump */}
            <div className="glass-panel border border-emerald-500/30 bg-emerald-950/20 p-6 rounded-3xl flex flex-col justify-between gap-4 shadow-xl">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-white">Global +50% Market Pump</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Forces an immediate +50% price rally across all active tokens and writes permanently to Appwrite.
                </p>
              </div>
              <button
                onClick={handleForceGlobalPump}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <TrendingUp className="w-4 h-4" />
                Execute Global Pump
              </button>
            </div>

            {/* Global Dump */}
            <div className="glass-panel border border-rose-500/30 bg-rose-950/20 p-6 rounded-3xl flex flex-col justify-between gap-4 shadow-xl">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-lg">
                  <TrendingDown className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-white">Global -50% Flash Crash</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Triggers an instant -50% flash crash across every circulating token in the arena.
                </p>
              </div>
              <button
                onClick={handleForceGlobalDump}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-950/40 border border-rose-400/40 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <TrendingDown className="w-4 h-4" />
                Execute Flash Crash
              </button>
            </div>

            {/* Black Swan Event */}
            <div className="glass-panel border border-purple-500/30 bg-purple-950/20 p-6 rounded-3xl flex flex-col justify-between gap-4 shadow-xl">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 shadow-lg">
                  <Skull className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-base text-white">Catastrophic Black Swan</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Drains 80% of valuations across all tokens and dispatches a system-wide crash alert banner.
                </p>
              </div>
              <button
                onClick={handleTriggerGlobalBlackSwan}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-950/40 border border-purple-400/40 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Skull className="w-4 h-4" />
                Trigger Black Swan
              </button>
            </div>
          </div>

          {/* High Frequency Bot Swarm Engine */}
          <div className="glass-panel border border-indigo-500/30 bg-indigo-950/10 rounded-3xl p-6 flex flex-col gap-5 shadow-xl">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Algorithmic Bot Swarm Raid Engine</h3>
                <p className="text-xs text-zinc-400">Simulate 50 coordinated high-frequency algorithmic traders on a target coin</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 mb-1.5 block">Select Target Token:</label>
                <select
                  value={botRaidCoinId}
                  onChange={(e) => setBotRaidCoinId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Target Coin --</option>
                  {coins.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.avatarEmoji} {c.name} (*{c.symbol}) - ${Number(c.price).toFixed(4)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 mb-1.5 block">Swarm Direction:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBotRaidDirection("BUY")}
                    className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                      botRaidDirection === "BUY"
                        ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/40"
                        : "bg-zinc-950 text-zinc-400 border-white/10 hover:text-white"
                    }`}
                  >
                    🚀 PUMP (+380%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBotRaidDirection("SELL")}
                    className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                      botRaidDirection === "SELL"
                        ? "bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-950/40"
                        : "bg-zinc-950 text-zinc-400 border-white/10 hover:text-white"
                    }`}
                  >
                    💀 DUMP (-92%)
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={botRaidIsRunning || !botRaidCoinId}
                onClick={handleExecuteBotRaid}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-950/40 border border-indigo-400/40 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer h-[42px]"
              >
                <Zap className="w-4 h-4" />
                {botRaidIsRunning ? "Executing Swarm..." : "Launch Bot Raid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* --- TAB 3: COIN MANAGER & CONTROLS --- */}
      {/* ==================================================== */}
      {activeSubTab === "coins" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel border border-white/10 p-5 rounded-3xl">
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                Circulating Meme-Coins Management ({coins.length})
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Set exact custom prices, force instant multipliers, drain liquidity, or delete tokens.
              </p>
            </div>
            <button
              onClick={() => navigate("/create")}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-amber-950/30 flex items-center gap-2 transition active:scale-95 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Create New Coin
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coins.map((coin) => {
              const priceNum = Number(coin.price) || 0;
              const isRugged = priceNum <= 0.00001;
              return (
                <div
                  key={coin.id}
                  className={`glass-panel border rounded-3xl p-5 flex flex-col justify-between gap-4 transition shadow-xl relative overflow-hidden ${
                    isRugged
                      ? "border-rose-500/30 bg-rose-950/10"
                      : "border-white/10 bg-zinc-950/60 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-2xl shadow-inner shrink-0">
                        {coin.avatarEmoji || "🪙"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-black text-sm text-white truncate max-w-[130px]">{coin.name}</h4>
                          <span className="text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                            *{coin.symbol}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block truncate">
                          By {coin.creator || "@system"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-sm font-black font-mono ${isRugged ? "text-rose-500" : "text-emerald-400"}`}>
                        {isRugged ? "$0.0000" : `$${priceNum.toFixed(4)}`}
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${
                        (coin.change24h || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {(coin.change24h || 0) >= 0 ? "+" : ""}{coin.change24h || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Set custom exact price input */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="Set price..."
                        value={customCoinPrices[coin.id] || ""}
                        onChange={(e) => setCustomCoinPrices((prev) => ({ ...prev, [coin.id]: e.target.value }))}
                        className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-6 pr-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <button
                      onClick={() => handleSetCustomCoinPrice(coin.id)}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                    >
                      Set
                    </button>
                  </div>

                  {/* Coin Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleForcePumpSingle(coin.id, 2.0)}
                      className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5" /> 2x Pump
                    </button>
                    <button
                      onClick={() => handleForcePumpSingle(coin.id, 5.0)}
                      className="py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 5x Moon
                    </button>
                    <button
                      onClick={() => handleForceDumpSingle(coin.id, 0.5)}
                      className="py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <TrendingDown className="w-3.5 h-3.5" /> -50% Dump
                    </button>
                    <button
                      onClick={() => handleForcedelist(coin.id)}
                      className="py-2 bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Skull className="w-3.5 h-3.5" /> Drain Liquidity
                    </button>
                  </div>

                  {/* Delete coin permanent */}
                  <button
                    onClick={() => handleDeleteCoin((coin as any).$id || coin.id)}
                    className="w-full py-1.5 bg-red-950/20 hover:bg-red-950/60 border border-red-900/30 text-red-500 hover:text-red-400 rounded-xl text-[11px] font-mono font-bold uppercase transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete from Appwrite
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* --- TAB 4: USER TERMINAL & SANCTIONS --- */}
      {/* ==================================================== */}
      {activeSubTab === "users" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Top Control Bar with User Switcher and Sanction Length */}
          <div className="glass-panel border border-indigo-500/30 bg-indigo-950/10 rounded-3xl p-5 sm:p-6 flex flex-col gap-5 shadow-2xl relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2 flex-wrap">
                    User Management Terminal
                    <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                      {systemUsersList.length} Active Accounts
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <Database className="w-2.5 h-2.5" /> Appwrite Synced
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Command center for user balances, gems, custom titles, prestige ranks, permissions, and sanctions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto text-xs bg-zinc-950 border border-white/10 rounded-xl px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Sanction Preset:</span>
                <select
                  value={suspendDurationDays}
                  onChange={(e) => setSuspendDurationDays(Number(e.target.value))}
                  className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer text-xs"
                >
                  <option value={0.0416} className="bg-zinc-900 text-white">1 Hour</option>
                  <option value={0.5} className="bg-zinc-900 text-white">12 Hours</option>
                  <option value={1} className="bg-zinc-900 text-white">1 Day</option>
                  <option value={3} className="bg-zinc-900 text-white">3 Days</option>
                  <option value={7} className="bg-zinc-900 text-white">1 Week</option>
                  <option value={30} className="bg-zinc-900 text-white">1 Month</option>
                  <option value={3650} className="bg-zinc-900 text-white">Permanent</option>
                </select>
              </div>
            </div>

            {/* Selected User Hero Dossier */}
            <div className="relative">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 sm:p-5 bg-zinc-950/80 border border-indigo-500/30 rounded-2xl shadow-inner">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-zinc-900 border border-indigo-500/50 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg">
                      {selectedUser?.name ? selectedUser.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-zinc-950 flex items-center justify-center ${
                      selectedUser?.isBanned
                        ? "bg-rose-500"
                        : selectedUser?.isSuspended
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-white truncate">{selectedUser?.name}</span>
                      <span className="text-xs text-indigo-400 font-mono font-bold">{selectedUser?.handle}</span>
                      {selectedUser?.isUser && (
                        <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black px-2 py-0.5 rounded uppercase">
                          YOU (ADMIN)
                        </span>
                      )}
                      {selectedUser?.isAdmin && (
                        <span className="text-[9px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black px-2 py-0.5 rounded uppercase flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5" /> ADMIN ROLE
                        </span>
                      )}
                      {selectedUser?.isSuspended && (
                        <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black px-2 py-0.5 rounded uppercase flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> SUSPENDED
                        </span>
                      )}
                      {selectedUser?.isBanned && (
                        <span className="text-[9px] bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black px-2 py-0.5 rounded uppercase flex items-center gap-1">
                          <Skull className="w-2.5 h-2.5" /> BANNED
                        </span>
                      )}
                      {!selectedUser?.isSuspended && !selectedUser?.isBanned && (
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase">
                          ACTIVE / GOOD STANDING
                        </span>
                      )}
                    </div>

                    {/* Metadata Strip */}
                    <div className="flex items-center gap-2 sm:gap-4 text-[11px] text-zinc-400 font-mono mt-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-zinc-900/80 px-2 py-1 rounded-lg border border-white/5">
                        <Fingerprint className="w-3 h-3 text-indigo-400" />
                        <span className="truncate max-w-[130px] sm:max-w-[180px]">{selectedUser?.uid}</span>
                        <button
                          onClick={() => handleCopyText(selectedUser?.uid || "", "User ID")}
                          className="text-zinc-500 hover:text-white ml-1 p-0.5 transition cursor-pointer"
                          title="Copy User ID"
                        >
                          {copiedField === "User ID" ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1 bg-zinc-900/80 px-2 py-1 rounded-lg border border-white/5">
                        <Mail className="w-3 h-3 text-cyan-400" />
                        <span className="truncate max-w-[130px] sm:max-w-[200px]">{selectedUser?.email}</span>
                        <button
                          onClick={() => handleCopyText(selectedUser?.email || "", "Email")}
                          className="text-zinc-500 hover:text-white ml-1 p-0.5 transition cursor-pointer"
                          title="Copy Email"
                        >
                          {copiedField === "Email" ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span>Joined: {new Date(selectedUser?.createdAt || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Switch User CTA */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-black rounded-xl border border-indigo-400/40 shadow-lg flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{isUserDropdownOpen ? "Close Directory" : "Switch User"}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isUserDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Popover User Directory Dropdown */}
              {isUserDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-zinc-950/95 border border-indigo-500/40 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 max-h-[420px] animate-fade-in backdrop-blur-2xl">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={dropdownSearch}
                      onChange={(e) => setDropdownSearch(e.target.value)}
                      placeholder="Search accounts by username, @handle, role, or UID..."
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1 overflow-y-auto max-h-[300px] pr-1">
                    {filteredDropdownUsers.map((u) => {
                      const tier = PRESTIGE_TIERS[Math.min(u.prestige || 0, 10)] || PRESTIGE_TIERS[0];
                      return (
                        <button
                          key={u.uid}
                          onClick={() => {
                            setSelectedUserId(u.uid);
                            setIsUserDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                            selectedUser?.uid === u.uid
                              ? "bg-indigo-600/30 border border-indigo-500/50 text-white"
                              : "hover:bg-zinc-900 border border-transparent text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate text-white flex items-center gap-1.5">
                                {u.name}
                                {u.isAdmin && (
                                  <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-bold px-1 rounded">ADMIN</span>
                                )}
                                {u.isSuspended && (
                                  <span className="text-[8px] bg-amber-500/20 text-amber-300 font-bold px-1 rounded">SUSPENDED</span>
                                )}
                                {u.isBanned && (
                                  <span className="text-[8px] bg-rose-500/20 text-rose-300 font-bold px-1 rounded">BANNED</span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-2">
                                <span>{u.handle}</span>
                                <span>•</span>
                                <span className={tier.color}>Lvl {u.prestige || 0}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px] shrink-0">
                            <div className="text-emerald-400 font-bold">${(u.cash ?? 5000).toLocaleString()}</div>
                            <div className="text-cyan-400 text-[9px]">💎 {(u.gems ?? 100).toLocaleString()}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 6-Metric Visual Telemetry Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Liquid Cash */}
              <div className="p-3 bg-zinc-950/60 border border-emerald-500/20 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
                  <span>LIQUID CASH</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-1 truncate">
                  ${(selectedUser?.cash ?? 5000).toLocaleString()}
                </div>
                <div className="text-[9px] text-zinc-500 mt-1">Available for trades</div>
              </div>

              {/* Arcade Gems */}
              <div className="p-3 bg-zinc-950/60 border border-cyan-500/20 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
                  <span>ARCADE GEMS</span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-cyan-400 font-mono mt-1 truncate">
                  💎 {(selectedUser?.gems ?? 100).toLocaleString()}
                </div>
                <div className="text-[9px] text-zinc-500 mt-1">Boosters & minigames</div>
              </div>

              {/* Net PnL */}
              <div className="p-3 bg-zinc-950/60 border border-indigo-500/20 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
                  <span>TOTAL PNL</span>
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className={`text-base sm:text-lg font-black font-mono mt-1 truncate ${
                  (selectedUser?.profit ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {(selectedUser?.profit ?? 0) >= 0 ? "+" : ""}${(selectedUser?.profit ?? 0).toLocaleString()}
                </div>
                <div className="text-[9px] text-zinc-500 mt-1">Lifetime performance</div>
              </div>

              {/* Prestige Tier */}
              {(() => {
                const tier = PRESTIGE_TIERS[Math.min(selectedUser?.prestige || 0, 10)] || PRESTIGE_TIERS[0];
                return (
                  <div className="p-3 bg-zinc-950/60 border border-amber-500/20 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
                      <span>PRESTIGE</span>
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-base sm:text-lg font-black text-amber-400 font-mono mt-1 truncate">
                      Lvl {selectedUser?.prestige || 0}
                    </div>
                    <div className={`text-[9px] font-bold truncate ${tier.color}`}>
                      {tier.title}
                    </div>
                  </div>
                );
              })()}

              {/* Assigned Title */}
              <div className="p-3 bg-zinc-950/60 border border-purple-500/20 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
                  <span>CUSTOM TITLE</span>
                  <Tag className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xs sm:text-sm font-black text-purple-300 mt-1 truncate">
                  {selectedUser?.title || "Trader"}
                </div>
                <div className="text-[9px] text-zinc-500 mt-1">Public profile flair</div>
              </div>

              {/* Standing */}
              <div className="p-3 bg-zinc-950/60 border border-white/10 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
                  <span>ACCOUNT STATUS</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="text-xs sm:text-sm font-black mt-1 truncate flex items-center gap-1">
                  {selectedUser?.isBanned ? (
                    <span className="text-rose-400">Banned</span>
                  ) : selectedUser?.isSuspended ? (
                    <span className="text-amber-400">Suspended</span>
                  ) : (
                    <span className="text-emerald-400">Good Standing</span>
                  )}
                </div>
                <div className="text-[9px] text-zinc-500 mt-1">
                  {selectedUser?.isAdmin ? "Admin authority" : "Standard trader"}
                </div>
              </div>
            </div>

            {/* Comprehensive Operational Modules */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
              {/* Module 1: 💵 Cash Balance Management */}
              <div className="bg-zinc-950/70 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Cash Balance Management</h4>
                      <p className="text-[10px] text-zinc-400">Credit, debit, or set exact liquid cash balance</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    Current: ${(selectedUser?.cash ?? 5000).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">$</span>
                    <input
                      type="number"
                      placeholder="Enter amount..."
                      value={userExactCashInput[selectedUser?.handle] ?? userMoneyDelta[selectedUser?.handle] ?? 10000}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserExactCashInput((prev) => ({ ...prev, [selectedUser?.handle]: val }));
                        setUserMoneyDelta((prev) => ({ ...prev, [selectedUser?.handle]: Number(val) }));
                      }}
                      className="w-full bg-zinc-900 border border-emerald-500/30 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="grid grid-cols-3 sm:flex items-center gap-2">
                    <button
                      disabled={isMutatingUser === selectedUser?.handle}
                      onClick={() => {
                        const amt = Number(userExactCashInput[selectedUser?.handle] ?? userMoneyDelta[selectedUser?.handle] ?? 10000);
                        handleUserCashOperation(selectedUser?.handle, selectedUser?.isUser, "add", Math.max(0, amt), selectedUser?.uid);
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Credit
                    </button>
                    <button
                      disabled={isMutatingUser === selectedUser?.handle}
                      onClick={() => {
                        const amt = Number(userExactCashInput[selectedUser?.handle] ?? userMoneyDelta[selectedUser?.handle] ?? 10000);
                        handleUserCashOperation(selectedUser?.handle, selectedUser?.isUser, "deduct", Math.max(0, amt), selectedUser?.uid);
                      }}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Minus className="w-3.5 h-3.5" /> Debit
                    </button>
                    <button
                      disabled={isMutatingUser === selectedUser?.handle}
                      onClick={() => {
                        const amt = Number(userExactCashInput[selectedUser?.handle] ?? userMoneyDelta[selectedUser?.handle] ?? 10000);
                        handleUserCashOperation(selectedUser?.handle, selectedUser?.isUser, "set", Math.max(0, amt), selectedUser?.uid);
                      }}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      Set Exact
                    </button>
                  </div>
                </div>

                {/* Quick Presets for Cash */}
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 block mb-1.5 font-bold uppercase">Quick Dose Presets:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[1000, 10000, 50000, 250000, 1000000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => handleUserCashOperation(selectedUser?.handle, selectedUser?.isUser, "add", amt, selectedUser?.uid)}
                        className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 rounded-lg text-[10px] font-mono font-bold transition active:scale-95 cursor-pointer"
                      >
                        +${amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
                      </button>
                    ))}
                    <button
                      onClick={() => handleUserCashOperation(selectedUser?.handle, selectedUser?.isUser, "deduct", 50000, selectedUser?.uid)}
                      className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 rounded-lg text-[10px] font-mono font-bold transition active:scale-95 cursor-pointer"
                    >
                      -$50k
                    </button>
                    <button
                      onClick={() => handleUserCashOperation(selectedUser?.handle, selectedUser?.isUser, "set", 5000, selectedUser?.uid)}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 rounded-lg text-[10px] font-mono font-bold transition active:scale-95 cursor-pointer"
                    >
                      Reset $5k
                    </button>
                    <button
                      onClick={() => handleUserCashOperation(selectedUser?.handle, selectedUser?.isUser, "set", 0, selectedUser?.uid)}
                      className="px-2.5 py-1 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-800/30 text-rose-400 rounded-lg text-[10px] font-mono font-bold transition active:scale-95 cursor-pointer"
                    >
                      Zero ($0)
                    </button>
                  </div>
                </div>
              </div>

              {/* Module 2: 💎 Arcade Gems Reserve Management */}
              <div className="bg-zinc-950/70 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Arcade Gems Reserve</h4>
                      <p className="text-[10px] text-zinc-400">Credit, deduct, or adjust arcade gems balance</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    Current: 💎 {(selectedUser?.gems ?? 100).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-cyan-400">💎</span>
                    <input
                      type="number"
                      placeholder="Gems amount..."
                      value={userExactGemsInput[selectedUser?.handle] ?? userGemsDelta[selectedUser?.handle] ?? 250}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserExactGemsInput((prev) => ({ ...prev, [selectedUser?.handle]: val }));
                        setUserGemsDelta((prev) => ({ ...prev, [selectedUser?.handle]: Number(val) }));
                      }}
                      className="w-full bg-zinc-900 border border-cyan-500/30 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-3 sm:flex items-center gap-2">
                    <button
                      disabled={isMutatingUser === selectedUser?.handle}
                      onClick={() => {
                        const amt = Number(userExactGemsInput[selectedUser?.handle] ?? userGemsDelta[selectedUser?.handle] ?? 250);
                        handleUserGemsOperation(selectedUser?.handle, selectedUser?.isUser, "add", Math.max(0, amt), selectedUser?.uid);
                      }}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                    <button
                      disabled={isMutatingUser === selectedUser?.handle}
                      onClick={() => {
                        const amt = Number(userExactGemsInput[selectedUser?.handle] ?? userGemsDelta[selectedUser?.handle] ?? 250);
                        handleUserGemsOperation(selectedUser?.handle, selectedUser?.isUser, "deduct", Math.max(0, amt), selectedUser?.uid);
                      }}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Minus className="w-3.5 h-3.5" /> Deduct
                    </button>
                    <button
                      disabled={isMutatingUser === selectedUser?.handle}
                      onClick={() => {
                        const amt = Number(userExactGemsInput[selectedUser?.handle] ?? userGemsDelta[selectedUser?.handle] ?? 250);
                        handleUserGemsOperation(selectedUser?.handle, selectedUser?.isUser, "set", Math.max(0, amt), selectedUser?.uid);
                      }}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      Set Exact
                    </button>
                  </div>
                </div>

                {/* Quick Presets for Gems */}
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 block mb-1.5 font-bold uppercase">Quick Gem Bundles:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[50, 250, 1000, 5000, 25000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => handleUserGemsOperation(selectedUser?.handle, selectedUser?.isUser, "add", amt, selectedUser?.uid)}
                        className="px-2.5 py-1 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 rounded-lg text-[10px] font-mono font-bold transition active:scale-95 cursor-pointer"
                      >
                        +💎 {amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                    <button
                      onClick={() => handleUserGemsOperation(selectedUser?.handle, selectedUser?.isUser, "deduct", 500, selectedUser?.uid)}
                      className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 rounded-lg text-[10px] font-mono font-bold transition active:scale-95 cursor-pointer"
                    >
                      -500 💎
                    </button>
                    <button
                      onClick={() => handleUserGemsOperation(selectedUser?.handle, selectedUser?.isUser, "set", 100, selectedUser?.uid)}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 rounded-lg text-[10px] font-mono font-bold transition active:scale-95 cursor-pointer"
                    >
                      Reset 100 💎
                    </button>
                  </div>
                </div>
              </div>

              {/* Module 3: 👑 Prestige Tier, Custom Titles & Permissions */}
              <div className="bg-zinc-950/70 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Prestige Rank & Custom Titles</h4>
                      <p className="text-[10px] text-zinc-400">Assign prestige tier level (0-10) and custom title flair</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Tier Lvl {selectedUser?.prestige || 0}
                  </span>
                </div>

                {/* Prestige Tier Stepper */}
                <div className="grid grid-cols-3 sm:flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => handleUserPrestigeUpdate(selectedUser?.handle, selectedUser?.isUser, Math.max(0, (selectedUser?.prestige || 0) - 1), selectedUser?.uid)}
                    className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer text-center"
                  >
                    -1 Tier
                  </button>

                  <select
                    value={selectedUser?.prestige || 0}
                    onChange={(e) => handleUserPrestigeUpdate(selectedUser?.handle, selectedUser?.isUser, Number(e.target.value), selectedUser?.uid)}
                    className="col-span-1 sm:flex-1 bg-zinc-900 border border-amber-500/40 rounded-xl px-2 sm:px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none cursor-pointer"
                  >
                    {PRESTIGE_TIERS.map((tier) => (
                      <option key={tier.level} value={tier.level} className="bg-zinc-900 text-white">
                        Lvl {tier.level}: {tier.title}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleUserPrestigeUpdate(selectedUser?.handle, selectedUser?.isUser, Math.min(10, (selectedUser?.prestige || 0) + 1), selectedUser?.uid)}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer text-center"
                  >
                    +1 Tier
                  </button>
                </div>

                {/* Custom Title Input & Fast Chips */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter custom title / flair..."
                      value={userCustomTitleDraft[selectedUser?.handle] ?? selectedUser?.title ?? "Trader"}
                      onChange={(e) =>
                        setUserCustomTitleDraft((prev) => ({
                          ...prev,
                          [selectedUser?.handle]: e.target.value,
                        }))
                      }
                      className="flex-1 bg-zinc-900 border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                    />
                    <button
                      onClick={() => {
                        const newTitle = userCustomTitleDraft[selectedUser?.handle] ?? selectedUser?.title ?? "Trader";
                        handleUserTitleUpdate(selectedUser?.handle, selectedUser?.isUser, newTitle, selectedUser?.uid);
                      }}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer shrink-0"
                    >
                      Save Title
                    </button>
                  </div>

                  {/* Title Preset Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["Whale Dev", "Alpha Hunter", "Market Maker", "VIP Scalper", "Liquidity King", "Degenerate Ape", "Root Admin"].map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setUserCustomTitleDraft((prev) => ({ ...prev, [selectedUser?.handle]: t }));
                          handleUserTitleUpdate(selectedUser?.handle, selectedUser?.isUser, t, selectedUser?.uid);
                        }}
                        className="px-2 py-0.5 bg-purple-950/30 hover:bg-purple-900/50 border border-purple-500/20 text-purple-300 rounded-lg text-[9px] font-mono font-bold transition active:scale-95 cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin Role Permission Switch */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-900/80 border border-white/5 rounded-xl gap-2 mt-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 shrink-0 ${selectedUser?.isAdmin ? "text-emerald-400" : "text-zinc-500"}`} />
                    <div>
                      <div className="text-xs font-bold text-white">Administrator Authority</div>
                      <div className="text-[10px] text-zinc-400">Grants access to Owner Dashboard terminal</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUserRoleToggle(selectedUser?.handle, selectedUser?.isUser, !selectedUser?.isAdmin, selectedUser?.uid)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer active:scale-95 self-start sm:self-auto ${
                      selectedUser?.isAdmin
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                    }`}
                  >
                    {selectedUser?.isAdmin ? "Revoke Admin" : "Promote Admin"}
                  </button>
                </div>
              </div>

              {/* Module 4: 🛡️ Sanctions & Security Enforcement */}
              <div className="bg-zinc-950/70 border border-rose-500/30 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Account Sanctions & Enforcement</h4>
                      <p className="text-[10px] text-zinc-400">Apply timed suspensions, permanent bans, or clear penalties</p>
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-bold ${
                    selectedUser?.isBanned ? "text-rose-400" : selectedUser?.isSuspended ? "text-amber-400" : "text-emerald-400"
                  }`}>
                    {selectedUser?.isBanned ? "BANNED" : selectedUser?.isSuspended ? "SUSPENDED" : "GOOD STANDING"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleToggleSanction(selectedUser?.handle, selectedUser?.isUser, "suspend", selectedUser?.uid)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedUser?.isSuspended
                        ? "bg-amber-500 text-black shadow-lg"
                        : "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Suspend ({suspendDurationDays >= 1 ? `${suspendDurationDays}d` : `${Math.round(suspendDurationDays * 24)}h`})</span>
                  </button>

                  <button
                    onClick={() => handleToggleSanction(selectedUser?.handle, selectedUser?.isUser, "ban", selectedUser?.uid)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedUser?.isBanned
                        ? "bg-rose-600 text-white shadow-lg"
                        : "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400"
                    }`}
                  >
                    <Skull className="w-3.5 h-3.5" />
                    <span>Blacklist Ban</span>
                  </button>

                  <button
                    onClick={() => handleToggleSanction(selectedUser?.handle, selectedUser?.isUser, "lift", selectedUser?.uid)}
                    className="py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Lift Sanctions</span>
                  </button>
                </div>

                {/* Factory Reset Profile Action */}
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> Factory Reset User Account
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      Restores balance to $5,000, 100 gems, prestige 0, and clears all sanctions.
                    </div>
                  </div>
                  <button
                    onClick={() => handleResetUserAccount(selectedUser?.handle, selectedUser?.isUser, selectedUser?.uid)}
                    className="px-3.5 py-2 bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold rounded-lg border border-red-500/40 shadow transition active:scale-95 shrink-0 cursor-pointer text-center"
                  >
                    Reset Profile
                  </button>
                </div>
              </div>
            </div>

            {/* Module 5: 📜 User Activity & Execution History */}
            <div className="bg-zinc-950/60 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white">Live Activity & Trade History for {selectedUser?.name}</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {selectedUser?.tradesCount || 0} Trades Recorded • {selectedUser?.coinsCreatedCount || 0} Coins Launched
                </span>
              </div>

              {/* Logs stream */}
              <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                {(selectedUser?.activityLog && selectedUser.activityLog.length > 0) ? (
                  selectedUser.activityLog.map((log: any, idx: number) => (
                    <div
                      key={log.id || idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-white/5 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                          log.category === "trade"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : log.category === "risk"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-indigo-500/20 text-indigo-400"
                        }`}>
                          {log.category || "activity"}
                        </span>
                        <span className="text-zinc-300 truncate">{log.action || log.message || "Executed operation"}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "Recent"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-zinc-500 font-mono">
                    No recent suspicious flags or security audit infractions recorded for this account.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* --- TAB 5: ANNOUNCEMENTS & PROMO CODES --- */}
      {/* ==================================================== */}
      {activeSubTab === "announcements" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Dispatch Announcement Card */}
          <div className="glass-panel border border-rose-500/30 bg-rose-950/10 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Live Global Announcement Broadcaster</h3>
                <p className="text-xs text-zinc-400">Dispatches real-time banners to all connected clients and mobile devices</p>
              </div>
            </div>

            <form onSubmit={handleDispatchAnnouncement} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 mb-1.5 block">Bulletin Title:</label>
                  <input
                    type="text"
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    placeholder="e.g., 🚨 CENTRAL RESERVE EXPANSION"
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 mb-1.5 block">Category:</label>
                    <select
                      value={alertType}
                      onChange={(e) => setAlertType(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none"
                    >
                      <option value="trade">📈 Trade Rally</option>
                      <option value="info">ℹ️ General Info</option>
                      <option value="crash">💀 Market Crash</option>
                      <option value="achievement">👑 Milestone</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 mb-1.5 block">Duration:</label>
                    <select
                      value={broadcastTimeLimit}
                      onChange={(e) => setBroadcastTimeLimit(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={60}>1 Hour</option>
                      <option value={1440}>24 Hours</option>
                      <option value={0}>Permanent</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 mb-1.5 block">Message Content:</label>
                <textarea
                  rows={2}
                  value={alertMsg}
                  onChange={(e) => setAlertMsg(e.target.value)}
                  placeholder="Enter detailed broadcast message..."
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isPublishingBroadcast || !alertTitle.trim() || !alertMsg.trim()}
                className="py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-950/40 border border-rose-400/40 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {isPublishingBroadcast ? "Dispatched..." : "Broadcast Global Announcement"}
              </button>
            </form>

            {/* Active Broadcasts Manager */}
            {activeBroadcastsList.length > 0 && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                <span className="text-xs font-extrabold text-zinc-400 uppercase font-mono">
                  Currently Active Broadcasts ({activeBroadcastsList.length}):
                </span>
                <div className="flex flex-col gap-2">
                  {activeBroadcastsList.map((b) => (
                    <div
                      key={b.$id}
                      className="flex items-center justify-between gap-3 p-3 bg-zinc-950 border border-white/5 rounded-2xl"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate">{b.title}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{b.message}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteBroadcast(b.$id)}
                        className="p-2 bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 rounded-xl text-xs transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Promo Code Creator */}
          <div className="glass-panel border border-amber-500/30 bg-amber-950/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Ticket className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Promo Code Issuer</h3>
                <p className="text-xs text-zinc-400">Publish claimable coupon codes with cash or gem rewards</p>
              </div>
            </div>

            <form onSubmit={handlePublishPromoCode} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-mono text-zinc-400 mb-1 block">Promo Code:</label>
                <input
                  type="text"
                  value={promoPubCode}
                  onChange={(e) => setPromoPubCode(e.target.value.toUpperCase())}
                  placeholder="PUMP50K"
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-400 mb-1 block">Reward Type:</label>
                <select
                  value={promoPubType}
                  onChange={(e) => setPromoPubType(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                >
                  <option value="cash">💵 Cash ($)</option>
                  <option value="gems">💎 Gems</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-400 mb-1 block">Amount:</label>
                <input
                  type="number"
                  value={promoPubAmount}
                  onChange={(e) => setPromoPubAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={promoPubIsLoading || !promoPubCode || !promoPubAmount}
                className="py-2 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black text-xs rounded-xl shadow-lg transition active:scale-95 cursor-pointer self-end h-[38px]"
              >
                {promoPubIsLoading ? "Publishing..." : "Issue Code"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* --- TAB 6: BUG REPORTS TRIAGE --- */}
      {/* ==================================================== */}
      {activeSubTab === "bugs" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel border border-white/10 p-5 rounded-3xl">
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Bug className="w-5 h-5 text-rose-400" />
                Real-Time User Bug Tracker ({bugReports.length})
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Inspect user submitted reports, toggle status between Open and Resolved, or prune old records.
              </p>
            </div>
            <button
              onClick={handlePruneResolvedBugs}
              disabled={isPruningBugs}
              className="px-4 py-2.5 bg-rose-600/80 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg border border-rose-400/30 transition active:scale-95 cursor-pointer self-start sm:self-auto"
            >
              {isPruningBugs ? "Pruning..." : "Prune Resolved Bugs"}
            </button>
          </div>

          {bugReports.length === 0 ? (
            <div className="glass-panel border border-white/5 p-12 rounded-3xl text-center flex flex-col items-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <h4 className="font-bold text-base text-white">Zero Bug Reports Logged</h4>
              <p className="text-xs text-zinc-400 max-w-sm">
                No active bug reports found in Appwrite. User reports from the navigation modal appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bugReports.map((bug) => {
                const isOpen = bug.status !== "resolved";
                return (
                  <div
                    key={bug.id}
                    className={`glass-panel border p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                      isOpen ? "border-rose-500/30 bg-rose-950/10" : "border-emerald-500/20 bg-emerald-950/5"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isOpen
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        <Bug className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-white truncate">{bug.title || "Bug Report"}</h4>
                          <span
                            className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full uppercase ${
                              isOpen
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {isOpen ? "OPEN" : "RESOLVED"}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 break-words">{bug.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono mt-2">
                          <span>Reported by: <strong className="text-zinc-300">{bug.userHandle || "Anonymous"}</strong></span>
                          <span>•</span>
                          <span>{new Date(bug.timestamp || Date.now()).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleToggleBugStatus(bug.id, bug.status || "open")}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          isOpen
                            ? "bg-emerald-600/80 hover:bg-emerald-500 text-white border-emerald-400/40"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10"
                        }`}
                      >
                        {isOpen ? "Mark Resolved" : "Re-open"}
                      </button>
                      <button
                        onClick={() => handleDeleteBugReport(bug.id)}
                        className="p-2 bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 rounded-xl text-xs transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
