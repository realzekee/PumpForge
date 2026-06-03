import React from "react";

export function SkeletonLoader({ type = "portfolio" }: { type?: "portfolio" | "owner" }) {
  return (
    <div className="w-full h-full max-w-4xl mx-auto p-4 md:p-8 animate-pulse flex flex-col gap-6">
      {type === "portfolio" && (
        <>
          <div className="flex flex-col gap-4">
            <div className="h-8 bg-zinc-900 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-32 bg-zinc-800/50 rounded-2xl border border-zinc-800"></div>
              <div className="h-32 bg-zinc-800/50 rounded-2xl border border-zinc-800 md:col-span-2"></div>
            </div>
            <div className="h-6 bg-zinc-900 rounded w-1/4 mt-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-zinc-800/30 rounded-xl border border-zinc-800/50 flex gap-4 p-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-lg shrink-0"></div>
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
                    <div className="h-3 bg-zinc-800 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {type === "owner" && (
        <>
          <div className="flex flex-col gap-4">
            <div className="h-10 bg-zinc-900 rounded w-1/2"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-zinc-800/50 rounded-xl border border-zinc-800"></div>
              ))}
            </div>
            <div className="h-64 bg-zinc-800/30 rounded-2xl border border-zinc-800"></div>
            <div className="h-64 bg-zinc-800/30 rounded-2xl border border-zinc-800"></div>
          </div>
        </>
      )}
    </div>
  );
}
