import React, { useState, useEffect } from "react";
import { Coins } from "lucide-react";

interface PumpForgeLoadingScreenProps {
  message?: string;
  subMessage?: string;
  variant?: "fullscreen" | "inline";
}

export default function PumpForgeLoadingScreen({
  message,
  subMessage,
  variant = "fullscreen",
}: PumpForgeLoadingScreenProps) {
  const [progress, setProgress] = useState(45);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 96 ? 96 : prev + 15));
    }, 90);
    return () => clearInterval(progressInterval);
  }, []);

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center justify-center p-8 w-full min-h-[180px] select-none">
        <div className="relative flex items-center justify-center w-12 h-12 mb-3">
          <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-zinc-950 shadow-md">
            <Coins className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>
        <span className="text-xs font-medium text-zinc-300">
          {message || "Loading..."}
        </span>
        {subMessage && (
          <span className="text-[11px] text-zinc-500 mt-0.5">{subMessage}</span>
        )}
      </div>
    );
  }

  return (
    <div
      id="pumpforge-master-loader"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0d0d10] text-zinc-100 select-none overflow-hidden"
    >
      {/* Subtle warm ambient glow matching the app's calm dark + gradient orange theme */}
      <div
        className="absolute w-72 h-72 rounded-full bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center max-w-xs w-full px-6 py-7 rounded-2xl bg-[#141417] border border-white/[0.07] shadow-2xl text-center">
        {/* Clean Gradient Orange Medallion */}
        <div className="relative flex items-center justify-center w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-2xl border-2 border-orange-500/25 border-t-orange-400 animate-spin [animation-duration:1.2s]" />
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-zinc-950 shadow-lg shadow-orange-950/40">
            <Coins className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold tracking-tight text-white">
            PumpForge
          </span>
          <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 text-orange-300">
            Live
          </span>
        </div>

        <p className="text-xs text-zinc-400 mb-4">
          {message || "Syncing workspace..."}
        </p>

        {/* Smooth Gradient Orange Progress Bar */}
        <div className="w-full h-1.5 bg-[#0e0e11] rounded-full overflow-hidden border border-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 rounded-full transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
