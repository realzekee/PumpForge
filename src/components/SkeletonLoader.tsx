import React from "react";

export function SkeletonLoader({ type }: { type: "list" | "portfolio" | "chart" | "dashboard" }) {
  if (type === "list") {
    return (
      <div className="flex flex-col gap-3 w-full animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex justify-between items-center bg-zinc-950/50 p-3 rounded-lg border border-zinc-900">
            <div className="flex flex-col gap-2">
              <div className="h-4 w-28 bg-zinc-800/60 rounded"></div>
              <div className="h-3 w-20 bg-zinc-800/40 rounded"></div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="h-4 w-16 bg-zinc-800/60 rounded"></div>
              <div className="h-3 w-12 bg-zinc-800/60 rounded"></div>
              <div className="h-6 w-14 bg-zinc-800/80 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "portfolio") {
    return (
      <div className="animate-pulse flex flex-col gap-6 p-4 w-full h-full">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="h-4 w-24 bg-zinc-800 rounded"></div>
            <div className="h-8 w-48 bg-zinc-800 rounded"></div>
            <div className="h-4 w-32 bg-zinc-800 rounded"></div>
          </div>
          <div className="h-12 w-12 bg-zinc-800 rounded-xl"></div>
        </div>

        <div className="h-48 w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 flex flex-col justify-end">
           <div className="flex gap-2 items-end h-32">
             {[...Array(12)].map((_, i) => (
                <div key={i} className="flex-1 bg-zinc-800 rounded-t" style={{ height: `${20 + (i * 7) % 80}%` }}></div>
             ))}
           </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="h-4 w-32 bg-zinc-800 rounded mb-2"></div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 w-full bg-zinc-900/40 rounded-xl border border-zinc-800"></div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "dashboard") {
    return (
      <div className="animate-pulse flex flex-col gap-6 p-4 w-full h-full">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-zinc-800 rounded-lg"></div>
          <div className="h-6 w-48 bg-zinc-800 rounded"></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-900/60 rounded-xl border border-zinc-800"></div>
          ))}
        </div>
        <div className="h-64 mt-4 w-full bg-zinc-900/40 rounded-2xl border border-zinc-800"></div>
      </div>
    );
  }

  // default / chart fallback
  return (
    <div className="w-full h-[400px] bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 flex flex-col justify-end gap-2 animate-pulse">
       <div className="flex justify-between w-full opacity-50">
          <div className="h-6 w-32 bg-zinc-800 rounded"></div>
          <div className="h-6 w-24 bg-zinc-800 rounded"></div>
       </div>
       <div className="w-full flex-1 flex items-end gap-2 mt-4">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="flex-1 bg-zinc-800 rounded-t" style={{ height: `${20 + (i * 7) % 60}%` }}></div>
          ))}
       </div>
    </div>
  );
}
