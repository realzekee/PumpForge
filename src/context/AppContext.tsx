import React, { createContext, useContext, useState, useEffect } from "react";
import { apiGetSettings } from "../api/gameClient";

export type ArcadeRigMode = "fair" | "win" | "lose";

interface AdminSettings {
  isCasinoRigged: boolean;
  arcadeRigMode: ArcadeRigMode;
  rainbowCosmetics: boolean;
  customAdminBadge: string;
}

interface AppContextType {
  currentUser: any;
  setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
  userStats: any;
  setUserStats: React.Dispatch<React.SetStateAction<any>>;
  cash: number;
  setCash: React.Dispatch<React.SetStateAction<number>>;
  gems: number;
  setGems: React.Dispatch<React.SetStateAction<number>>;
  prestigeLevel: number;
  setPrestigeLevel: React.Dispatch<React.SetStateAction<number>>;
  userId: string | null;
  setUserId: React.Dispatch<React.SetStateAction<string | null>>;
  adminSettings: AdminSettings;
  setAdminSettings: React.Dispatch<React.SetStateAction<AdminSettings>>;
}

const DEFAULT_GUEST_STATS = {
  username: "Guest Player",
  handle: "@guest_degen",
  title: "Member",
  isPremium: false,
  nameColor: "text-zinc-300 font-bold",
  cash: 5000.0,
  gems: 50,
  prestigeLevel: 0,
  totalProfit: 0,
  coinsCreatedCount: 0,
  tradesCount: 0,
  lastDailyRewardClaim: null,
  email: "",
  createdAt: "2026-05-24T06:40:00Z",
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("cached_appwrite_user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [userStats, setUserStats] = useState<any>(() => {
    try {
      const cachedStats = localStorage.getItem("cached_appwrite_stats");
      if (cachedStats) {
        const parsed = JSON.parse(cachedStats);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch {}
    return { ...DEFAULT_GUEST_STATS };
  });

  const [cash, setCash] = useState<number>(() => Number(userStats?.cash ?? 5000));
  const [gems, setGems] = useState<number>(() => Number(userStats?.gems ?? 50));
  const [prestigeLevel, setPrestigeLevel] = useState<number>(() => Number(userStats?.prestigeLevel ?? 0));
  const [userId, setUserId] = useState<string | null>(() => {
    return currentUser?.$id || currentUser?.uid || currentUser?.userId || null;
  });

  const getSavedRigMode = (): ArcadeRigMode => {
    try {
      const saved = localStorage.getItem("pf_arcade_rig_mode");
      if (saved === "win" || saved === "lose" || saved === "fair") return saved;
    } catch (e) {}
    return "fair";
  };

  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    isCasinoRigged: false,
    arcadeRigMode: getSavedRigMode(),
    rainbowCosmetics: false,
    customAdminBadge: "Operator",
  });

  useEffect(() => {
    let active = true;
    apiGetSettings()
      .then((settings) => {
        if (!active || !settings) return;
        const mode: ArcadeRigMode =
          settings.arcadeRigMode || (settings.isCasinoRigged ? "win" : getSavedRigMode());
        setAdminSettings({
          isCasinoRigged: mode === "win",
          arcadeRigMode: mode,
          rainbowCosmetics: settings.rainbowCosmetics ?? false,
          customAdminBadge: settings.customAdminBadge ?? "Operator",
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        userStats,
        setUserStats,
        cash,
        setCash,
        gems,
        setGems,
        prestigeLevel,
        setPrestigeLevel,
        userId,
        setUserId,
        adminSettings,
        setAdminSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
