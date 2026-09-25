import React, { useState } from "react";
import {
  Shield,
  HelpCircle,
  X,
  Sparkles,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { account } from "../appwrite";
import { formatErrorMessage } from "../utils/formatError";
import { toast } from "sonner";

interface AuthModalProps {
  isOpen: boolean;
  reason?: string;
  onClose: () => void;
  onSuccess: (user: any, stats: any) => void;
  onOpenGuide: () => void;
}

export function AuthModal({
  isOpen,
  reason,
  onClose,
  onOpenGuide,
}: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  if (!isOpen) return null;

  const isInsideIframe = typeof window !== "undefined" && window.self !== window.top;

  const handleGoogleAuth = async () => {
    if (isInsideIframe) {
      // In an iframe, standard OAuth redirect is blocked by sandbox headers
      toast.info("Opening app in a new window for secure Google Authentication...");
      window.open(window.location.href, "_blank");
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    const toastId = toast.loading("Connecting to Google OAuth...");

    try {
      const redirectUri = window.location.origin + window.location.pathname;
      try {
        await account.createOAuth2Token(
          "google" as any,
          redirectUri,
          redirectUri
        );
      } catch (tokenErr) {
        console.warn("createOAuth2Token fallback to createOAuth2Session:", tokenErr);
        account.createOAuth2Session(
          "google" as any,
          redirectUri,
          redirectUri
        );
      }
    } catch (err: any) {
      const msg = formatErrorMessage(err, "Google OAuth failed to start.");
      setStatusMessage({ type: "error", text: msg });
      toast.error(msg, { id: toastId });
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      id="pumpforge-auth-modal"
    >
      <div className="glass-modal border border-white/15 bg-zinc-950/95 p-6 sm:p-7 rounded-3xl max-w-md w-full relative font-mono text-left select-none shadow-2xl shadow-rose-950/30 animate-slide-up overflow-hidden">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-400" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close modal"
          id="auth-modal-close-btn"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner shrink-0">
            <Shield className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Google Sign In</span>
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {reason || "Sign in with Google to start playing PumpForge"}
            </p>
          </div>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl text-xs mb-4 flex items-start gap-2.5 border ${
              statusMessage.type === "error"
                ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
                : "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
            }`}
          >
            {statusMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            )}
            <span className="leading-tight">{statusMessage.text}</span>
          </div>
        )}

        {/* Main Google Action Card */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2.5">
            <div className="text-xs text-zinc-300 leading-relaxed font-sans">
              Connect your verified Google account to play, trade meme coins, enter prediction markets, and track your rank on the live global leaderboard.
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-zinc-400 font-mono">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Authoritative Balances</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Leaderboard Ranks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero Gas Trading</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Cloud Sync</span>
              </div>
            </div>
          </div>

          {/* Primary Google Button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleAuth}
            className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-black py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider shadow-xl border border-white/50 flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-98 disabled:opacity-50 group hover:shadow-white/10"
            id="auth-submit-google-btn"
          >
            {/* Google Multicolored G SVG Logo */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isLoading ? "Signing in..." : "Continue with Google"}</span>
          </button>

          {isInsideIframe && (
            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-[11px] leading-tight flex items-start gap-2">
              <ExternalLink className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Running in an embedded preview. Click above to open in a full window where Google authentication will complete.
              </span>
            </div>
          )}
        </div>

        {/* Footer info link */}
        <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-zinc-400" /> Secure Appwrite OAuth
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenGuide();
            }}
            className="text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            <span>Connection Guide</span>
          </button>
        </div>
      </div>
    </div>
  );
}
