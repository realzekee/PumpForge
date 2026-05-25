import React, { useState } from 'react';
import { Settings, Moon, Bell, Shield, Key, Eye } from 'lucide-react';
import { UserStats } from '../types';

interface SettingsTabProps {
  userStats: UserStats;
  onUpdateStats?: (updater: (stats: UserStats) => void) => void;
  currentUserEmail?: string | null;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ userStats, onUpdateStats, currentUserEmail }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [resetClicked, setResetClicked] = useState(false);
  const [tempUsername, setTempUsername] = useState(userStats.username);
  const [tempHandle, setTempHandle] = useState(userStats.handle);

  const isStaff = userStats.title.toLowerCase() === 'owner' || userStats.title.toLowerCase() === 'admin';
  const isOwnerEmail = currentUserEmail === 'realzekeee@gmail.com' || currentUserEmail === 'realzekee@gmail.com';
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
    if (!cleanHandle.startsWith('@')) {
      cleanHandle = '@' + cleanHandle;
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/20 blur-3xl rounded-full transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-300">
          <Moon className="w-5 h-5 text-amber-500" />
          General Preferences
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                <Bell className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <div className="font-semibold text-sm">Push Notifications</div>
                <div className="text-xs text-zinc-500 mt-0.5">Alerts for market orders and achievements</div>
              </div>
            </div>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-zinc-800 border-zinc-700'} border`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${notificationsEnabled ? 'left-7 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'left-1 bg-zinc-500'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                <span className="text-lg">🔊</span>
              </div>
              <div>
                <div className="font-semibold text-sm">Arcade Sound Effects</div>
                <div className="text-xs text-zinc-500 mt-0.5">Play sounds during trades and cases</div>
              </div>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${soundEnabled ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-zinc-800 border-zinc-700'} border`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${soundEnabled ? 'left-7 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'left-1 bg-zinc-500'}`}></div>
            </button>
          </div>
        </div>

        {/* Profile Options and restrictions */}
        <div className="border-t border-zinc-800/80 mt-6 pt-6">
          <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-zinc-300">
            <span>👤</span> Profile Options
          </h3>
          <div className="space-y-4">
            {/* Display Name - Editable for all */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
              <div>
                <div className="font-semibold text-sm">Change Display Name</div>
                <div className="text-xs text-zinc-500 mt-0.5">Customize your public nickname</div>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <input
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 w-40 font-bold"
                  placeholder="Enter display name"
                />
                <button
                  onClick={handleSaveUsername}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-400/20 rounded-lg text-xs font-bold transition-colors shrink-0"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Username Handle - Prohibited for all except admins/owners/realzekeee */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
              <div>
                <div className="font-semibold text-sm">Arena Username / Handle</div>
                <div className="text-xs text-zinc-500 mt-0.5">Your unique account identifier: <span className="text-orange-400 font-bold">{userStats.handle}</span></div>
              </div>
              {isUsernameChangeAllowed ? (
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <input
                    type="text"
                    value={tempHandle}
                    onChange={(e) => setTempHandle(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 w-40 font-bold"
                    placeholder="Enter handle"
                  />
                  <button
                    onClick={handleSaveHandle}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-400/20 rounded-lg text-xs font-bold transition-colors shrink-0"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg text-left">
                  🔒 Changing username is strictly prohibited.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account & Security Card (div:nth-of-type(3)) - Hidden for non-staff */}
      {isStaff && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden mt-2">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-300">
            <Shield className="w-5 h-5 text-rose-500" />
            Account & Security
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                  <Key className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Sandbox API Key</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {showKey ? <span className="text-cyan-400">rq_live_58z4z390x81</span> : 'View your developer integration token'}
                  </div>
                  {currentUserEmail && (
                    <div className="text-[10px] text-zinc-500 mt-2 font-mono flex items-center gap-2">
                       Account connected to {currentUserEmail}
                       {isOwnerEmail && <span className="bg-red-950/60 border border-red-900/50 text-red-500 px-1.5 py-0.5 rounded uppercase font-bold text-[9px] tracking-wider">Owner</span>}
                    </div>
                  )}
                </div>
              </div>
              <button 
                className="px-4 py-2 border border-zinc-700 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-zinc-300 hover:text-cyan-400 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
                onClick={() => setShowKey(!showKey)}
              >
                <Eye className="w-3.5 h-3.5" />
                {showKey ? 'Hide' : 'Reveal'}
              </button>
            </div>
            
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 mt-4">
              <h4 className="text-rose-400 font-bold text-sm mb-1">Danger Zone</h4>
              <p className="text-xs text-zinc-400 mb-4">Resetting your account will wipe all holdings, prestige, and stats permanently. This cannot be undone.</p>
              {resetClicked ? (
                <p className="text-xs font-bold text-rose-500 animate-pulse">To reset your account, please clear your browser LocalStorage and re-login.</p>
              ) : (
                <button 
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors"
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
