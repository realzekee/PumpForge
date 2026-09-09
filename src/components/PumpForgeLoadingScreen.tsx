import React, { useState, useEffect } from "react";
import { Flame, Sparkles, Activity, ShieldCheck, Zap } from "lucide-react";

interface PumpForgeLoadingScreenProps {
  message?: string;
  subMessage?: string;
  variant?: "fullscreen" | "inline";
}

const LOADING_STATUSES = [
  "Igniting Forge Engine...",
  "Synchronizing Live Order Books...",
  "Connecting Appwrite Realtime Cloud...",
  "Streaming Memecoin Price Feeds...",
  "Calibrating Liquid Glass Terminals...",
  "Preparing High-Frequency Trading Desk...",
];

export default function PumpForgeLoadingScreen({
  message,
  subMessage,
  variant = "fullscreen",
}: PumpForgeLoadingScreenProps) {
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Cycle status messages smoothly
    const interval = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % LOADING_STATUSES.length);
    }, 700);

    // Simulate natural progress easing
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        const inc = Math.max(2, Math.floor((95 - prev) * 0.25));
        return Math.min(95, prev + inc);
      });
    }, 250);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, []);

  const activeStatus = message || LOADING_STATUSES[statusIdx];

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center justify-center p-8 w-full min-h-[220px] select-none">
        <div className="relative flex items-center justify-center w-16 h-16 mb-4">
          {/* Outer glowing orbital ring */}
          <div className="absolute inset-0 rounded-full border-2 border-rose-500/20 border-t-rose-500 animate-spin" />
          <div className="absolute -inset-1 rounded-full border border-amber-500/10 border-b-amber-400/40 animate-spin [animation-direction:reverse] [animation-duration:3s]" />
          
          {/* Center Glass Flame Badge */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/50 border border-white/20">
            <Flame className="w-5 h-5 fill-rose-200/30 text-rose-100 animate-pulse" />
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-zinc-300 tracking-wider">
          {activeStatus}
        </span>
        {subMessage && (
          <span className="text-[10px] font-mono text-zinc-500 mt-1">
            {subMessage}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      id="pumpforge-master-loader"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07070b] text-white select-none overflow-hidden"
    >
      {/* Dynamic Ambient Background Nebulas (Reflecting PumpForge Colorway) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Top-left Crimson Glow */}
        <div className="absolute -top-[15%] -left-[10%] w-[70vw] h-[70vw] max-w-[550px] max-h-[550px] rounded-full bg-gradient-to-br from-rose-600/20 via-pink-600/10 to-transparent blur-[120px] animate-pulse [animation-duration:4s]" />
        
        {/* Center-right Indigo Nebula */}
        <div className="absolute top-[30%] -right-[15%] w-[65vw] h-[65vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-bl from-indigo-600/15 via-purple-600/10 to-transparent blur-[110px]" />
        
        {/* Bottom Amber/Ember Core */}
        <div className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-t from-amber-600/15 via-rose-600/10 to-transparent blur-[120px]" />

        {/* Delicate Cyber Grid / Star Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />
      </div>

      {/* Main Glass HUD Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm sm:max-w-md w-full px-6 text-center">
        {/* Central Luminous Forge Core */}
        <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 mb-8 group">
          {/* Specular Ambient Backlight */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-rose-500/30 via-red-500/20 to-amber-500/20 blur-2xl animate-pulse" />

          {/* Outer Glass Ring with Glowing Dash */}
          <div className="absolute inset-0 rounded-full border border-white/10 shadow-[0_0_25px_rgba(244,63,94,0.2)]" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-rose-500 border-r-amber-500/50 animate-spin [animation-duration:2.5s]" />
          
          {/* Secondary Counter-Rotating Orbital Ring */}
          <div className="absolute inset-2 rounded-full border border-white/5" />
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-rose-400/80 border-l-fuchsia-500/40 animate-spin [animation-direction:reverse] [animation-duration:4s]" />

          {/* Outer Floating Sparkle Nodes */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_10px_#f43f5e] animate-ping" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />

          {/* Center Liquid Glass Shield Badge */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 flex items-center justify-center text-white shadow-2xl shadow-rose-950/80 border border-white/30 backdrop-blur-xl transition-transform duration-500">
            {/* Specular Highlight Sheen on Glass */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 via-transparent to-black/20 pointer-events-none" />
            <Flame className="w-8 h-8 sm:w-10 sm:h-10 fill-rose-200/40 text-rose-100 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] animate-pulse" />
          </div>
        </div>

        {/* Brand Typography */}
        <div className="flex flex-col items-center gap-1.5 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white uppercase drop-shadow-[0_2px_10px_rgba(244,63,94,0.3)]">
              PumpForge
            </span>
            <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400">
              PRO
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
            <span>High-Frequency Trading Platform</span>
          </div>
        </div>

        {/* Liquid Glass Progress Bar */}
        <div className="w-full max-w-[260px] sm:max-w-[280px] flex flex-col gap-2 mb-4">
          <div className="relative w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden border border-white/10 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
              style={{ width: `${progress}%` }}
            />
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.6s_infinite]" />
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 px-1 font-bold">
            <span className="text-rose-400/90 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              SYSTEM BOOT
            </span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Dynamic Telemetry Status Text */}
        <div className="h-6 flex items-center justify-center">
          <p className="text-xs sm:text-sm font-mono font-bold text-zinc-300 tracking-tight transition-all duration-300">
            {activeStatus}
          </p>
        </div>

        {/* Bottom Hardware / Cloud Security Badge */}
        <div className="mt-8 pt-6 border-t border-white/[0.07] w-full flex items-center justify-center gap-4 text-[10px] font-mono text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Appwrite Cloud</span>
          </span>
          <span className="text-zinc-700">•</span>
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>Order Engine 2.4</span>
          </span>
        </div>
      </div>
    </div>
  );
}
