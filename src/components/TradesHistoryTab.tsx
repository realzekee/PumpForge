import React, { useState, useEffect } from "react";
import { SkeletonLoader } from "./SkeletonLoader";
import { Activity, Clock } from "lucide-react";
import { databases } from "../appwrite";
import { Query } from "appwrite";
import { MemeCoin } from "../types";

export function TradesHistoryTab({
  coins,
  registeredUsers = []
}: {
  coins: MemeCoin[];
  registeredUsers?: any[];
}) {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      try {
        const res = await databases.listDocuments("pumpforge", "trades", [
          Query.equal("isSimulated", false),
          Query.orderDesc("$createdAt"),
          Query.limit(100)
        ]);
        if (active) {
           setTrades(res.documents);
        }
      } catch(e) {
        console.error("fetch history error", e);
      } finally {
         if (active) setLoading(false);
      }
    };
    fetchHistory();
    return () => { active = false; };
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <div className="p-3 glass-card rounded-2xl border border-white/10 shadow-sm">
          <Activity className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-mono tracking-widest text-zinc-100 uppercase">
            Global Trade History
          </h2>
          <p className="text-zinc-400 font-mono text-sm">
            Live execution log
          </p>
        </div>
      </div>

      <div className="glass-panel shadow-2xl rounded-3xl border border-white/10 p-6 flex flex-col gap-3">
        {loading ? (
             <SkeletonLoader type="list" />
        ) : trades.length > 0 ? (
             trades.map((trade, idx) => {
                 const coin = (coins || []).find(c => c && c.id === trade.coinId);
                 const amountUsd = typeof trade.amount === 'number' && !isNaN(trade.amount) ? trade.amount : Number(trade.amount) || 0;
                 const resolvedHandle = trade.userName || registeredUsers.find((u: any) => u.uid === trade.userId)?.handle || (trade.userId ? trade.userId.substring(0, 8) : "Trader");
                 const resolvedSymbol = trade.coinTicker || (coin ? coin.symbol : "COIN");
                 return (
                     <div key={trade.$id || `trade-${idx}`} className="flex justify-between items-center glass-card p-4 rounded-2xl border border-white/10 shadow-sm">
                         <div className="flex flex-col">
                             <div className="text-xs text-zinc-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {trade.$createdAt ? new Date(trade.$createdAt).toLocaleString() : "Just now"}</div>
                             <div className="text-zinc-200 font-mono text-sm mt-1 truncate max-w-[120px] font-bold">{resolvedHandle}</div>
                         </div>
                         <div className="flex items-center gap-4">
                             <span className="font-mono text-zinc-300 font-bold">{(amountUsd >= 1000 ? (amountUsd/1000).toFixed(2) + "K" : amountUsd.toFixed(2))} USD</span>
                             <span className="font-mono text-zinc-400 text-xs">*{resolvedSymbol}</span>
                             <span className={`font-mono text-xs px-2.5 py-1 uppercase rounded-full font-black border ${trade.type === 'BUY' ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40' : trade.type === 'TRANSFER' ? 'text-fuchsia-300 bg-fuchsia-500/20 border-fuchsia-500/40' : 'text-rose-300 bg-rose-500/20 border-rose-500/40'}`}>{trade.type || "TRADE"}</span>
                         </div>
                     </div>
                 );
             })
        ) : (
             <div className="text-zinc-400 font-mono text-center py-6">No trades found.</div>
        )}
      </div>
    </div>
  );
}
