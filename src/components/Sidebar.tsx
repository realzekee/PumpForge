import React, { useState, useEffect } from 'react';
import {
  Home,
  TrendingUp,
  Brain,
  Gamepad2,
  Trophy,
  ShoppingBag,
  Award,
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
  Crown
} from 'lucide-react';
import { ActiveTab, UserStats, LiveTrade, MemeCoin, PortfolioHolding } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
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
}

export default function Sidebar({
  activeTab,
  setActiveTab,
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
  onOpenBugReportModal
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false); // Bottom user profile popover
  const [promoCode, setPromoCode] = useState('');
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [isDarkModeText, setIsDarkModeText] = useState('Light Mode');

  const isOwnerEmail = currentUser?.email === 'realzekeee@gmail.com' || currentUser?.email === 'realzekee@gmail.com';
  const isStaff = userStats.title.toLowerCase() === 'owner' || userStats.title.toLowerCase() === 'admin';
  const hasOwnerDashboard = isOwnerEmail || isStaff;

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'market', label: 'Market', icon: TrendingUp },
    { id: 'hopium', label: 'Hopium', icon: Brain },
    { id: 'arcade', label: 'Arcade', icon: Gamepad2 },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'achievements', label: 'Achievements', icon: Award },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'treemap', label: 'Treemap', icon: Grid },
    { id: 'create-coin', label: 'Create coin', icon: PlusCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'about', label: 'About', icon: Info },
    ...(hasOwnerDashboard ? [{ id: 'owner-dashboard', label: 'Owner Panel', icon: ShieldAlert }] : []),
  ];

  // Calculate quick metrics for the middle sidebar card
  const holdingsValue = holdings.reduce((sum, h) => {
    const coin = coins.find((c) => c.id === h.coinId);
    if (coin && true) {
      return sum + h.amount * coin.price;
    }
    return sum;
  }, 0);

  const totalPortfolioValue = userStats.cash + holdingsValue;

  const handlePromoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (code === 'DEGEN50K') {
      userStats.cash += 50000;
      setPromoSuccess('Promo applied! +$50,000 Cash!');
      setPromoError('');
    } else if (code === 'GEMLORD') {
      userStats.gems += 500;
      setPromoSuccess('Promo applied! +500 Gems!');
      setPromoError('');
    } else if (code === 'MEMEX') {
      userStats.cash += 5000;
      userStats.gems += 50;
      setPromoSuccess('Promo applied! +$5,000 Cash & +50 Gems!');
      setPromoError('');
    } else {
      setPromoError('Invalid or expired promo code.');
      setPromoSuccess('');
    }
    setPromoCode('');
  };

  const toggleLightMode = () => {
    setIsDarkModeText((prev) => prev === 'Light Mode' ? 'Dark Mode' : 'Light Mode');
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden bg-zinc-950 border-b border-zinc-900 px-4 py-3 sticky top-0 z-40 flex items-center justify-between">
        <div
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2 cursor-pointer select-none active:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-650 flex items-center justify-center text-white shadow-lg shadow-rose-950/40">
            <Flame className="w-4 h-4 fill-red-300/30 text-rose-200 animate-pulse" />
          </div>
          <span className="font-extrabold text-white tracking-wider text-xl uppercase">PumpForge</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
          id="mobile-menu-btn"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 bg-zinc-950 border-r border-zinc-900 w-64 z-50 transform md:transform-none md:sticky md:top-0 md:h-screen transition-transform duration-300 flex flex-col justify-between ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="app-sidebar"
      >
        {/* Logo Heading: crashPLAY */}
        <div
          onClick={() => setActiveTab('home')}
          className="p-5 hidden md:flex items-center gap-3 overflow-hidden select-none border-b border-zinc-900/60 cursor-pointer hover:opacity-95 active:opacity-80 transition-opacity shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-650 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/30">
            <Flame className="w-5 h-5 fill-rose-300/30 text-rose-105 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-white tracking-wider text-lg uppercase leading-tight">PumpForge</span>
            <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Simulation Engine</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col justify-between">
          {/* Navigation Items */}
          <nav className="px-3 py-4 flex flex-col gap-0.5 shrink-0">
            {menuItems.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id as ActiveTab);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-205 select-none ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-l-2 border-rose-500 pl-2 text-glow shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  <IconComp className={`w-4 h-4 transition-transform duration-250 ${isSelected ? 'scale-110' : ''}`} />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.id === 'hopium' && (
                    <span className="text-[9px] bg-orange-950 border border-orange-900/60 text-orange-400 px-1 py-0.2 rounded font-mono font-bold tracking-widest uppercase">
                      AI
                    </span>
                  )}
                  {item.id === 'create-coin' && (
                    <span className="text-[9px] bg-emerald-950 border border-emerald-900/60 text-emerald-400 px-1 py-0.2 rounded font-mono font-bold uppercase">
                      New
                    </span>
                  )}
                  {item.id === 'owner-dashboard' && (
                    <span className="text-[9px] bg-rose-950/60 border border-rose-900/40 text-rose-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider scale-90 animate-pulse text-glow">
                      SYS
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* BOTTOM SECTION OF SIDEBAR */}
          <div className="p-3 bg-zinc-950 flex flex-col gap-3.5 border-t border-zinc-900/65 shrink-0 mt-auto">

          {/* Daily Reward Button - Styled Pink/Red like the video */}
          <button
            onClick={onClaimDailyReward}
            disabled={!isDailyRewardAvailable}
            className={`w-full py-2.5 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all duration-300 border ${
              isDailyRewardAvailable
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 hover:brightness-110 active:scale-98 shadow-md shadow-rose-950/30 font-bold'
                : 'bg-zinc-900 text-zinc-500 cursor-not-allowed border-zinc-900'
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
                <Gift className="w-3.5 h-3.5 animate-bounce" />
                <span>Claim $1,500</span>
              </div>
            )}
          </button>

          {/* Live Trades Activity */}
          <div className="flex flex-col gap-1 max-h-[110px]" id="live-activity-box">
            <div className="flex items-center justify-between mb-0.5 px-1">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                Live Trades
              </span>
              <span className="text-[8px] text-zinc-655 font-mono hover:underline cursor-pointer" onClick={() => setActiveTab('home')}>View All</span>
            </div>
            <div className="flex flex-col gap-1.5 overflow-hidden" id="live-activity-ticker">
              {liveTrades.slice(0, 3).map((trade, idx) => (
                <div
                  key={trade.id + '-' + idx}
                  className="text-[10px] bg-zinc-900/10 border border-zinc-900/30 p-2 rounded-lg flex flex-col gap-0.5 hover:bg-zinc-900/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-zinc-400 font-bold truncate max-w-[85px]">
                      {trade.userHandle}
                    </span>
                    <span className={`font-mono font-black text-[9px] px-1 rounded uppercase tracking-wider ${
                      trade.type === 'BUY'
                        ? 'text-emerald-400 bg-emerald-950/30'
                        : trade.type === 'SELL'
                        ? 'text-rose-450 bg-rose-955/30'
                        : 'text-cyan-400 bg-cyan-950/30'
                    }`}>
                      {trade.type}
                    </span>
                  </div>
                  <div className="font-mono text-zinc-400 truncate flex items-center justify-between">
                    <span>${trade.amountUsd >= 1000 ? `${(trade.amountUsd / 1000).toFixed(2)}K` : trade.amountUsd.toFixed(2)}</span>
                    <span className="text-zinc-500 text-[9px]">*{trade.coinSymbol}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio Metric Quick Summary Card (Matching 0:06 in the Video) */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3 flex flex-col gap-1.5" id="portfolio-metric-sidebar-widget">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-zinc-550 uppercase tracking-widest font-mono font-bold">Portfolio</span>
            </div>
            <div className="flex flex-col gap-1 font-mono text-xs">
              <div className="flex justify-between items-center bg-zinc-950/40 p-1.5 rounded-lg border border-zinc-900/45">
                <span className="text-[10px] text-zinc-400">Total Value:</span>
                <span className="text-emerald-400 font-extrabold tracking-tight">
                  ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 px-1 text-[10px]">
                <span className="text-zinc-500">Cash:</span>
                <span className="text-zinc-300 font-bold">
                  ${userStats.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 px-1 text-[10px]">
                <span className="text-zinc-500">Coins:</span>
                <span className="text-zinc-300 font-bold">
                  ${holdingsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 px-1 text-[10px]">
                <span className="text-zinc-500">Gems:</span>
                <span className="text-cyan-405 font-bold flex items-center gap-1">
                  💎 {userStats.gems}
                </span>
              </div>
            </div>
          </div>

          {/* Avatar Profile Footer Area with custom sliding Popup menu overlay */}
          <div className="relative pt-1">
            {/* Popover options menu (matching 0:10 in video exactly) */}
            {showDropdown && (
              <div
                className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-zinc-800 rounded-2xl py-1.5 px-1.5 shadow-2xl z-50 flex flex-col gap-0.5 select-none animate-slide-up max-h-[360px] overflow-y-auto pointer-events-auto"
                id="profile-popover-options"
              >
                {/* Header info user inside popup */}
                <div className="flex items-center gap-2.5 p-2 border-b border-zinc-800/80 mb-1 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-orange-600/15 text-orange-500 border border-orange-500/20 flex items-center justify-center text-sm font-black select-none">
                    Z
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-white truncate">{userStats.username}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-[9px] text-zinc-500 font-mono tracking-tight font-bold flex items-center gap-1">
                      <span>{userStats.handle}</span>
                      <span>•</span>
                      <span className="text-zinc-400 font-extrabold uppercase tracking-widest scale-95">{userStats.title}</span>
                    </span>
                  </div>
                </div>

                {/* Popover links */}
                <button
                  onClick={() => {
                    setActiveTab('profile');
                    setShowDropdown(false);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-zinc-850 text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono"
                >
                  <User className="w-3.5 h-3.5 text-orange-400" />
                  <span>Account</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setShowDropdown(false);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-zinc-850 text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono"
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
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-zinc-850 text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono"
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
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-zinc-850 text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono"
                >
                  <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Promo code</span>
                </button>

                <button
                  onClick={() => {
                    toggleLightMode();
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-zinc-850 text-zinc-300 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono"
                >
                  <Clock className="w-3.5 h-3.5 text-yellow-450" />
                  <span>{isDarkModeText}</span>
                </button>

                <button
                  onClick={() => {
                    if (onOpenBugReportModal) onOpenBugReportModal();
                    setShowDropdown(false);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-zinc-850 text-zinc-305 hover:text-white flex items-center gap-2 rounded-lg transition-colors font-mono"
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
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-zinc-850 text-rose-400 hover:text-rose-300 flex items-center gap-2 rounded-lg transition-colors font-mono border-t border-zinc-800/60 mt-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}

            {/* Core user profile button in Sidebar */}
            {!currentUser ? (
              <button
                onClick={onGoogleSignIn}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-extrabold p-3.5 rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-98 transition-transform font-mono text-xs uppercase tracking-wider"
                id="sidebar-google-signin-btn"
              >
                <LogIn className="w-4 h-4 text-white animate-pulse" />
                <span>Google Sign-In</span>
              </button>
            ) : (
              <div
                onClick={() => setShowDropdown(!showDropdown)}
                className="bg-zinc-900 border border-zinc-850 p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-zinc-900/80 active:scale-98 transition-transform font-mono"
                id="avatar-profile-footer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-500 flex items-center justify-center text-sm font-black shrink-0 uppercase">
                    {userStats.username ? userStats.username.trim().charAt(0) : '?'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-extrabold truncate ${userStats.rainbowCosmetics ? 'text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 via-cyan-400 to-pink-500 animate-pulse font-black' : (userStats.nameColor || 'text-white')}`}>
                        {userStats.username}
                      </span>
                      {userStats.title.toLowerCase() === 'owner' ? (
                        <Crown className="w-3.5 h-3.5 text-rose-400 animate-pulse text-glow shrink-0" />
                      ) : userStats.title.toLowerCase() === 'admin' ? (
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse text-glow shrink-0" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      {userStats.customAdminBadge && (
                        <span className="px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400 font-mono text-[7px] bg-rose-950/20 uppercase font-bold shrink-0 tracking-wider">
                          {userStats.customAdminBadge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono tracking-tight text-glow">{userStats.handle}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-250 ${showDropdown ? 'rotate-180' : ''}`} />
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>

      {/* Promo Voucher Code Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-zinc-900 border border-zinc-805 p-6 rounded-2xl max-w-sm w-full relative font-mono text-center">
            <button
              onClick={() => {
                setShowPromoModal(false);
                setPromoError('');
                setPromoSuccess('');
              }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5 text-rose-500">
              <Gift className="w-4 h-4" /> Enter Promo Code
            </h3>
            <p className="text-[11px] text-zinc-400 mb-4 tracking-normal leading-relaxed">
              Unlock simulation credit bonuses or cosmetics crate items instantly. Use <strong className="text-zinc-200">DEGEN50K</strong> or <strong className="text-zinc-200">GEMLORD</strong> to test!
            </p>
            <form onSubmit={handlePromoSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="MEMEX-XXXX"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-center text-white tracking-widest font-mono focus:outline-none focus:border-rose-500 uppercase"
              />
              {promoError && (
                <span className="text-[11px] text-rose-450 font-semibold font-mono text-center">
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
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors"
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
