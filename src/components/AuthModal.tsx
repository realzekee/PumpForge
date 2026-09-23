import React, { useState } from "react";
import {
  LogIn,
  Mail,
  User,
  Shield,
  HelpCircle,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { apiEmailLogin, apiQuickLogin } from "../api/gameClient";
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
  onSuccess,
  onOpenGuide,
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"email" | "google" | "quick">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setStatusMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    if (password && password.length < 6) {
      setStatusMessage({ type: "error", text: "Password should be at least 6 characters." });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    const toastId = toast.loading(isRegisterMode ? "Creating account..." : "Signing in with Email...");
    try {
      // 1. Try Appwrite Native Email/Password if available in current context
      if (password) {
        try {
          if (isRegisterMode) {
            const { ID } = await import("appwrite");
            await account.create(ID.unique(), cleanEmail, password, username.trim() || cleanEmail.split("@")[0]);
          }
          await account.createEmailPasswordSession(cleanEmail, password);
        } catch (appwriteErr: any) {
          console.warn("Appwrite native email session notice:", appwriteErr?.message || appwriteErr);
        }
      }

      // 2. Authoritative API / Session Verification
      const res = await apiEmailLogin({
        email: cleanEmail,
        password,
        name: username.trim() || cleanEmail.split("@")[0],
      });

      if (res && res.success && res.user) {
        toast.success(`Signed in as ${res.user.name || cleanEmail}`, { id: toastId });
        onSuccess(res.user, res.stats);
        onClose();
      } else {
        throw new Error("Could not complete email login.");
      }
    } catch (err: any) {
      const msg = formatErrorMessage(err, "Email sign-in failed.");
      setStatusMessage({ type: "error", text: msg });
      toast.error(msg, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = username.trim();
    if (!cleanName) {
      setStatusMessage({ type: "error", text: "Please choose a player username." });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    const toastId = toast.loading("Setting up player profile...");
    try {
      const res = await apiQuickLogin({
        username: cleanName,
        email: email.trim().toLowerCase(),
      });

      if (res && res.success && res.user) {
        toast.success(`Welcome to PumpForge, ${res.user.name}!`, { id: toastId });
        onSuccess(res.user, res.stats);
        onClose();
      } else {
        throw new Error("Failed to initialize player session.");
      }
    } catch (err: any) {
      const msg = formatErrorMessage(err, "Quick player login failed.");
      setStatusMessage({ type: "error", text: msg });
      toast.error(msg, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      toast.error(
        "Google OAuth cannot open inside an embedded preview iframe. Please sign in via Email or open the app directly in a full browser tab.",
        { duration: 7000 }
      );
      onOpenGuide();
      return;
    }

    setIsLoading(true);
    try {
      account.createOAuth2Session(
        "google" as any,
        window.location.origin,
        window.location.origin
      );
    } catch (err: any) {
      const msg = formatErrorMessage(err, "Google OAuth failed to start.");
      setStatusMessage({ type: "error", text: msg });
      toast.error(msg);
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      id="pumpforge-auth-modal"
    >
      <div className="glass-modal border border-white/15 bg-zinc-950/95 p-5 sm:p-6 rounded-2xl max-w-md w-full relative font-mono text-left select-none shadow-2xl shadow-rose-950/20 animate-slide-up overflow-hidden">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-400" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close modal"
          id="auth-modal-close-btn"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Sign In / Authentication</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </h3>
            <p className="text-[11px] text-zinc-400">
              {reason || "Unlock full trading, leaderboards, and persistent portfolio sync"}
            </p>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900/90 rounded-xl border border-white/10 mb-4 text-[10px] font-bold">
          <button
            onClick={() => { setActiveTab("email"); setStatusMessage(null); }}
            className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === "email"
                ? "bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-md font-black"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            id="tab-email-login"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>
          <button
            onClick={() => { setActiveTab("google"); setStatusMessage(null); }}
            className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === "google"
                ? "bg-zinc-800 text-white shadow-md font-black border border-white/20"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            id="tab-google-login"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Google</span>
          </button>
          <button
            onClick={() => { setActiveTab("quick"); setStatusMessage(null); }}
            className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === "quick"
                ? "bg-cyan-600 text-white shadow-md font-black"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            id="tab-quick-login"
          >
            <User className="w-3.5 h-3.5" />
            <span>Quick Play</span>
          </button>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`p-2.5 rounded-xl text-[11px] mb-3 flex items-start gap-2 border ${
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

        {/* TAB 1: EMAIL & PASSWORD */}
        {activeTab === "email" && (
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 font-mono"
                  id="auth-email-input"
                />
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Trader101"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 font-mono"
                    id="auth-register-name-input"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {isRegisterMode ? "Min 6 characters" : "Required for login"}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 font-mono pr-9"
                  id="auth-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-lg border border-white/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
              id="auth-submit-email-btn"
            >
              <LogIn className="w-3.5 h-3.5 text-white" />
              <span>{isLoading ? "Processing..." : isRegisterMode ? "Create Account & Sign In" : "Sign In with Email"}</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setStatusMessage(null);
                }}
                className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer transition-colors"
              >
                {isRegisterMode
                  ? "Already have an account? Sign in"
                  : "Need a new account? Register here"}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: GOOGLE OAUTH */}
        {activeTab === "google" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-300">
              <p className="text-[11px] leading-relaxed mb-1.5">
                Authenticates directly via your Google Account OAuth2.
              </p>
              <div className="text-[10px] text-zinc-400 leading-tight">
                Connects with Appwrite authentication for secure trading and profile sync.
              </div>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleAuth}
              className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-lg border border-white/40 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
              id="auth-submit-google-btn"
            >
              <LogIn className="w-4 h-4 text-zinc-950" />
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* TAB 3: QUICK PLAYER LOGIN */}
        {activeTab === "quick" && (
          <form onSubmit={handleQuickAuth} className="space-y-3">
            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-zinc-300">
              <p className="text-[11px] leading-relaxed">
                Choose any custom handle to jump right in. Your balance and trades are saved automatically!
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Your Username / Handle
              </label>
              <div className="relative">
                <span className="text-zinc-500 text-xs absolute left-3 top-2.5 font-bold">@</span>
                <input
                  type="text"
                  required
                  placeholder="crypto_whale"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-7 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
                  id="auth-quick-username-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-lg border border-cyan-400/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
              id="auth-submit-quick-btn"
            >
              <User className="w-3.5 h-3.5 text-white" />
              <span>{isLoading ? "Joining..." : "Start Playing as @" + (username.trim() || "Player")}</span>
            </button>
          </form>
        )}

        {/* Footer info link */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-500">
          <span>PumpForge v2.8 • Secure Session Hub</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenGuide();
            }}
            className="text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            <span>OAuth &amp; Appwrite Guide</span>
          </button>
        </div>
      </div>
    </div>
  );
}
