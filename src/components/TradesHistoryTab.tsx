import React, { useState, useEffect } from "react";
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
      <div className="flex items-center gap-3 border-b border-zinc-900 pb-4">
        <div className="p-3 bg-zinc-900 rounded-xl">
          <Activity className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-mono tracking-widest text-zinc-100 uppercase">
            Global Trade History
          </h2>
          <p className="text-zinc-500 font-mono text-sm">
            Live execution log
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 shadow-xl rounded-2xl border border-zinc-900/50 p-6 flex flex-col gap-3">
        {loading ? (
             <div className="text-zinc-500 font-mono text-center py-6">Loading global trades...</div>
        ) : trades.length > 0 ? (
             trades.map(trade => {
                 const coin = coins.find(c => c.id === trade.coinId);
                 const amountUsd = coin ? trade.amount * coin.price : trade.amount;
                 const resolvedHandle = registeredUsers.find((u: any) => u.uid === trade.userId)?.handle || trade.userId.substring(0, 8);
                 return (
                     <div key={trade.$id} className="flex justify-between items-center bg-zinc-950/50 p-3 rounded-lg border border-zinc-900">
                         <div className="flex flex-col">
                             <div className="text-xs text-zinc-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {new Date(trade.$createdAt).toLocaleString()}</div>
                             <div className="text-zinc-300 font-mono text-sm mt-1 truncate max-w-[120px]">{resolvedHandle}</div>
                         </div>
                         <div className="flex items-center gap-4">
                             <span className="font-mono text-zinc-400">{(amountUsd >= 1000 ? (amountUsd/1000).toFixed(2) + "K" : amountUsd.toFixed(2))} USD</span>
                             <span className={`font-mono text-xs px-2 py-1 uppercase rounded font-bold ${trade.type === 'BUY' ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-450 bg-rose-950/40'}`}>{trade.type}</span>
                         </div>
                     </div>
                 )
             })
        ) : (
             <div className="text-zinc-500 font-mono text-center py-6">No trades found.</div>
        )}
      </div>
    </div>
  );
}
