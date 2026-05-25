import React from 'react';
import { HelpCircle, Sliders, PlayCircle, ShieldAlert, Award, Send, Coins } from 'lucide-react';

export default function AboutTab() {
  return (
    <div className="flex-1 flex flex-col gap-6 animate-fade-in" id="about-tab-view">
      <div className="flex flex-col">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-orange-500" /> About PumpForge
        </h2>
        <p className="text-xs text-zinc-500 font-mono tracking-wide mt-0.5">
          The ultimate decentralized meme-coin sandbox and simulation engine
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl flex flex-col gap-3">
          <h3 className="text-sm font-extrabold text-orange-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <PlayCircle className="w-4 h-4" /> Welcome Degen!
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            PumpForge is an active live-market simulation environment. You start with standard startup credits to trade, shill, bet, test, or trigger arcade simulations. Monitor values carefully because some token developers are shady dev scampers.
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Avoid getting crashed by trading quickly, or buy the dev status itself to launch custom tokens, watch other bots pump it, then pull the crash yourself for massive payout!
          </p>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl flex flex-col gap-3">
          <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Sliders className="w-4 h-4" /> Sandbox Guidelines
          </h3>
          <ul className="text-xs text-zinc-300 flex flex-col gap-2.5">
            <li className="flex gap-2">
              <span className="text-cyan-400 shrink-0 font-bold">1.</span>
              <span>Claim daily free allowances ($1,500 base) to extend your portfolio holdings.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 shrink-0 font-bold">2.</span>
              <span>Leverage the Hopium forecast models to predict price actions and claim gems.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 shrink-0 font-bold">3.</span>
              <span>Play high-multiplier Arcade games to double up or check leaderboards.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 shrink-0 font-bold">4.</span>
              <span>Reach a portfolio net worth of $100K to reset and Prestige, unlocking active perks and custom badges!</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-zinc-950/40 border border-zinc-900 p-5 rounded-2xl flex flex-col gap-4">
        <h3 className="text-sm font-extrabold text-zinc-100 uppercase tracking-widest font-mono">
          Engine Capability Specifications
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900/60 flex flex-col items-center gap-1.5">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="text-[10px] font-bold text-zinc-300">Fast Liquidity</span>
            <span className="text-[9px] font-mono text-zinc-500">Instant buy & sell orders</span>
          </div>
          <div className="bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900/60 flex flex-col items-center gap-1.5">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <span className="text-[10px] font-bold text-zinc-300">Dev delist</span>
            <span className="text-[9px] font-mono text-zinc-500">Autonomous bot dump</span>
          </div>
          <div className="bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900/60 flex flex-col items-center gap-1.5">
            <Award className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] font-bold text-zinc-300">59 Achievements</span>
            <span className="text-[9px] font-mono text-zinc-500">Claim gems & modifiers</span>
          </div>
          <div className="bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900/60 flex flex-col items-center gap-1.5">
            <Send className="w-5 h-5 text-cyan-400" />
            <span className="text-[10px] font-bold text-zinc-300">Global Transfers</span>
            <span className="text-[9px] font-mono text-zinc-500">Send sandboxed coins</span>
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
