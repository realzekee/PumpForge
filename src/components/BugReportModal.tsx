import React, { useState } from 'react';
import { AlertTriangle, Send, X, ShieldAlert } from 'lucide-react';
import { UserStats } from '../types';

interface BugReportModalProps {
  userStats: UserStats;
  currentUser: any;
  onClose: () => void;
  onSubmitBug: (title: string, description: string, category: string) => Promise<boolean>;
}

export default function BugReportModal({ userStats, currentUser, onClose, onSubmitBug }: BugReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('UI/Layout');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const titleLimit = 80;
  const descLimit = 400;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentUser) {
      setErrorMsg('You must be signed in to submit a bug report.');
      return;
    }

    if (!title.trim() || !description.trim()) {
      setErrorMsg('Please enter both a title and a description.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onSubmitBug(title.trim(), description.trim(), category);
      if (ok) {
        setSuccess(true);
        setTitle('');
        setDescription('');
      } else {
        setErrorMsg('Failed to submit report. Please check connection.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong. Let zeke know!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full relative font-mono select-none animate-slide-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4 animate-bounce">
              ✓
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Bug Report Submitted
            </h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Thanks for the report! We have stored this report in a highly compressed format (less than 0.5KB) to protect database storage limits. No bloat!
            </p>
            <button
              onClick={onClose}
              className="w-full bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-850 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-3 mb-1 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 animate-pulse text-rose-450" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Submit Bug Report</span>
                <span className="text-[9px] text-zinc-500 leading-none">Database optimized & bounded - 0.5KB max payload</span>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-[11px] text-red-400 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                <label htmlFor="bug-title" className="uppercase tracking-wider">Bug Title</label>
                <span className={`font-mono text-[9px] ${title.length > titleLimit - 10 ? 'text-rose-400' : 'text-zinc-550'}`}>
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
                className="w-full bg-zinc-950 text-zinc-100 text-xs border border-zinc-850 focus:border-rose-500/50 rounded-xl px-3.5 py-3 outline-none transition-colors"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bug-category" className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Category</label>
              <select
                id="bug-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-950 text-zinc-100 text-xs border border-zinc-850 focus:border-rose-500/50 rounded-xl px-3.5 py-3 outline-none cursor-pointer transition-colors"
              >
                <option value="UI/Layout">UI/Layout (Styles, cards, flickering)</option>
                <option value="Trading">Trading System (Trades, prices, buy/sell)</option>
                <option value="Arcade">Arcade Room (Slots, mine games, play limits)</option>
                <option value="Leaderboard">Leaderboard & User Stats</option>
                <option value="Achievements">Achievements & Perks</option>
                <option value="Other">Other Miscellaneous Bugs</option>
              </select>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                <label htmlFor="bug-description" className="uppercase tracking-wider">Detailed Description</label>
                <span className={`font-mono text-[9px] ${description.length > descLimit - 25 ? 'text-rose-400' : 'text-zinc-550'}`}>
                  {description.length}/{descLimit}
                </span>
              </div>
              <textarea
                id="bug-description"
                placeholder="Describe exact steps to reproduce..."
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, descLimit))}
                maxLength={descLimit}
                rows={4}
                required
                className="w-full bg-zinc-950 text-zinc-100 text-xs border border-zinc-850 focus:border-rose-500/50 rounded-xl px-3.5 py-3 outline-none resize-none transition-colors"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-rose-650 hover:bg-rose-550 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest transition-colors shadow-lg shadow-rose-950/15 border border-rose-500 flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Bug Report'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
