import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { apiRedeemPromocode } from "../api/gameClient";
import { formatErrorMessage } from "../utils/formatError";
import { playSound, isSoundMuted, toggleSoundMute } from "../utils/sound";
import {
  Home,
  Store,
  ArrowUpDown,
  Gamepad2,
  Trophy,
  ShoppingBag,
  Briefcase,
  BarChart2,
  Coins,
  Menu,
  ChevronDown,
  Gift,
  X,
  Sparkles,
  LogOut,
  AlertTriangle,
  User,
  Hash,
  LogIn,
  Bell,
  Info,
  Clock,
  Settings as SettingsIcon,
  ShieldAlert,
  Volume2,
  VolumeX,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import {
  UserStats,
  LiveTrade,
  MemeCoin,
  PortfolioHolding,
} from "../types";
import { useAppContext } from "../context/AppContext";

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
  onOpenSetupGuide?: () => void;
  onSignOut: () => void;
  coins?: MemeCoin[];
  holdings?: PortfolioHolding[];
  onOpenBugReportModal?: () => void;
  registeredUsers?: Array<UserStats & { uid: string }>;
  onUpdateStats?: (updater: (stats: UserStats) => void) => void;
}

export default function Sidebar({
  userStats,
  onClaimDailyReward,
  liveTrades,
  onOpenPrestigeModal,
  dailyRewardTimer,
  isDailyRewardAvailable,
  currentUser,
  onGoogleSignIn,
  onSignOut,
  onOpenBugReportModal,
  registeredUsers = [],
  onUpdateStats,
}: SidebarProps) {
  const { setCash, setGems } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab =
    location.pathname === "/" ? "home" : location.pathname.substring(1);

  const [isOpen, setIsOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");
  const [muted, setMuted] = useState(() => isSoundMuted());

  const isOwnerEmail =
    currentUser?.email === "realzekeee@gmail.com" ||
    currentUser?.email === "realzekee@gmail.com";
  const isStaff =
    (userStats.title || "").toLowerCase().includes("owner") ||
    (userStats.title || "").toLowerCase().includes("admin");
  const hasOwnerDashboard = isOwnerEmail || isStaff;

  interface MenuItem {
    id: string;
    label: string;
    icon: React.ElementType;
  }

  const menuItems: MenuItem[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "market", label: "Market", icon: Store },
    { id: "polymarket", label: "Predictions", icon: ArrowUpDown },
    { id: "arcade", label: "Arcade", icon: Gamepad2 },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "shop", label: "Shop", icon: ShoppingBag },
    { id: "portfolio", label: "Portfolio", icon: Briefcase },
    { id: "treemap", label: "Treemap", icon: BarChart2 },
    { id: "create-coin", label: "Create coin", icon: Coins },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "about", label: "About", icon: Info },
    ...(hasOwnerDashboard
      ? [
          { id: "owner-dashboard", label: "Owner Panel", icon: ShieldAlert },
          { id: "owner/polymarket-resolve", label: "Resolve Markets", icon: Activity },
        ]
      : []),
  ];

  const safeCash =
    typeof userStats?.cash === "number" && !isNaN(userStats.cash)
      ? userStats.cash
      : Number(userStats?.cash) || 0;
  const safeGems =
    typeof userStats?.gems === "number" && !isNaN(userStats.gems)
      ? userStats.gems
      : Number(userStats?.gems) ?? 50;

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    const uid = currentUser?.uid || currentUser?.$id;
    if (!uid) {
      setPromoError("Sign in to redeem promo codes.");
      return;
    }

    setPromoError("");
    setPromoSuccess("");
    toast.loading("Checking code...", { id: "promo-claim" });

    try {
      const res = await apiRedeemPromocode(code);
      if (res && res.reward) {
        const rewardAmt = Number(res.reward.amount) || 0;
        const rewardType = res.reward.type;
        const msg =
          rewardType === "gems"
            ? `+${rewardAmt} Gems`
            : `+$${rewardAmt.toLocaleString()} Cash`;
        playSound("win");
        toast.success(`Redeemed ${msg}`, { id: "promo-claim" });
        setPromoSuccess(`Redeemed ${msg}`);

        if (res.userStats) {
          if (onUpdateStats) {
            onUpdateStats((prev) => ({
              ...prev,
              cash:
                res.userStats.cash !== undefined
                  ? res.userStats.cash
                  : prev.cash,
              gems:
                res.userStats.gems !== undefined
                  ? res.userStats.gems
                  : prev.gems,
            }));
          }
          if (setCash && res.userStats.cash !== undefined)
            setCash(res.userStats.cash);
          if (setGems && res.userStats.gems !== undefined)
            setGems(res.userStats.gems);
        }
      } else {
        playSound("win");
        toast.success("Promo code redeemed!", { id: "promo-claim" });
        setPromoSuccess("Promo code redeemed!");
      }
      setPromoCode("");
    } catch (err: any) {
      const errMsg = formatErrorMessage(err, "Invalid or expired promo code.");
      toast.error(errMsg, { id: "promo-claim" });
      setPromoError(errMsg);
    }
  };

  const claimYield = Math.floor(
    1500 * (1 + (userStats.prestigeLevel || 0) * 0.25),
  );

  return (
    <>
      {/* Clean Mobile Top Bar with Live Balance */}
      <header className="flex md:hidden bg-[#121215] border-b border-white/[0.06] px-3.5 py-2.5 sticky top-0 z-40 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              playSound("click");
              setIsOpen(!isOpen);
            }}
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
            id="mobile-menu-btn"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-xs shadow-sm">
              🪙
            </span>
            <span className="font-bold text-white tracking-tight text-base">
              PumpForge
            </span>
          </div>
        </div>

        {/* Always-visible Cash & Gems on Mobile */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-[#18181c] border border-orange-500/20 text-emerald-400 font-bold">
            $
            {safeCash >= 1000000
              ? `${(safeCash / 1000000).toFixed(2)}M`
              : safeCash.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </div>
          <div className="px-2 py-1 rounded-lg bg-[#18181c] border border-white/[0.06] text-amber-400 font-bold flex items-center gap-1">
            <span>💎</span>
            <span>{safeGems}</span>
          </div>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/65 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Calm Rugplay-Style Sidebar Drawer with Gradient Orange Accents */}
      <aside
        className={`w-64 bg-[#121215] border-r border-white/[0.06] flex flex-col justify-between transition-transform duration-150 fixed inset-y-0 left-0 z-50 transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="app-sidebar"
      >
        {/* Brand Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05] shrink-0">
          <div
            onClick={() => {
              navigate("/");
              setIsOpen(false);
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-sm shadow-md shadow-orange-950/40">
              🪙
            </span>
            <span className="font-bold text-white text-base tracking-tight">
              PumpForge
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMuted(toggleSoundMute())}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              title={muted ? "Unmute sound effects" : "Mute sound effects"}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-orange-400" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white md:hidden cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Nav + Rugplay-Style Live Trades */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col justify-between px-3 py-3">
          <nav className="flex flex-col gap-0.5 shrink-0">
            {menuItems.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => {
                    playSound("click");
                    navigate(item.id === "home" ? "/" : `/${item.id}`);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-[13.5px] transition-colors select-none cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-transparent text-white font-semibold border border-orange-500/30"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.04] font-normal border border-transparent"
                  }`}
                >
                  <IconComp
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? "text-orange-400" : "text-zinc-400"
                    }`}
                  />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Rugplay-Style Live Trades Section */}
          <div className="mt-5 pt-4 border-t border-white/[0.05] px-1">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-orange-400" />
                <span>Live Trades</span>
              </span>
              <Link
                to="/trades"
                onClick={() => setIsOpen(false)}
                className="text-xs text-orange-400/90 hover:text-orange-300 transition-colors"
              >
                View All
              </Link>
            </div>

            <div className="flex flex-col gap-2" id="live-activity-ticker">
              {!liveTrades || liveTrades.length === 0 ? (
                <div className="text-xs text-zinc-500 py-2">
                  No recent trades
                </div>
              ) : (
                (liveTrades || []).slice(0, 5).map((trade, idx) => {
                  const resolvedHandle =
                    registeredUsers.find(
                      (u) =>
                        u.uid === trade.userId || u.handle === trade.userHandle,
                    )?.handle ||
                    trade.userHandle ||
                    "@trader";
                  const cleanHandle = resolvedHandle.startsWith("@")
                    ? resolvedHandle
                    : `@${resolvedHandle}`;
                  const isBuy = trade.type === "BUY";
                  const amtFormatted =
                    trade.amountUsd >= 1000
                      ? `$${(trade.amountUsd / 1000).toFixed(2)}K`
                      : `$${Number(trade.amountUsd || 0).toFixed(2)}`;

                  return (
                    <div
                      key={trade.id + "-" + idx}
                      className="flex items-center gap-2 text-xs truncate py-0.5"
                    >
                      {isBuy ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold uppercase shrink-0 ${
                          isBuy
                            ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                            : "border-rose-500/40 text-rose-400 bg-rose-500/5"
                        }`}
                      >
                        {trade.type}
                      </span>
                      <span className="font-semibold text-zinc-100 shrink-0">
                        {amtFormatted}
                      </span>
                      <span className="text-zinc-400 truncate">
                        *{trade.coinSymbol} by {cleanHandle}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Balance, Daily Reward & User Profile */}
          <div className="mt-5 pt-3 border-t border-white/[0.06] flex flex-col gap-2.5 shrink-0">
            {/* Compact Balance Bar */}
            <div className="grid grid-cols-2 gap-1.5 bg-[#18181c] p-2 rounded-xl border border-white/[0.05] font-mono text-xs">
              <div className="flex flex-col px-1">
                <span className="text-[10px] text-zinc-500">Cash</span>
                <span className="text-emerald-400 font-bold truncate">
                  $
                  {safeCash.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex flex-col px-1 border-l border-white/[0.06]">
                <span className="text-[10px] text-zinc-500">Gems</span>
                <span className="text-amber-400 font-bold">💎 {safeGems}</span>
              </div>
            </div>

            {/* Daily Reward Button (Gradient Orange when available) */}
            <button
              onClick={() => {
                playSound("click");
                onClaimDailyReward();
              }}
              disabled={!isDailyRewardAvailable}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border cursor-pointer ${
                isDailyRewardAvailable
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-zinc-950 border-orange-400/40 shadow-md shadow-orange-950/30"
                  : "bg-white/[0.03] text-zinc-500 cursor-not-allowed border-white/[0.05]"
              }`}
              id="claim-daily-btn"
            >
              {!isDailyRewardAvailable ? (
                <div className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>
                    {dailyRewardTimer?.startsWith("Next in")
                      ? dailyRewardTimer
                      : `Next in ${dailyRewardTimer}`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <Gift className="w-3.5 h-3.5" />
                  <span>Claim Daily (${claimYield.toLocaleString()})</span>
                </div>
              )}
            </button>

            {/* User Profile / Sign In */}
            <div className="relative">
              {showDropdown && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-2 bg-[#18181c] border border-white/[0.1] rounded-xl py-1.5 px-1.5 shadow-2xl z-50 flex flex-col gap-0.5 select-none"
                  id="profile-popover-options"
                >
                  <button
                    onClick={() => {
                      navigate("/profile");
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] text-zinc-300 hover:text-white flex items-center gap-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-orange-400" />
                    <span>Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate("/settings");
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] text-zinc-300 hover:text-white flex items-center gap-2.5 rounded-lg transition-colors cursor-pointer"
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
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] text-zinc-300 hover:text-white flex items-center gap-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Prestige</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowPromoModal(true);
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] text-zinc-300 hover:text-white flex items-center gap-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Hash className="w-3.5 h-3.5 text-orange-400" />
                    <span>Promo Code</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenBugReportModal) onOpenBugReportModal();
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] text-zinc-300 hover:text-white flex items-center gap-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Report Issue</span>
                  </button>

                  <button
                    onClick={() => {
                      onSignOut();
                      setShowDropdown(false);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] text-rose-400 flex items-center gap-2.5 rounded-lg transition-colors border-t border-white/[0.06] mt-1 pt-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              )}

              {!currentUser ||
              userStats?.handle === "@player" ||
              userStats?.handle === "@guest_degen" ? (
                <button
                  onClick={() => {
                    playSound("click");
                    onGoogleSignIn();
                  }}
                  className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-zinc-950 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all text-xs shadow-md shadow-orange-950/30"
                  id="sidebar-google-signin-btn"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
              ) : (
                <div
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="bg-[#18181c] hover:bg-[#1e1e24] border border-white/[0.06] p-2.5 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors"
                  id="avatar-profile-footer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/25 to-amber-500/20 border border-orange-500/35 text-orange-300 flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                      {userStats.username
                        ? userStats.username.trim().charAt(0)
                        : "Z"}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-white truncate">
                        {userStats.username}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">
                        {userStats.handle}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-150 ${
                      showDropdown ? "rotate-180" : ""
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Promo Code Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-[#141417] border border-white/[0.1] p-6 rounded-2xl max-w-sm w-full relative text-center">
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
            <h3 className="text-sm font-bold text-white mb-1.5 flex items-center justify-center gap-1.5">
              <Gift className="w-4 h-4 text-orange-400" /> Promo Code
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter a voucher code to claim bonus cash or gems.
            </p>
            <form onSubmit={handlePromoSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="ENTER CODE"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="bg-[#0e0e11] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-center text-white font-mono focus:outline-none focus:border-orange-500/50 uppercase"
              />
              {promoError && (
                <span className="text-xs text-rose-400">{promoError}</span>
              )}
              {promoSuccess && (
                <span className="text-xs text-emerald-400">{promoSuccess}</span>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-zinc-950 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                id="apply-voucher-btn"
              >
                Redeem
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
