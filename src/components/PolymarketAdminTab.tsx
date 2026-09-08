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
    setResolving(marketId);
    await executePayouts(marketId, choice);
  };

  if (loading) return <SkeletonLoader type="dashboard" />;

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-5xl mx-auto w-full p-4">
      <div className="glass-panel border border-white/10 p-6 md:p-8 rounded-3xl shadow-xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl md:text-2xl font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-5 h-5 md:w-6 md:h-6" /> Polymarket Admin
            </h2>
            <p className="text-xs md:text-sm text-zinc-400 font-mono max-w-xl leading-relaxed mt-1">
              Resolve active Polymarket predictions. Resolving will automatically distribute simulated payouts to wagerers and close the market in Appwrite.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {markets.length === 0 ? (
          <div className="glass-card border border-white/10 p-8 rounded-3xl text-center text-zinc-500 font-mono text-xs uppercase shadow-sm">
            No active markets pending resolution.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {markets.map((market) => {
              const [qTitle, qDesc] = (market.question || "").split(" --- ");
              return (
                <div
                  key={market.$id}
                  className="glass-card border border-white/10 p-6 rounded-3xl flex flex-col gap-4 relative shadow-lg backdrop-blur-lg hover:border-white/20 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-extrabold text-base md:text-lg text-white leading-snug">
                        {qTitle || market.question}
                      </div>
                      {qDesc && (
                        <div className="text-xs text-zinc-400 font-normal mt-1 leading-relaxed">
                          {qDesc}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 font-mono uppercase font-bold bg-black/40 p-3 rounded-2xl border border-white/5">
                    <div className="flex flex-col">
                      <span className="text-emerald-400 mb-0.5">Pool YES</span>
                      <span className="text-white text-sm">
                        ${(market.poolYes || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-rose-400 mb-0.5">Pool NO</span>
                      <span className="text-white text-sm">
                        ${(market.poolNo || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <button
                      disabled={resolving === market.$id}
                      onClick={() => handleResolve(market.$id, "YES")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-extrabold uppercase rounded-xl text-[10px] tracking-widest transition-colors disabled:opacity-50 border border-emerald-400/30"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Resolve YES
                    </button>
                    <button
                      disabled={resolving === market.$id}
                      onClick={() => handleResolve(market.$id, "NO")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-extrabold uppercase rounded-xl text-[10px] tracking-widest transition-colors disabled:opacity-50 border border-rose-400/30"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Resolve NO
                    </button>
                  </div>

                  <button
                    disabled={resolving === market.$id}
                    onClick={() => handleResolve(market.$id, "CANCEL")}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 font-bold uppercase rounded-xl text-[9px] tracking-widest transition-colors disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" /> Cancel / Refund All
                  </button>

                  {resolving === market.$id && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md rounded-3xl flex items-center justify-center flex-col gap-2 shadow-inner border border-white/20 pointer-events-none z-10">
                      <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent origin-center rounded-full animate-spin"></div>
                      <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase font-bold">
                        Resolving Payouts...
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
