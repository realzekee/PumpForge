import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PumpForge ErrorBoundary Caught]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Error clearing cache:", e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#07070b] text-white flex flex-col items-center justify-center p-6 select-none font-mono">
          <div className="max-w-md w-full bg-zinc-900/80 border border-rose-500/30 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-lg animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">
              System Recovery Mode
            </h2>

            <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-sans">
              A numerical formatting or calculation glitch occurred in the active trading feed. You can restore instant synchronization below.
            </p>

            {this.state.error && (
              <div className="w-full bg-black/50 border border-white/5 rounded-xl p-3 mb-6 text-left overflow-x-auto max-h-28 text-[11px] text-rose-300/80 font-mono">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span>Reload App</span>
              </button>

              <button
                onClick={this.handleResetCache}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>Clear Cache & Fix</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
