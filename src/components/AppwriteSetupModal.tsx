import React, { useState } from "react";
import { X, Copy, Check, ExternalLink, Globe, AlertTriangle } from "lucide-react";

interface AppwriteSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppwriteSetupModal({
  isOpen,
  onClose,
}: AppwriteSetupModalProps) {
  const [copiedHost, setCopiedHost] = useState(false);
  const [copiedProject, setCopiedProject] = useState(false);

  if (!isOpen) return null;

  const currentHostname = typeof window !== "undefined" ? window.location.hostname : "";
  const projectId = "6a1416eb001f50cdb902";

  const handleCopyHost = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2000);
    }
  };

  const handleCopyProject = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(projectId);
      setCopiedProject(true);
      setTimeout(() => setCopiedProject(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-rose-950/30 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Appwrite & OAuth Setup Guide
              </h2>
              <p className="text-[11px] text-zinc-400">
                Fix for &quot;Register your new client as a Web platform&quot;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Root Cause Explanation */}
        <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
            <AlertTriangle className="w-4 h-4" />
            <span>Why Appwrite Shows This Error</span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
            Appwrite Cloud blocks OAuth redirects from unknown domains for security. Because this preview URL is dynamic, you must register it as a <strong>Web Platform</strong> in your Appwrite Console.
          </p>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            How to configure Appwrite Console (5 Steps):
          </h3>

          {/* Hostname Copy Box */}
          <div className="bg-black/50 border border-zinc-800 rounded-xl p-3 flex flex-col gap-1.5">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">
              1. Your Current Domain Hostname:
            </span>
            <div className="flex items-center justify-between gap-2 bg-zinc-900 border border-zinc-700/60 px-3 py-2 rounded-lg text-xs text-rose-300 font-mono">
              <span className="truncate">{currentHostname}</span>
              <button
                onClick={handleCopyHost}
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors shrink-0"
              >
                {copiedHost ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Project ID Copy Box */}
          <div className="bg-black/50 border border-zinc-800 rounded-xl p-3 flex flex-col gap-1.5">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">
              2. Appwrite Project ID:
            </span>
            <div className="flex items-center justify-between gap-2 bg-zinc-900 border border-zinc-700/60 px-3 py-2 rounded-lg text-xs text-zinc-300 font-mono">
              <span className="truncate">{projectId}</span>
              <button
                onClick={handleCopyProject}
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors shrink-0"
              >
                {copiedProject ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside font-sans leading-relaxed">
            <li>
              Go to{" "}
              <a
                href="https://cloud.appwrite.io"
                target="_blank"
                rel="noreferrer"
                className="text-rose-400 underline inline-flex items-center gap-1 hover:text-rose-300"
              >
                cloud.appwrite.io <ExternalLink className="w-3 h-3 inline" />
              </a>{" "}
              and open project <strong>{projectId}</strong>.
            </li>
            <li>
              Under <strong>Overview</strong>, scroll down to <strong>Platforms</strong> and click <strong>Add Platform &gt; Web App</strong>.
            </li>
            <li>
              Enter Name (e.g. <code>PumpForge Dev</code>) and paste the <strong>Hostname</strong> copied above.
            </li>
            <li>
              Under <strong>Auth &gt; Settings &gt; OAuth2 Providers</strong>, ensure <strong>Google</strong> is toggled on with your Google Client ID &amp; Secret.
            </li>
            <li>
              <strong>Important:</strong> Google OAuth will NOT open inside an iframe! Always open the app in a <strong>New Tab</strong> before signing in with Google.
            </li>
          </ol>
        </div>

        {/* Close button */}
        <div className="pt-2 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
