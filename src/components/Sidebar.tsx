import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Query } from "appwrite";
import { toast } from "sonner";
import { databases } from "../appwrite";
import {
  Home,
  TrendingUp,
  Brain,
  Gamepad2,
  Trophy,
  ShoppingBag,
  Briefcase,
  Grid,
  PlusCircle,
  Menu,
  ChevronDown,
  Gift,
  X,
  Sparkles,
  RefreshCw,
  LogOut,
  Sliders,
  DollarSign,
  AlertTriangle,
  User,
  Hash,
  LogIn,
  Cloud,
  Flame,
  Bell,
  Info,
  Clock,
  ShieldCheck,
  Settings as SettingsIcon,
  Code,
  ShieldAlert,
  Crown,
} from "lucide-react";
import {
  ActiveTab,
  UserStats,
  LiveTrade,
  MemeCoin,
  PortfolioHolding,
} from "../types";

interface SidebarProps {
  userStats: UserStats;
  onClaimDailyReward: () => void;
  liveTrades: LiveTrade[];
  onOpenPrestigeModal: () => void;
  onResetProgress: () => void;
  dailyRewardTimer: string;
  isDailyRewardAvailable: boolean;
  currentUser: any;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  coins?: MemeCoin[];
  holdings?: PortfolioHolding[];
  onOpenBugReportModal?: () => void;
  registeredUsers?: Array<UserStats & { uid: string }>;
}

import { useAppContext } from "../context/AppContext";

export default function Sidebar({
  userStats,
  onClaimDailyReward,
  liveTrades,
  onOpenPrestigeModal,
  onResetProgress,
  dailyRewardTimer,
  isDailyRewardAvailable,
  currentUser,
  onGoogleSignIn,
  onSignOut,
  coins = [],
  holdings = [],
  onOpenBugReportModal,
  registeredUsers = [],
}: SidebarProps) {
  const { adminSettings } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab =
    location.pathname === "/" ? "home" : location.pathname.substring(1);

  const [isOpen, setIsOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false); // Bottom user profile popover
  const [promoCode, setPromoCode] = useState("");
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");
  const [isDarkModeText, setIsDarkModeText] = useState("Light Mode");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const checkMobile = () => {
      setIsMobile(media.matches);
    };
    checkMobile();
    if (media.addEventListener) {
      media.addEventListener("change", checkMobile);
    } else {
      media.addListener(checkMobile);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", checkMobile);
      } else {
        media.removeListener(checkMobile);
      }
    };
  }, []);

  const isOwnerEmail =
    currentUser?.email === "realzekeee@gmail.com" ||
    currentUser?.email === "realzekee@gmail.com";
  const isStaff =
    userStats.title.toLowerCase() === "owner" ||
    userStats.title.toLowerCase() === "admin";
  const hasOwnerDashboard = isOwnerEmail || isStaff;

  interface MenuItem {
    id: string;
    label: string;
    icon: React.ElementType;
    badge?: string | number;
  }

  const menuItems: MenuItem[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "market", label: "Market", icon: TrendingUp },
    { id: "polymarket", label: "Polymarket", icon: Brain },
    { id: "arcade", label: "Arcade", icon: Gamepad2 },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "shop", label: "Shop", icon: ShoppingBag },
    { id: "portfolio", label: "Portfolio", icon: Briefcase },
    { id: "treemap", label: "Treemap", icon: Grid },
    { id: "create-coin", label: "Create coin", icon: PlusCircle },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "about", label: "About", icon: Info },
    ...(hasOwnerDashboard
      ? [{ id: "owner-dashboard", label: "Owner Panel", icon: ShieldAlert },
         { id: "owner/polymarket-resolve", label: "Resolve Markets", icon: ShieldAlert }]
      : []),
  ];

  // Calculate quick metrics for the middle sidebar card
  const holdingsValue = (holdings || []).reduce((sum, h) => {
    const coin = (coins || []).find((c) => c && c.id === h.coinId);
    if (coin) {
      const hAmt = typeof h.amount === 'number' && !isNaN(h.amount) ? h.amount : Number(h.amount) || 0;
      const cPrice = typeof coin.price === 'number' && !isNaN(coin.price) ? coin.price : Number(coin.price) || 0;
      return sum + (hAmt * cPrice);
    }
    return sum;
  }, 0);

  const safeCash = typeof userStats?.cash === 'number' && !isNaN(userStats.cash) ? userStats.cash : Number(userStats?.cash) || 0;
  const totalPortfolioValue = safeCash + holdingsValue;

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    
    // Auth Check
    const uid = currentUser?.uid || currentUser?.$id;
    if (!uid) {
      setPromoError("You must be logged in to claim promos.");
      return;
    }

    setPromoError("");
    setPromoSuccess("");
    toast.loading("Verifying promo code...", { id: "promo-claim" });

    try {
      // Query promocodes collection for the submitted code
      const response = await databases.listDocuments(
        "pumpforge",
        "promocodes",
        [Query.equal("code", code)]
      );

      if (response.documents.length === 0) {
         toast.error("Invalid promo code.", { id: "promo-claim" });
         setPromoError("Invalid promo code.");
         return;
      }

      const promoDoc = response.documents[0];

      if (!promoDoc.isActive) {
         toast.error("This promo code is expired.", { id: "promo-claim" });
         setPromoError("This promo code is inactive/expired.");
         return;
      }

      const nowTime = new Date().getTime();
      if (promoDoc.expiresAt && new Date(promoDoc.expiresAt).getTime() < nowTime) {
         toast.error("This promo code has expired.", { id: "promo-claim" });
         setPromoError("This promo code has expired.");
         return;
      }

      const claimedArray: string[] = promoDoc.claimedBy || [];
      if (claimedArray.includes(uid)) {
         toast.error("Code already claimed on this account", { id: "promo-claim" });
         setPromoError("Code already claimed on this account.");
         return;
      }

      // Valid and unused by this user!
      const rewardAmt = Number(promoDoc.rewardAmount) || 0;
      
      // Update promo document
      await databases.updateDocument("pumpforge", "promocodes", promoDoc.$id, {
        claimedBy: [...claimedArray, uid]
      });

      // Update user document
      if (promoDoc.rewardType === "gems") {
        await databases.updateDocument("pumpforge", "users", uid, {
           gems: (userStats.gems || 0) + rewardAmt
        });
        toast.success(`Redeemed! +${rewardAmt} Gems`, { id: "promo-claim" });
        setPromoSuccess(`Redeemed! +${rewardAmt} Gems`);
      } else {
        await databases.updateDocument("pumpforge", "users", uid, {
           cash: (userStats.cash || 0) + rewardAmt
        });
        toast.success(`Redeemed! +$${rewardAmt.toLocaleString()} Cash`, { id: "promo-claim" });
        setPromoSuccess(`Redeemed! +$${rewardAmt.toLocaleString()} Cash`);
      }
      setPromoCode("");
    } catch (err: any) {
      console.error("Promo code processing error:", err);
      toast.error("Error verifying promo code. Please check your connection.", { id: "promo-claim" });
      setPromoError("Error verifying promo code.");
    }
  };

  const toggleLightMode = () => {
    setIsDarkModeText((prev) =>
      prev === "Light Mode" ? "Dark Mode" : "Light Mode",
    );
  };

  const claimYield = Math.floor(
    1500 * (1 + (userStats.prestigeLevel || 0) * 0.25),
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="flex md:hidden bg-[#0a0a0e]/80 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 sticky top-0 z-40 items-center justify-between">
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2 cursor-pointer select-none active:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/40 border border-white/20">
            <Flame className="w-4 h-4 fill-red-300/30 text-rose-200 animate-pulse" />
          </div>
          <span className="font-extrabold text-white tracking-wider text-xl uppercase">
            PumpForge
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
          id="mobile-menu-btn"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`glass-sidebar w-64 flex flex-col justify-between transition-transform duration-300 fixed inset-y-0 left-0 z-50 transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="app-sidebar"
      >
        {/* Logo Heading: PumpForge */}
        <div
          onClick={() => navigate("/")}
          className="p-5 hidden md:flex items-center gap-3 overflow-hidden select-none border-b border-white/[0.08] cursor-pointer hover:opacity-95 active:opacity-80 transition-opacity shrink-0 animate-fade-in"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/50 border border-white/20">
            <Flame className="w-5 h-5 fill-rose-300/30 text-rose-100 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-white tracking-wider text-lg uppercase leading-tight">
              PumpForge
            </span>
            <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">
              Trading Engine
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col justify-between">
          {/* Navigation Items */}
          <nav className="px-3 py-4 flex flex-col gap-1 shrink-0">
            {menuItems.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => {
                    navigate(item.id === "home" ? "/" : `/${item.id}`);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-all duration-200 select-none cursor-pointer ${
                    isSelected
                      ? "bg-white/[0.1] text-white border-l-2 border-rose-500 pl-2.5 backdrop-blur-md shadow-sm shadow-black/20"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]"
                  }`}
                >
                  <IconComp
                    className={`w-4 h-4 transition-transform duration-200 ${isSelected ? "scale-110 text-rose-400" : ""}`}
                  />
                  <span className="flex-1 text-left truncate">
                    {item.label}
                  </span>
                  {item.id === "create-coin" && (
                    <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                      New
                    </span>
                  )}
                  {item.id === "owner-dashboard" && (
                    <span className="text-[9px] bg-rose-500/15 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider scale-90 animate-pulse text-glow">
                      SYS
                    </span>
                  )}
                  {item.badge ? (
                    <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-mono font-black border border-rose-500 shadow-sm shadow-rose-950/50">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* BOTTOM SECTION OF SIDEBAR */}
          <div className="p-3 bg-transparent flex flex-col gap-3 border-t border-white/[0.08] shrink-0 mt-auto">
            {/* Daily Reward Button */}
            <button
              onClick={onClaimDailyReward}
              disabled={!isDailyRewardAvailable}
              className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all duration-300 border cursor-pointer ${
                isDailyRewardAvailable
                  ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border-white/20 shadow-lg shadow-rose-950/40 active:scale-98 font-bold"
                  : "bg-white/[0.04] text-zinc-500 cursor-not-allowed border-white/[0.05]"
              }`}
              id="claim-daily-btn"
            >
              {!isDailyRewardAvailable ? (
                <div className="flex items-center justify-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Next in {dailyRewardTimer}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 font-bold">
                  <Gift className="w-3.5 h-3.5 animate-bounce text-rose-200" />
                  <span>Claim ${claimYield.toLocaleString()}</span>
                </div>
              )}
            </button>

            {/* Live Trades Activity */}
            <div
              className="glass-card p-2.5 rounded-xl flex flex-col gap-1 max-h-[115px]"
              id="live-activity-box"
            >
              <div className="flex items-center justify-between mb-0.5 px-1">
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                  Live Trades
                </span>
                <Link
                  to="/trades"
                  onClick={() => setIsOpen(false)}
                  className="text-[8px] text-zinc-400 font-mono hover:text-white transition-colors cursor-pointer"
                >
                  View All
                </Link>
              </div>
              <div
                className="flex flex-col gap-1 overflow-hidden min-h-[50px]"
                id="live-activity-ticker"
              >
                {(!liveTrades || liveTrades.length === 0) ? (
                  <div className="text-[10px] text-zinc-500 font-mono text-center py-4">No recent trades</div>
                ) : (
                  (liveTrades || []).slice(0, 3).map((trade, idx) => {
                    const resolvedHandle = registeredUsers.find(u => u.uid === trade.userId || u.handle === trade.userHandle)?.handle || trade.userHandle;
                    return (
                    <div
                      key={trade.id + "-" + idx}
                      className="text-[10px] bg-white/[0.03] border border-white/[0.05] p-1.5 rounded-lg flex flex-col gap-0.5 hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-zinc-300 font-bold truncate max-w-[85px]">
                          {resolvedHandle}
                        </span>
                        <span
                          className={`font-mono font-black text-[9px] px-1 rounded uppercase tracking-wider ${
                            trade.type === "BUY"
                              ? "text-emerald-400 bg-emerald-950/40 border border-emerald-500/20"
                              : trade.type === "SELL"
                                ? "text-rose-400 bg-rose-950/40 border border-rose-500/20"
                                : "text-cyan-400 bg-cyan-950/40 border border-cyan-500/20"
                          }`}
                        >
                          {trade.type}
                        </span>
                      </div>
                      <div className="font-mono text-zinc-400 truncate flex items-center justify-between">
                        <span>
                          $
                          {trade.amountUsd >= 1000
                            ? `${(trade.amountUsd / 1000).toFixed(2)}K`
                            : typeof trade.amountUsd === 'number' ? trade.amountUsd.toFixed(2) : "0.00"}
                        </span>
                        <span className="text-zinc-500 text-[9px]">
                          {trade.coinSymbol === 'CASH_TRANSFER' ? '💵' : '*'}{trade.coinSymbol === 'CASH_TRANSFER' ? 'TRANSFER' : trade.coinSymbol}
                        </span>
                      </div>
                    </div>
                  );
                 })
                )}
              </div>
            </div>

            {/* Portfolio Metric Quick Summary Card */}
            <div
              className="glass-card p-3 rounded-xl flex flex-col gap-1.5"
              id="portfolio-metric-sidebar-widget"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-mono font-bold">
                  Portfolio
                </span>
              </div>
              <div className="flex flex-col gap-1 font-mono text-xs">
                <div className="flex justify-between items-center bg-white/[0.04] p-1.5 rounded-lg border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400">
                    Total Value:
                  </span>
                  <span className="text-emerald-400 font-extrabold tracking-tight">
                    $
                    {(Number(totalPortfolioValue) || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 px-1 text-[10px]">
                  <span className="text-zinc-400">Cash:</span>
                  <span className="text-zinc-200 font-bold">
                    $
                    {(Number(userStats?.cash) || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 px-1 text-[10px]">
                  <span className="text-zinc-400">Coins:</span>
                  <span className="text-zinc-200 font-bold">
                    $
                    {(Number(holdingsValue) || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 px-1 text-[10px]">
                  <span className="text-zinc-400">Gems:</span>
                  <span className="text-cyan-400 font-bold flex items-center gap-1">
                    💎 {Number(userStats?.gems) || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Avatar Profile Footer Area with custom sliding Popup menu overlay */}
            <div className="relative pt-1">
              {/* Popover options menu */}
              {showDropdown && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-2 glass-modal rounded-2xl py-1.5 px-1.5 shadow-2xl z-50 flex flex-col gap-0.5 select-none animate-slide-up max-h-[360px] overflow-y-auto pointer-events-auto"
                  id="profile-popover-options"
                >
                  <div className="flex items-center gap-2.5 p-2 border-b border-white/10 mb-1 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center text-sm font-black select-none">
                      Z
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-white truncate">
                          {userStats.username}
                        </span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <span className="text-[9px] text-zinc-400 font-mono tracking-tight font-bold flex items-center gap-1 flex-wrap">
                        <span>{userStats.handle}</span>
                        <span>•</span>
                        <span className="text-amber-400 font-extrabold">
                          Lvl {userStats.prestigeLevel || 0}
                        </span>
                        <span>•</span>
                        <span className="text-zinc-300 font-extrabold uppercase tracking-widest scale-95">
                          {userStats.title}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Popover links */}
                  <button
                    onClick={() => {
                      navigate("/profile");
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.08] text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-orange-400" />
                    <span>Account</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate("/settings");
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.08] text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono cursor-pointer"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenPrestigeModal();
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.08] text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    <span>Prestige</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowPromoModal(true);
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.08] text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono cursor-pointer"
                  >
                    <Hash className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Promo code</span>
                  </button>

                  <button
                    onClick={() => {
                      toggleLightMode();
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.08] text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-yellow-400" />
                    <span>{isDarkModeText}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenBugReportModal) onOpenBugReportModal();
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.08] text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Report Bug</span>
                  </button>

                  <button
                    onClick={() => {
                      onSignOut();
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.08] text-rose-400 hover:text-rose-300 flex items-center gap-2 rounded-lg transition-colors font-mono border-t border-white/10 mt-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              )}

              {/* Core user profile button in Sidebar */}
              {!currentUser ||
              userStats?.handle === "@player" ||
              userStats?.handle === "@guest_degen" ? (
                <button
                  onClick={onGoogleSignIn}
                  className="w-full bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-extrabold p-3.5 rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-98 transition-transform font-mono text-xs uppercase tracking-wider border border-white/20"
                  id="sidebar-google-signin-btn"
                >
                  <LogIn className="w-4 h-4 text-white animate-pulse" />
                  <span>Google Sign-In</span>
                </button>
              ) : (
                <div
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="glass-card hover:bg-white/[0.08] border border-white/10 p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer select-none active:scale-98 transition-all font-mono"
                  id="avatar-profile-footer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm font-black shrink-0 uppercase ${
                      userStats.blackSwanCosmetic
                        ? "bg-gradient-to-br from-zinc-900 to-rose-950 border-rose-500/60 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                        : "bg-orange-500/20 border-orange-500/30 text-orange-400"
                    }`}>
                      {userStats.username
                        ? userStats.username.trim().charAt(0)
                        : "?"}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className={`text-xs font-extrabold truncate ${
                            adminSettings.rainbowCosmetics || userStats.rainbowCosmetics
                              ? "text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 via-cyan-400 to-pink-500 animate-pulse font-black"
                              : userStats.nameColor || "text-white"
                          }`}
                        >
                          {userStats.username}
                        </span>
                        {userStats.blackSwanCosmetic ? (
                          <span className="px-1 py-0.2 rounded border border-rose-500/40 text-rose-300 font-mono text-[7px] bg-rose-950/40 uppercase font-black shrink-0 tracking-wider shadow-[0_0_8px_rgba(244,63,94,0.3)] animate-pulse flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5 text-rose-400" /> SWAN
                          </span>
                        ) : userStats.title.toLowerCase() === "owner" ? (
                          <Crown className="w-3.5 h-3.5 text-rose-400 animate-pulse text-glow shrink-0" />
                        ) : userStats.title.toLowerCase() === "admin" ? (
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse text-glow shrink-0" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        {adminSettings.customAdminBadge && (
                          <span className="px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400 font-mono text-[7px] bg-rose-950/20 uppercase font-bold shrink-0 tracking-wider">
                            {adminSettings.customAdminBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono tracking-tight text-glow">
                        <span>{userStats.handle}</span>
                        <span>•</span>
                        <span className="text-amber-400 font-bold flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> Lvl {userStats.prestigeLevel || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Promo Voucher Code Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4 select-none">
          <div className="glass-modal p-6 rounded-2xl max-w-sm w-full relative font-mono text-center animate-slide-up">
            <button
              onClick={() => {
                setShowPromoModal(false);
                setPromoError("");
                setPromoSuccess("");
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5 text-rose-400">
              <Gift className="w-4 h-4" /> Enter Promo Code
            </h3>
            <p className="text-[11px] text-zinc-300 mb-4 tracking-normal leading-relaxed">
              Unlock market credit bonuses or cosmetics crate items
              instantly. Use <strong className="text-white">DEGEN50K</strong>{" "}
              or <strong className="text-white">GEMLORD</strong> to test!
            </p>
            <form onSubmit={handlePromoSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="MEMEX-XXXX"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="glass-input rounded-xl px-4 py-2.5 text-sm text-center text-white tracking-widest font-mono focus:outline-none focus:border-rose-500 uppercase"
              />
              {promoError && (
                <span className="text-[11px] text-rose-400 font-semibold font-mono text-center">
                  ⚠️ {promoError}
                </span>
              )}
              {promoSuccess && (
                <span className="text-[11px] text-emerald-400 font-semibold font-mono text-center animate-pulse">
                  ✨ {promoSuccess}
                </span>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg border border-white/20 cursor-pointer active:scale-98"
                id="apply-voucher-btn"
              >
                Apply Voucher
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
