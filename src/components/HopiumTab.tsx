import React, { useState } from 'react';
import {
  Brain,
  Vote,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Award,
  DollarSign,
  PlusCircle,
  HelpCircle as QuestionIcon,
  CircleCheck,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { PredictionMarket, UserStats } from '../types';

interface HopiumTabProps {
  markets: PredictionMarket[];
  userStats: UserStats;
  onPlaceBet: (marketId: string, side: 'YES' | 'NO', amount: number) => void;
  onCreateMarket: (question: string, description: string, category: 'trading' | 'general' | 'arcade') => void;
  isGeneratingAi?: boolean;
}

export default function HopiumTab({
  markets,
  userStats,
  onPlaceBet,
  onCreateMarket,
  isGeneratingAi = false
}: HopiumTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'resolved'>('active');
  const [betAmounts, setBetAmounts] = useState<{ [marketId: string]: string }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Creation form state
  const [newQuestion, setNewQuestion] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<'trading' | 'general' | 'arcade'>('trading');
  const [aiPromptTopic, setAiPromptTopic] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const displayedMarkets = markets.filter((m) => (activeSubTab === 'resolved' ? m.resolved : !m.resolved));

  const handleBetSubmit = (marketId: string, side: 'YES' | 'NO') => {
    const amtStr = betAmounts[marketId];
    if (!amtStr) return;
    const amount = Number(amtStr);
    if (isNaN(amount) || amount <= 0 || amount > userStats.cash) {
      alert('Invalid bet amount or insufficient cash!');
      return;
    }

    onPlaceBet(marketId, side, amount);
    // Reset specific bet input amount
    setBetAmounts((prev) => ({ ...prev, [marketId]: '' }));
  };

  const handleCreateMarketLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    if (userStats.cash < 500) {
      alert('Creation fee is $500! You do not have enough cash.');
      return;
    }

    onCreateMarket(newQuestion.trim(), newDesc.trim() || 'Community prediction market.', newCategory);

    // Reset fields
    setNewQuestion('');
    setNewDesc('');
    setShowCreateModal(false);
  };

  // Optional AI integration using local simulation or backend fetch
  const handleGenerateMarketAi = async () => {
    if (!aiPromptTopic.trim()) return;
    setAiGenerating(true);

    try {
      // Fetch dynamic content from local backend api which uses Gemini,
      // fallback to humorous AI generation after 1.5 seconds.
      const response = await fetch('/api/generate-hopium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiPromptTopic })
      });

      if (response.ok) {
        const data = await response.json();
        onCreateMarket(data.question, data.description, 'general');
        setShowCreateModal(false);
        setAiPromptTopic('');
      } else {
        // Fallback local list of super hilarious generated predictions!
        const funnyFallbacks = [
          {
            q: `Will *${aiPromptTopic.toUpperCase()} hit a $5.0M market cap before dev crashes?`,
            d: `Experts predict ${aiPromptTopic} is either a direct moonshot or absolute vaporware.`
          },
          {
            q: `Will @zeke launch a direct copycat of ${aiPromptTopic} within 24 hours?`,
            d: `Imitation is the highest form of flattery, or in this case, direct theft.`
          },
          {
            q: `Will users buy a total of 100M tokens of ${aiPromptTopic} before paperhanding?`,
            d: `Panic selling might trigger as soon as the price dips 2%.`
          }
        ];
        const randomItem = funnyFallbacks[Math.floor(Math.random() * funnyFallbacks.length)];
        onCreateMarket(randomItem.q, randomItem.d, 'trading');
        setShowCreateModal(false);
        setAiPromptTopic('');
      }
    } catch (e) {
      // Local fallback anyway
      const fallbackQ = `Will ${aiPromptTopic.toUpperCase()} coin face a delist by next Monday?`;
      onCreateMarket(fallbackQ, 'Degen predictive analytics based on absolute rumors.', 'trading');
      setShowCreateModal(false);
      setAiPromptTopic('');
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in select-none">
      {/* Intro section */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-zinc-90 w-full">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-extrabold text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-1.5 leading-none">
            <Brain className="text-orange-500 w-4 h-4" /> Hopium Prediction Markets
          </h2>
          <span className="text-xs text-zinc-500 leading-none">
            Predict market trends, arcade actions, and droll community outcomes.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Active/Resolved Filter */}
          <div className="flex bg-zinc-950 p-1 rounded-xl self-start border border-zinc-900/60 font-mono text-[10px] font-bold uppercase shrink-0">
            <button
              onClick={() => setActiveSubTab('active')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeSubTab === 'active' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Active Markets
            </button>
            <button
              onClick={() => setActiveSubTab('resolved')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeSubTab === 'resolved' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Resolved History
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-650 hover:bg-orange-500 font-extrabold text-white font-mono text-xs py-2 px-3.5 rounded-xl transition-all shadow-md shadow-orange-950/20 flex items-center gap-1.5 shrink-0"
          >
            <PlusCircle className="w-4 h-4" /> Create Poll
          </button>
        </div>
      </div>

      {/* Prediction Markets Cards list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedMarkets.length === 0 ? (
          <div className="col-span-1 md:col-span-2 bg-zinc-900 p-12 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center">
            <QuestionIcon className="w-10 h-10 text-zinc-600 mb-2" />
            <p className="text-xs font-mono text-zinc-400">No prediction markets listed here.</p>
            <span className="text-[10px] text-zinc-500 font-mono mt-1">Create one using the button above!</span>
          </div>
        ) : (
          displayedMarkets.map((market) => {
            const totalPool = market.yesPool + market.noPool;
            const yesPct = totalPool > 0 ? (market.yesPool / totalPool) * 100 : 50;
            const noPct = totalPool > 0 ? (market.noPool / totalPool) * 100 : 50;

            return (
              <div
                key={market.id}
                className={`bg-zinc-900 border rounded-2xl p-5 flex flex-col justify-between transition-colors ${
                  market.resolved ? 'border-zinc-950 opacity-70 bg-zinc-950/20' : 'border-zinc-850'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] bg-zinc-950 uppercase border border-zinc-900 text-zinc-500 px-2 py-0.5 rounded-full font-bold font-mono tracking-widest">
                      {market.category} Market
                    </span>
                    {market.resolved ? (
                      <span className="text-[9px] bg-emerald-950 border border-emerald-900 text-emerald-400 px-2 py-0.5 rounded-full font-bold font-mono flex items-center gap-1 tracking-wider uppercase">
                        <CheckCircle2 className="w-3 h-3" /> Resolved
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-orange-500 font-bold font-mono uppercase tracking-wider flex items-center gap-1 bg-orange-950/20 px-1.5 border border-orange-900/30 rounded">
                        Active Bets
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-white text-[13.5px] leading-snug tracking-tight">
                    {market.question}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono italic">
                    {market.description}
                  </p>
                </div>

                {/* Pool Slider bar */}
                <div className="mt-4 flex flex-col gap-1.5">
                  <div className="flex justify-between font-mono text-[10px] font-bold select-none text-zinc-400">
                    <span className="text-emerald-400">YES ({yesPct.toFixed(0)}%)</span>
                    <span className="text-rose-450">NO ({noPct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-950 overflow-hidden flex">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${yesPct}%` }} />
                    <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${noPct}%` }} />
                  </div>
                  <div className="flex justify-between font-mono text-[9px] text-zinc-500">
                    <span>Pool: ${market.yesPool.toFixed(0)}</span>
                    <span>Pool: ${market.noPool.toFixed(0)}</span>
                  </div>
                </div>

                {/* Bet placing form / resolved summaries */}
                <div className="mt-4 border-t border-zinc-900/60 pt-4 flex flex-col gap-2">
                  {market.resolved ? (
                    <div className="flex items-center justify-between font-mono text-xs">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-500 uppercase">Correct Side</span>
                        <span className={`font-black uppercase text-[13px] ${
                          market.resolvedOutcome === 'YES' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {market.resolvedOutcome}
                        </span>
                      </div>
                      {market.userBetSide && (
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-zinc-500 uppercase">Your Position</span>
                          <span className={`font-bold uppercase text-[11px] ${
                            market.userBetSide === market.resolvedOutcome
                              ? 'text-emerald-400 bg-emerald-950/20 px-1 border border-emerald-900/40 rounded'
                              : 'text-zinc-500 line-through'
                          }`}>
                            {market.userBetSide} bet of ${market.userBetAmount.toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {market.userBetSide ? (
                        <div className="bg-zinc-950/60 p-2.5 border border-zinc-850 rounded-xl font-mono text-xs flex justify-between items-center">
                          <span className="text-zinc-500">My prediction ticket:</span>
                          <span className="font-extrabold text-zinc-300">
                            Placed <strong className={market.userBetSide === 'YES' ? 'text-emerald-400' : 'text-rose-400'}>{market.userBetSide}</strong> bet of ${market.userBetAmount.toFixed(0)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="relative font-mono">
                            <input
                              type="number"
                              min="1"
                              placeholder="Bet Cash amount..."
                              value={betAmounts[market.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBetAmounts((prev) => ({ ...prev, [market.id]: val }));
                              }}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold uppercase">
                              USD
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 font-mono text-[10px] font-bold uppercase">
                            <button
                              onClick={() => handleBetSubmit(market.id, 'YES')}
                              className="bg-emerald-950/30 border border-emerald-900/60 hover:bg-emerald-900 hover:text-white px-3 py-2 text-emerald-400 rounded-xl transition-all"
                            >
                              Predict YES
                            </button>
                            <button
                              onClick={() => handleBetSubmit(market.id, 'NO')}
                              className="bg-rose-950/20 border border-rose-900/60 hover:bg-rose-900 hover:text-white px-3 py-2 text-rose-400 rounded-xl transition-all"
                            >
                              Predict NO
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full relative select-none animate-slide-up">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200"
            >
              <QuestionIcon className="w-4 h-4 rotate-45" />
            </button>

            {/* Title tabs for local manual vs AI creation */}
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5 text-orange-400">
              <Brain className="w-4 h-4" /> Launch Prediction Market
            </h3>
            <p className="text-xs text-zinc-400 mb-4 font-medium">
              Create questions using standard fields, or brainstorm AI-powered predictions with Gemini! (Requires $500 creation fee).
            </p>

            <div className="flex flex-col gap-4">
              {/* Option A: AI generator Topic prompt */}
              <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-850 flex flex-col gap-2">
                <span className="text-[9.5px] uppercase font-mono tracking-widest font-extrabold text-cyan-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Brainstorm with Gemini
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter a topic (e.g. ATI coin price)..."
                    value={aiPromptTopic}
                    onChange={(e) => setAiPromptTopic(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    onClick={handleGenerateMarketAi}
                    type="button"
                    disabled={aiGenerating || !aiPromptTopic.trim()}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-650 cursor-pointer disabled:cursor-not-allowed font-bold text-white px-3 rounded-xl text-xs flex items-center gap-1 shrink-0"
                  >
                    {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ask AI'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 bg-zinc-90 text-zinc-600 font-mono text-[9px] uppercase font-bold">
                <div className="h-px bg-zinc-800 flex-1" />
                <span className="px-2">Or Design Manually</span>
                <div className="h-px bg-zinc-800 flex-1" />
              </div>

              {/* Option B: Standard Manual creation fields */}
              <form onSubmit={handleCreateMarketLocal} className="flex flex-col gap-3 font-mono text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                    Prediction Question
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Will Roadman Revival hit $0.15 before Friday?"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                    Additional Context / Desc
                  </label>
                  <textarea
                    placeholder="Describe how the market will resolve perfectly..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    className="bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="trading">Trading/Meme Coins</option>
                    <option value="arcade">Arcade Games</option>
                    <option value="general">General Happenings</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 bg-orange-600 hover:bg-orange-500 py-3 rounded-xl font-bold font-mono text-xs text-white shadow-xl shadow-orange-950/15"
                >
                  Pay $500 fee & Create
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
