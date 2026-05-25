import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Award,
  Flame,
  Bomb,
  User,
  Zap,
  ArrowRight,
  PlusCircle,
  AlertOctagon,
  MessageSquare,
  Check,
  ShieldAlert
} from 'lucide-react';
import { MemeCoin, UserStats, Achievement } from '../types';

interface HomeTabProps {
  coins: MemeCoin[];
  userStats: UserStats;
  achievements: Achievement[];
  onClaimAchievement: (id: string) => void;
  setActiveTab: (tab: any) => void;
  onTradeCoin: (coinId: string) => void;
}

export default function HomeTab({
  coins,
  userStats,
  achievements,
  onClaimAchievement,
  setActiveTab,
  onTradeCoin
}: HomeTabProps) {
  // Sort coins by marketcap or high price changes
  const hotCoins = [...coins].sort((a, b) => b.change24h - a.change24h).slice(0, 3);

  // Directly handle personalized manual action notices sent by the admin
  const [dismissedNoticeIds, setDismissedNoticeIds] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dismissed_notices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDismissNotice = (id: string) => {
    const nextDismissed = [...dismissedNoticeIds, id];
    setDismissedNoticeIds(nextDismissed);
    localStorage.setItem('dismissed_notices', JSON.stringify(nextDismissed));
  };

  const manualNotices = (userStats.activityLog || [])
    .filter(log => log.id.startsWith('manual_') && !dismissedNoticeIds.includes(log.id));

  const claimedCount = achievements.filter((a) => a.claimed).length;
  const totalCount = achievements.length;
  const completionPercentage = totalCount ? (claimedCount / totalCount) * 100 : 0;

  // Sort achievements: claimable first, then locked/unachieved, then claimed at the absolute bottom
  const sortedAchievements = [...achievements].sort((a, b) => {
    const aComplete = a.current >= a.target;
    const bComplete = b.current >= b.target;
    if (a.claimed && !b.claimed) return 1;
    if (!a.claimed && b.claimed) return -1;
    if (aComplete && !bComplete) return -1;
    if (!aComplete && bComplete) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Personalized Direct Admin Notices */}
      {manualNotices.map((notice) => (
        <div 
          key={notice.id}
          className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-indigo-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-fade-in text-indigo-100"
        >
          {/* Subtle decoration gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none" />
          
          <div className="flex items-start gap-3.5 z-10">
            <div className="p-2.5 bg-black/40 rounded-xl border border-indigo-500/10 shrink-0 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm tracking-wide text-white uppercase tracking-wider">Direct Admin Dispatch</span>
                <span className="text-[8.5px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded text-indigo-400 bg-indigo-500/15">
                  Private Notice
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                {notice.action}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 self-end sm:self-center shrink-0 z-10">
            <span className="text-[10px] text-zinc-500 font-mono font-bold">
              {new Date(notice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={() => handleDismissNotice(notice.id)}
              className="px-4 py-2 bg-indigo-500 border border-indigo-450/40 hover:bg-indigo-450 active:scale-95 text-white text-xs font-black rounded-xl tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Acknowledge</span>
            </button>
          </div>
        </div>
      ))}
      {/* Hero Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-amber-600/10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col gap-2 max-w-lg z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-950/40 border border-orange-900/60 text-orange-400 font-mono text-[10px] font-extrabold uppercase uppercase tracking-wider self-center md:self-start">
            <Sparkles className="w-3 h-3 text-orange-400" />
            Season 1 is Live
          </div>
          <h2 className="text-xl md:text-3xl font-black text-white tracking-tight leading-tight">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400 text-glow">PumpForge</span>
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 font-medium">
            Simulate a high-speed meme coin trader! Launch coins, buy low, dump high, survive the devs and run the arcade table. Complete achievements to unlock custom skins.
          </p>

          <div className="flex items-center gap-3 mt-2 justify-center md:justify-start">
            <button
              onClick={() => setActiveTab('market')}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white transition-all flex items-center gap-1 shadow-lg shadow-orange-950/20 active:scale-98"
            >
              Start Trading <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTab('create-coin')}
              className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-xs font-bold text-zinc-300 transition-all flex items-center gap-1"
            >
              Launch Coin <PlusCircle className="w-3.5 h-3.5 text-orange-400" />
            </button>
          </div>
        </div>

        {/* Big visual graphic */}
        <div className="bg-zinc-950/80 border border-zinc-850 p-5 rounded-xl flex flex-col gap-3 min-w-[240px] shadow-xl z-10 relative">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold flex items-center justify-between">
            <span>Market Status</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </span>
          <div className="h-px bg-zinc-900" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Total Coins</span>
            <span className="text-sm text-white font-black font-mono">14,586</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">24h Vol Simulated</span>
            <span className="text-sm text-emerald-400 font-black font-mono">$1.48M</span>
          </div>

        </div>
      </div>

      {/* Main Grid: Hot coins & simulator chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (span 2): Hot Meme Coins */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between leading-none">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" /> Hot Gainers
            </h3>
            <button
              onClick={() => setActiveTab('market')}
              className="text-xs text-orange-500 hover:text-orange-400 font-semibold flex items-center gap-1"
            >
              See all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hotCoins.map((coin) => (
              <div
                key={coin.id}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700/60 transition-all duration-200 select-none cursor-pointer group"
                onClick={() => onTradeCoin(coin.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-inner ${coin.avatarBg}`}>
                    {coin.avatarEmoji}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-zinc-500 truncate font-mono max-w-[80px] text-right">
                      {coin.creator}
                    </span>
                    <span className="text-[10px] bg-emerald-950/60 text-emerald-400 px-1 border border-emerald-900/60 rounded font-bold font-mono">
                      +{coin.change24h.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm tracking-tight truncate group-hover:text-orange-400 transition-colors">
                    {coin.name}
                  </h4>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-mono text-zinc-500">*{coin.symbol}</span>
                    <span className="text-xs font-mono font-black text-white">
                      ${coin.price.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Banner for Custom Coin launch advertisement */}
          <div className="bg-gradient-to-r from-teal-950/40 via-zinc-900 to-zinc-900 border border-teal-900/60 p-5 rounded-2xl flex items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-950 text-teal-400 border border-teal-900/50 flex items-center justify-center text-xl">🚀</div>
              <div className="flex flex-col">
                <span className="font-extrabold text-white text-sm">Become a Creator Dev!</span>
                <span className="text-xs text-zinc-400">Launch a token for $1,100 list fee and trade.</span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('create-coin')}
              className="bg-teal-600 hover:bg-teal-500 active:scale-98 text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors shrink-0"
            >
              Launch Coin
            </button>
          </div>
        </div>

        {/* Right column: Achievements Progress & Recent Graveyard */}
        <div className="flex flex-col gap-6">
          {/* Achievements Progress Card */}
          <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-xl flex flex-col gap-3 select-none animate-fade-in text-zinc-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest font-mono flex items-center gap-1.5 leading-none">
                <Award className="w-4 h-4 text-orange-500" /> Milestones & Badges
              </h3>
              <button
                onClick={() => setActiveTab('achievements')}
                className="text-[10px] text-orange-400 hover:text-orange-300 font-extrabold uppercase tracking-wider font-mono bg-orange-950/40 px-2 py-1 rounded border border-orange-900/40 transition-colors cursor-pointer"
              >
                View Details
              </button>
            </div>
            
            <div className="bg-zinc-950/60 border border-zinc-850 p-3 rounded-lg flex flex-col gap-2 font-mono">
              <div className="flex justify-between items-center text-[10px] text-zinc-400 leading-none">
                <span>Task Progress</span>
                <span className="text-amber-400 font-black">{claimedCount} / {totalCount}</span>
              </div>
              <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden p-0.5 border border-zinc-950">
                <div
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-300 shadow shadow-orange-950"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {sortedAchievements.length > 0 ? (
              <div className="flex flex-col gap-2 mt-1 max-h-[320px] overflow-y-auto pr-1.5 custom-scrollbar">
                {sortedAchievements.map((item) => {
                  const isComplete = item.current >= item.target;
                  const isClaimable = isComplete && !item.claimed;
                  const pct = Math.min((item.current / item.target) * 100, 100);
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                        item.claimed
                          ? 'border-zinc-950 bg-zinc-950/20 opacity-50 saturate-50'
                          : isClaimable
                          ? 'bg-emerald-950/20 border-emerald-900/60'
                          : 'border-zinc-950 bg-black/40 opacity-40 saturate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 leading-tight">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-white truncate">{item.title}</p>
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5">{item.description}</p>
                        </div>
                        <div className="text-[9.5px] font-mono text-zinc-400 shrink-0 text-right leading-normal font-bold">
                          <span className="text-emerald-400 font-black block">+${item.cashReward.toLocaleString()}</span>
                          <span className="text-cyan-400 block font-black">💎 +{item.gemReward}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-[8px] font-mono text-zinc-500 mb-1">
                            <span>{item.current.toLocaleString()} / {item.target.toLocaleString()}</span>
                            <span>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isComplete ? 'bg-emerald-400' : 'bg-orange-500/80'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {item.claimed ? (
                          <span className="text-[8px] bg-zinc-950 text-zinc-600 border border-zinc-900/40 font-extrabold rounded-md px-1.5 py-0.5 tracking-wider uppercase select-none font-mono">
                            Claimed
                          </span>
                        ) : isClaimable ? (
                          <button
                            onClick={() => onClaimAchievement(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold py-1 px-3 rounded-lg text-[9px] uppercase tracking-wider font-mono transition-transform border border-emerald-500 animate-pulse text-glow cursor-pointer shrink-0"
                          >
                            Claim
                          </button>
                        ) : (
                          <span className="text-[8px] bg-zinc-950 text-zinc-600 border border-zinc-900 font-extrabold rounded-md px-1.5 py-0.5 tracking-wider uppercase select-none font-mono shrink-0">
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 bg-zinc-950/30 border border-zinc-850/40 rounded-lg">
                <span className="text-xs text-zinc-500 font-mono">🏆 Perfect Score! All achievements claimed!</span>
              </div>
            )}
          </div>


        </div>
      </div>

      {/* Funny chat room simulator / Telegram room drollery */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 select-none flex flex-col gap-3">
        <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-orange-500" /> Degenerate Shilling Room
        </h3>
        <div className="h-px bg-zinc-800" />
        <div className="flex flex-col gap-3 max-h-[160px] overflow-y-auto font-mono text-xs custom-scrollbar">
          <div className="text-zinc-500">
            <span
              onClick={() => {
                const target = coins.find(c => c.id === 'moonbox');
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-500 font-bold hover:underline cursor-pointer"
              title="Click to view @sol_expert coin"
            >
              @sol_expert:
            </span>{' '}
            Giga Chad sent it!{' '}
            <span
              onClick={() => {
                const target = coins.find(c => c.symbol === 'ATI');
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-400 font-black cursor-pointer hover:text-white bg-orange-950/20 px-1 border border-orange-900/20 rounded font-mono"
            >
              ATI
            </span>{' '}
            is moving, dev didn't dump yet!
          </div>

          <div className="text-zinc-500">
            <span
              onClick={() => {
                const target = coins.find(c => c.id === 'gigachad');
                if (target) onTradeCoin(target.id);
              }}
              className="text-amber-500 font-bold hover:underline cursor-pointer"
              title="Click to view @pump_master coin"
            >
              @pump_master:
            </span>{' '}
            who bought{' '}
            <span
              onClick={() => {
                const target = coins.find(c => c.symbol === 'ROAD');
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-400 font-black cursor-pointer hover:text-white bg-orange-950/20 px-1 border border-orange-900/20 rounded font-mono"
            >
              ROAD
            </span>{' '}
            below 4c? easy 5x incoming fr, loading up!
          </div>

          <div className="text-zinc-550 mb-1">
            <span
              onClick={() => {
                const target = coins.find(c => c.id === 'bome');
                if (target) onTradeCoin(target.id);
              }}
              className="text-purple-400 font-bold hover:underline cursor-pointer"
              title="Click to view @degen_ape coin"
            >
              @degen_ape:
            </span>{' '}
            just lost half my portfolio on{' '}
            <span
              onClick={() => {
                const target = coins.find(c => c.symbol === 'MEW');
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-400 font-black cursor-pointer hover:text-white bg-orange-950/20 px-1 border border-orange-900/20 rounded font-mono"
            >
              MEW
            </span>{' '}
            coinflipped on arcade coin dev is a fat liar
          </div>

          <div className="text-zinc-500">
            <span
              onClick={() => {
                const target = coins.find(c => c.id === 'omega');
                if (target) onTradeCoin(target.id);
              }}
              className="text-rose-455 font-bold hover:underline cursor-pointer"
              title="Click to view @alpha_caller coin"
            >
              @alpha_caller:
            </span>{' '}
            <span
              onClick={() => {
                const target = coins.find(c => c.symbol === 'OMGA');
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-400 font-black cursor-pointer hover:text-white bg-orange-950/20 px-1 border border-orange-900/20 rounded font-mono"
            >
              OMGA
            </span>{' '}
            has closed! RIP to the buyers dev took 100 Sol liquidity lmao
          </div>

          <div className="text-zinc-500">
            <span className="text-cyan-400 font-bold">@paper_hands:</span> sold my{' '}
            <span
              onClick={() => {
                const target = coins.find(c => c.symbol === 'ATI');
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-400 font-black cursor-pointer hover:text-white bg-orange-950/20 px-1 border border-orange-900/20 rounded font-mono"
            >
              ATI
            </span>{' '}
            early, im crying now im so paperhanded i deserve to stay poor
          </div>

          <div className="text-zinc-550">
            <span
              onClick={() => {
                const target = coins.find(c => c.id === 'memex250');
                if (target) onTradeCoin(target.id);
              }}
              className="text-teal-400 font-bold hover:underline cursor-pointer"
              title="Click to view @diamond_dev"
            >
              @diamond_dev:
            </span>{' '}
            Launching a coin in 5 minutes darlings, prepare your liquidity bags!
          </div>
        </div>
      </div>

      <div className="text-center mt-2">
        <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
          Everything is made by zeke
        </p>
      </div>
    </div>
  );
}
