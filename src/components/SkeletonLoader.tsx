import React from "react";

export function SkeletonLoader({ type }: { type?: "list" | "portfolio" | "chart" | "dashboard" }) {
  return (
    <div className="flex items-center justify-center w-full min-h-[300px]">
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className="absolute inset-0 border-4 border-fuchsia-500/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute w-2 h-2 bg-fuchsia-400 rounded-full animate-ping"></div>
      </div>
    </div>
  );
}

