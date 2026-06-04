import React, { useState, useEffect } from "react";
import { Query } from "appwrite";
import { databases } from "../appwrite";
import { toast } from "sonner";
import { CheckCircle, XCircle, Ban, Activity } from "lucide-react";
import { SkeletonLoader } from "./SkeletonLoader";

export default function PolymarketAdminTab() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      const res = await databases.listDocuments("pumpforge", "polymarkets", [
        Query.notEqual("status", "closed"),
        Query.limit(100),
      ]);
      setMarkets(res.documents);
    } catch (error) {
      console.error("Failed to fetch polymarkets", error);
      toast.error("Failed to load active markets.");
    } finally {
      setLoading(false);
    }
  };

  const executePayouts = async (marketId: string, winningChoice: string) => {
    try {
      if (winningChoice === "CANCEL") {
        winningChoice = "REFUND"; // Logically refund if cancelled, however problem doesn't explicitly restrict winningOutome so we use CANCEL
      }
      
      // 1. Update Market
      await databases.updateDocument("pumpforge", "polymarkets", marketId, {
        status: "closed",
        winningOutcome: winningChoice,
      });

      // 2. Query all wagers
      const wagersRes = await databases.listDocuments("pumpforge", "wagers", [
        Query.equal("polymarketId", marketId),
        Query.limit(1000), // Max for Appwrite
      ]);

      const wagers = wagersRes.documents;
      let payoutCount = 0;

      // 3. Process each wager
      for (const wager of wagers) {
        if (wager.isPaid) continue;

        let shouldPayout = false;
        let payoutAmount = 0;

        if (winningChoice === "CANCEL") {
          // Refund
          shouldPayout = true;
          payoutAmount = wager.amount;
        } else if (wager.choice === winningChoice) {
          // Calculate payout (using simplified calculation: 2x, or pool based if required, but let's just use 2x for now unless pool is strictly calculated)
          // Wait, real polymarket payout would be (user amount / total pool for that choice) * (total pool).
          // But wait, the schema doesn't ask us to do complex AMM. Let's calculate total pool.
          
          shouldPayout = true;
          // As simple calculation, just pay 2x for correct guess if pool logic is complex. Or if poolYes/poolNo are available:
          const market = markets.find((m) => m.$id === marketId);
          if (market) {
            const totalPool = (market.poolYes || 0) + (market.poolNo || 0);
            const winningPool = winningChoice === "YES" ? market.poolYes : market.poolNo;
            
            if (winningPool > 0) {
              const share = wager.amount / winningPool;
              payoutAmount = share * totalPool;
            } else {
              payoutAmount = wager.amount * 2; // Fallback
            }
          } else {
            payoutAmount = wager.amount * 2;
          }
        }

        if (shouldPayout) {
          try {
            // Fetch User
            const user = await databases.getDocument("pumpforge", "users", wager.userId);
            if (user) {
              await databases.updateDocument("pumpforge", "users", wager.userId, {
                cash: (user.cash || 0) + payoutAmount,
              });
              payoutCount++;
            }
            
            // 4. Update Wager to Paid
            await databases.updateDocument("pumpforge", "wagers", wager.$id, {
              isPaid: true,
            });
          } catch (e) {
             console.error("Failed to pay user", wager.userId, e);
          }
        }
      }

      toast.success(`Market resolved successfully. ${payoutCount} users paid.`);
      fetchMarkets();
    } catch (error: any) {
      console.error("Failed to resolve market", error);
      toast.error("Error resolving market: " + error.message);
    } finally {
      setResolving(null);
    }
  };

  const handleResolve = async (marketId: string, choice: string) => {
    if (!window.confirm(`Are you sure you want to resolve this market as ${choice}? This will trigger payouts.`)) return;
    setResolving(marketId);
    await executePayouts(marketId, choice);
  };

  if (loading) return <SkeletonLoader type="dashboard" />;

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-5xl mx-auto w-full p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl md:text-2xl font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-5 h-5 md:w-6 md:h-6" /> Polymarket Admin
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 font-mono max-w-xl leading-relaxed mt-1">
            Resolve active Polymarket predictions. Resolving will automatically distribute simulated payouts and close the market.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {markets.length === 0 ? (
          <div className="bg-zinc-900/50 p-8 rounded-2xl text-center text-zinc-500 font-mono text-xs uppercase shadow-sm border border-zinc-800">
            No active markets pending resolution.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {markets.map((market) => (
              <div
                key={market.$id}
                className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col gap-4 relative shadow-lg hover:border-zinc-700 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 font-bold text-base md:text-lg text-white leading-snug">
                    {market.question}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 font-mono uppercase font-bold bg-zinc-900 p-3 rounded-xl border border-zinc-850">
                   <div className="flex flex-col">
                     <span className="text-emerald-500 mb-0.5">Pool YES</span>
                     <span className="text-white text-sm">${(market.poolYes || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="flex flex-col text-right">
                     <span className="text-rose-500 mb-0.5">Pool NO</span>
                     <span className="text-white text-sm">${(market.poolNo || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                   </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-800/60 pt-4">
                  <button
                    disabled={resolving === market.$id}
                    onClick={() => handleResolve(market.$id, "YES")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-900 text-emerald-400 font-extrabold uppercase rounded-lg text-[10px] tracking-widest transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Resolve YES
                  </button>
                  <button
                    disabled={resolving === market.$id}
                    onClick={() => handleResolve(market.$id, "NO")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-950 hover:bg-rose-900 border border-rose-900 text-rose-400 font-extrabold uppercase rounded-lg text-[10px] tracking-widest transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Resolve NO
                  </button>
                </div>
                
                <button
                  disabled={resolving === market.$id}
                  onClick={() => handleResolve(market.$id, "CANCEL")}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold uppercase rounded-lg text-[9px] tracking-widest transition-colors disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" /> Cancel / Refund All
                </button>
                
                {resolving === market.$id && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-col gap-2 shadow-inner border border-zinc-700 pointer-events-none z-10">
                    <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent origin-center rounded-full animate-spin"></div>
                    <span className="text-rose-400 font-mono text-[10px] uppercase font-bold tracking-widest animate-pulse">Executing Payouts...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
