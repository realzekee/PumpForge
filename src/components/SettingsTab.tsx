import React, { useState } from "react";
import { Settings, Moon, Bell, Shield, Key, Eye } from "lucide-react";
import { UserStats } from "../types";

interface SettingsTabProps {
  userStats: UserStats;
  onUpdateStats?: (updater: (stats: UserStats) => void) => void;
  currentUserEmail?: string | null;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  userStats,
  onUpdateStats,
  currentUserEmail,
}) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [resetClicked, setResetClicked] = useState(false);
  const [tempUsername, setTempUsername] = useState(userStats.username);
  const [tempHandle, setTempHandle] = useState(userStats.handle);

  const isStaff =
    userStats.title.toLowerCase() === "owner" ||
    userStats.title.toLowerCase() === "admin";
  const isOwnerEmail =
    currentUserEmail === "realzekeee@gmail.com" ||
    currentUserEmail === "realzekee@gmail.com";
  const isUsernameChangeAllowed = isOwnerEmail || isStaff;

  const handleSaveUsername = () => {
    if (!tempUsername.trim()) return;
    if (onUpdateStats) {
      onUpdateStats((stats) => {
        stats.username = tempUsername.trim();
      });
      alert("Display name updated successfully!");
    }
  };

  const handleSaveHandle = () => {
    let cleanHandle = tempHandle.trim();
    if (!cleanHandle) return;
    if (!cleanHandle.startsWith("@")) {
      cleanHandle = "@" + cleanHandle;
    }
    if (onUpdateStats) {
      onUpdateStats((stats) => {
        stats.handle = cleanHandle;
      });
      alert("Arena username (handle) updated successfully!");
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-fade-in text-zinc-100 font-mono">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-extrabold flex items-center gap-2">
          <Settings className="w-6 h-6 text-zinc-400" />
          Settings
        </h2>
      </div>

      {/* General Preferences Card (div:nth-of-type(2)) */}
      <div className="glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 blur-3xl rounded-full transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-200">
          <Moon className="w-5 h-5 text-amber-400" />
          General Preferences
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 glass-card rounded-2xl border border-white/10 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 glass-card rounded-xl flex items-center justify-center border border-white/10">
                <Bell className="w-5 h-5 text-zinc-300" />
              </div>
              <div>
                <div className="font-semibold text-sm text-zinc-200">Push Notifications</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Alerts for market orders and account updates
                </div>
              </div>
            </div>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${notificationsEnabled ? "bg-emerald-500/20 border-emerald-500/50" : "bg-white/5 border-white/10"} border cursor-pointer`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${notificationsEnabled ? "left-7 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "left-1 bg-zinc-500"}`}
              ></div>
            </button>
          </div>

          <div className="flex items-center justify-between p-4 glass-card rounded-2xl border border-white/10 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 glass-card rounded-xl flex items-center justify-center border border-white/10">
                <span className="text-lg">🔊</span>
              </div>
              <div>
                <div className="font-semibold text-sm text-zinc-200">
                  Arcade Sound Effects
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Play sounds during trades and cases
                </div>
              </div>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${soundEnabled ? "bg-emerald-500/20 border-emerald-500/50" : "bg-white/5 border-white/10"} border cursor-pointer`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${soundEnabled ? "left-7 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "left-1 bg-zinc-500"}`}
              ></div>
            </button>
          </div>
        </div>

        {/* Profile Options and restrictions */}
        <div className="border-t border-white/10 mt-6 pt-6">
          <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-zinc-200">
            <span>👤</span> Profile Options
          </h3>
          <div className="space-y-4">
            {/* Display Name - Editable for all */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-card rounded-2xl border border-white/10 shadow-sm">
              <div>
                <div className="font-semibold text-sm text-zinc-200">Change Display Name</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Customize your public nickname
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <input
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  className="glass-input rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 w-40 font-bold"
                  placeholder="Enter display name"
                />
                <button
                  onClick={handleSaveUsername}
                  className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Username Handle - Prohibited for all except admins/owners/realzekeee */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-card rounded-2xl border border-white/10 shadow-sm">
              <div>
                <div className="font-semibold text-sm text-zinc-200">
                  Arena Username / Handle
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Your unique account identifier:{" "}
                  <span className="text-rose-400 font-bold">
                    {userStats.handle}
                  </span>
                </div>
              </div>
              {isUsernameChangeAllowed ? (
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <input
                    type="text"
                    value={tempHandle}
                    onChange={(e) => setTempHandle(e.target.value)}
                    className="glass-input rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 w-40 font-bold"
                    placeholder="Enter handle"
                  />
                  <button
                    onClick={handleSaveHandle}
                    className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl text-left">
                  🔒 Changing username is strictly prohibited.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account & Security Card (div:nth-of-type(3)) - Hidden for non-staff */}
      {isStaff && (
        <div className="glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden mt-2">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-200">
            <Shield className="w-5 h-5 text-rose-400" />
            Account & Security
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 glass-card rounded-2xl border border-white/10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 glass-card rounded-xl flex items-center justify-center border border-white/10">
                  <Key className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-zinc-200">Sandbox API Key</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {showKey ? (
                      <span className="text-cyan-400">rq_live_58z4z390x81</span>
                    ) : (
                      "View your developer integration token"
                    )}
                  </div>
                  {currentUserEmail && (
                    <div className="text-[10px] text-zinc-400 mt-2 font-mono flex items-center gap-2">
                      Account connected to {currentUserEmail}
                      {isOwnerEmail && (
                        <span className="bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full uppercase font-bold text-[9px] tracking-wider">
                          Owner
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                className="px-4 py-2 glass-pill hover:bg-white/15 text-zinc-200 hover:text-cyan-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
                onClick={() => setShowKey(!showKey)}
              >
                <Eye className="w-3.5 h-3.5" />
                {showKey ? "Hide" : "Reveal"}
              </button>
            </div>

            <div className="glass-card border border-rose-500/30 rounded-2xl p-5 mt-4">
              <h4 className="text-rose-400 font-bold text-sm mb-1">
                Danger Zone
              </h4>
              <p className="text-xs text-zinc-300 mb-4">
                Resetting your account will wipe all holdings, prestige, and
                stats permanently. This cannot be undone.
              </p>
              {resetClicked ? (
                <p className="text-xs font-bold text-rose-400 animate-pulse">
                  To reset your account, please clear your browser LocalStorage
                  and re-login.
                </p>
              ) : (
                <button
                  className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  onClick={() => setResetClicked(true)}
                >
                  Reset Sandbox Progress
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
