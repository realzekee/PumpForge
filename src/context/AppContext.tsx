import React, { createContext, useContext, useState, useEffect } from "react";
import { account, databases, client } from "../appwrite";
import { apiGetSettings, apiGetMe, getCustomAuthToken } from "../api/gameClient";

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
  nameColor: "text-zinc-400 font-extrabold",
  cash: 5000.0,
  gems: 90,
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
  const [gems, setGems] = useState<number>(() => Number(userStats?.gems ?? 90));
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
    customAdminBadge: "Operator"
  });

  useEffect(() => {
    const initAppwrite = async () => {
      try {
        // Fetch server-authoritative admin settings via Express API
        try {
          const settings = await apiGetSettings();
          const mode: ArcadeRigMode = settings.arcadeRigMode || (settings.isCasinoRigged ? "win" : getSavedRigMode());
          setAdminSettings({
            isCasinoRigged: mode === "win",
            arcadeRigMode: mode,
            rainbowCosmetics: settings.rainbowCosmetics ?? false,
            customAdminBadge: settings.customAdminBadge ?? "Operator"
          });
        } catch (setErr) {
          setAdminSettings({
            isCasinoRigged: false,
            arcadeRigMode: getSavedRigMode(),
            rainbowCosmetics: false,
            customAdminBadge: "Operator"
          });
        }

        // Fetch user account session if logged in
        const token = getCustomAuthToken();
        if (token) {
          try {
            const meRes = await apiGetMe();
            if (meRes?.user && !meRes.user.isGuest) {
              const u = {
                $id: meRes.user.userId,
                uid: meRes.user.userId,
                email: meRes.user.email,
                name: meRes.user.name,
              };
              setCurrentUser(u);
              setUserId(meRes.user.userId);
              if (meRes.stats) {
                setUserStats(meRes.stats);
                setCash(meRes.stats.cash ?? 5000);
                setGems(meRes.stats.gems ?? 90);
                setPrestigeLevel(meRes.stats.prestigeLevel ?? 0);
              }
              return;
            }
          } catch (_) {}
        }

        const isSessionValid = localStorage.getItem("pf_session_valid");
        if (isSessionValid === "true") {
          try {
            const user = await account.get();
            if (user && user.$id) {
              setCurrentUser(user);
              setUserId(user.$id);
              try {
                const doc = await databases.getDocument("pumpforge", "users", user.$id);
                setUserStats(doc);
                setCash(doc.cash ?? 5000);
                setGems(doc.gems ?? 90);
                setPrestigeLevel(doc.prestigeLevel ?? 0);

                const lastC = doc.lastClaimed || doc.lastDailyRewardClaim;
                if (lastC) {
                  localStorage.setItem("pf_last_claimed", lastC);
                }

                localStorage.setItem("pf_session_valid", "true");
                localStorage.setItem("pf_fallback_userId", user.$id);
              } catch (docErr) {
                console.warn("User document notice:", docErr);
              }
            }
          } catch (authErr) {
            localStorage.removeItem("pf_session_valid");
          }
        }
      } catch (e: any) {
        const isSessionValid = localStorage.getItem("pf_session_valid");
        const fallbackId = localStorage.getItem("pf_fallback_userId");
        if (isSessionValid === "true" && fallbackId) {
          try {
            const doc = await databases.getDocument("pumpforge", "users", fallbackId);
            setUserStats(doc);
            setCash(doc.cash ?? 5000);
            setGems(doc.gems ?? 90);
            setPrestigeLevel(doc.prestigeLevel ?? 0);
            setUserId(fallbackId);
            setCurrentUser({
              $id: fallbackId,
              uid: fallbackId,
              email: doc.email || "",
              name: doc.username || "Player",
            });
          } catch {
            localStorage.removeItem("pf_session_valid");
            localStorage.removeItem("pf_fallback_userId");
          }
        }
      }
    };
    initAppwrite();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = client.subscribe(
      `databases.pumpforge.collections.users.documents.${userId}`,
      (response: any) => {
        if (
          response.events.includes("databases.*.collections.*.documents.*.update") ||
          response.events.includes("databases.*.collections.*.documents.*.create")
        ) {
          const updatedDoc = response.payload;
          if (updatedDoc.$collectionId === "users") {
            setCash(updatedDoc.cash);
            setGems(updatedDoc.gems);
            setPrestigeLevel(updatedDoc.prestigeLevel);
            setUserStats((prev: any) => ({ ...(prev || {}), ...updatedDoc }));
          }
        }
      },
    );
    return () => unsub();
  }, [userId]);

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
