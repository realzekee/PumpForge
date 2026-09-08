import React, { useState } from "react";
import { AlertTriangle, Send, X, ShieldAlert } from "lucide-react";
import { UserStats } from "../types";

interface BugReportModalProps {
  userStats: UserStats;
  currentUser: any;
  onClose: () => void;
  onSubmitBug: (
    title: string,
    description: string,
    category: string,
  ) => Promise<boolean>;
}

export default function BugReportModal({
  userStats,
  currentUser,
  onClose,
  onSubmitBug,
}: BugReportModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("UI/Layout");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const titleLimit = 80;
  const descLimit = 400;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!currentUser) {
      setErrorMsg("You must be signed in to submit a bug report.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setErrorMsg("Please enter both a title and a description.");
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onSubmitBug(title.trim(), description.trim(), category);
      if (ok) {
        setSuccess(true);
        setTitle("");
        setDescription("");
      } else {
        setErrorMsg("Failed to submit report. Please check connection.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong. Let zeke know!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="glass-modal p-6 rounded-3xl max-w-md w-full relative font-mono select-none animate-slide-up shadow-2xl border border-white/10">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 glass-card border border-emerald-500/40 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 animate-bounce shadow-lg">
              ✓
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Bug Report Submitted
            </h3>
            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              Thanks for the report! We have stored this report in a highly
              compressed format (less than 0.5KB) to protect database storage
              limits. No bloat!
            </p>
            <button
              onClick={onClose}
              className="w-full glass-card hover:bg-white/15 text-zinc-200 hover:text-white border border-white/10 py-3 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer font-bold"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3 mb-1 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 animate-pulse text-rose-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-rose-400 uppercase tracking-widest">
                  Submit Bug Report
                </span>
                <span className="text-[9px] text-zinc-400 leading-none">
                  Database optimized & bounded - 0.5KB max payload
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/15 border border-rose-500/30 rounded-2xl p-3.5 text-[11px] text-rose-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] text-zinc-300 font-bold">
                <label htmlFor="bug-title" className="uppercase tracking-wider">
                  Bug Title
                </label>
                <span
                  className={`font-mono text-[9px] ${title.length > titleLimit - 10 ? "text-rose-400" : "text-zinc-400"}`}
                >
                  {title.length}/{titleLimit}
                </span>
              </div>
              <input
                id="bug-title"
                type="text"
                autoComplete="off"
                placeholder="What broken interaction is occurring?"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, titleLimit))}
                maxLength={titleLimit}
                required
                className="w-full glass-input text-zinc-100 text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="bug-category"
                className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider"
              >
                Category
              </label>
              <select
                id="bug-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full glass-input text-zinc-100 text-xs rounded-xl px-3.5 py-2.5 outline-none cursor-pointer transition-all"
              >
                <option value="UI/Layout" className="bg-zinc-900 text-white">
                  UI/Layout (Styles, cards, flickering)
                </option>
                <option value="Trading" className="bg-zinc-900 text-white">
                  Trading System (Trades, prices, buy/sell)
                </option>
                <option value="Arcade" className="bg-zinc-900 text-white">
                  Arcade Room (Slots, mine games, play limits)
                </option>
                <option value="Leaderboard" className="bg-zinc-900 text-white">Leaderboard & User Stats</option>
                <option value="Achievements" className="bg-zinc-900 text-white">Achievements & Perks</option>
                <option value="Other" className="bg-zinc-900 text-white">Other Miscellaneous Bugs</option>
              </select>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] text-zinc-300 font-bold">
                <label
                  htmlFor="bug-description"
                  className="uppercase tracking-wider"
                >
                  Detailed Description
                </label>
                <span
                  className={`font-mono text-[9px] ${description.length > descLimit - 25 ? "text-rose-400" : "text-zinc-400"}`}
                >
                  {description.length}/{descLimit}
                </span>
              </div>
              <textarea
                id="bug-description"
                placeholder="Describe exact steps to reproduce..."
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, descLimit))
                }
                maxLength={descLimit}
                rows={4}
                required
                className="w-full glass-input text-zinc-100 text-xs rounded-xl px-3.5 py-2.5 outline-none resize-none transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-rose-500/80 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-rose-950/25 border border-rose-400/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSubmitting ? "Submitting..." : "Submit Bug Report"}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
