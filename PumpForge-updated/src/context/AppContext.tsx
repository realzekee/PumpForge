import React, { createContext, useContext, useState, useEffect } from "react";
import { account, databases, client } from "../appwrite";
import { Models } from "appwrite";
import { UserStats } from "../types";

interface AdminSettings {
  isCasinoRigged: boolean;
  rainbowCosmetics: boolean;
  customAdminBadge: string;
}

interface AppContextType {
  currentUser: Models.User<Models.Preferences> | null;
  userStats: UserStats | null;
  cash: number;
  setCash: React.Dispatch<React.SetStateAction<number>>;
  gems: number;
  setGems: React.Dispatch<React.SetStateAction<number>>;
  prestigeLevel: number;
  setPrestigeLevel: React.Dispatch<React.SetStateAction<number>>;
  userId: string | null;
  adminSettings: AdminSettings;
  setAdminSettings: React.Dispatch<React.SetStateAction<AdminSettings>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [cash, setCash] = useState(5000);
  const [gems, setGems] = useState(90);
  const [prestigeLevel, setPrestigeLevel] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    isCasinoRigged: false,
    rainbowCosmetics: false,
    customAdminBadge: "Operator",
  });

  useEffect(() => {
    const initAppwrite = async () => {
      try {
        // Fetch admin settings (read-only from the client — writes are admin-only server-side)
        try {
          const settingsDoc = await databases.getDocument("pumpforge", "admin_settings", "global");
          setAdminSettings({
            isCasinoRigged: settingsDoc.isCasinoRigged ?? false,
            rainbowCosmetics: settingsDoc.rainbowCosmetics ?? false,
            customAdminBadge: settingsDoc.customAdminBadge ?? "Operator",
          });
        } catch (setErr) {
          // admin_settings doc may not exist yet; fall back to defaults silently.
          // Do NOT auto-create it here with open permissions.
          console.warn("Could not fetch admin_settings, using defaults.", setErr);
        }

        const user = await account.get();
        setCurrentUser(user);
        setUserId(user.$id);

        const doc = await databases.getDocument("pumpforge", "users", user.$id);
        setUserStats(doc as unknown as UserStats);
        setCash(doc.cash ?? 5000);
        setGems(doc.gems ?? 90);
        setPrestigeLevel(doc.prestigeLevel ?? 0);

        const lastC = doc.lastClaimed || doc.lastDailyRewardClaim;
        if (lastC) {
          localStorage.setItem("pf_last_claimed", lastC);
        }
      } catch (e: any) {
        console.warn("Appwrite init error in context:", e);
        if (e?.code === 403) {
          import("sonner").then(({ toast }) => {
            toast.error(
              "Appwrite Permission Denied (403): Check your Security Roles or Collection Permissions in the console.",
            );
          });
        }
        // No localStorage auth fallback — an invalid/expired session should prompt re-login.
      }
    };
    initAppwrite();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = client.subscribe(
      [
        `databases.pumpforge.collections.users.documents.${userId}`,
        `databases.pumpforge.collections.admin_settings.documents.global`,
      ],
      (response: any) => {
        if (
          response.events.includes("databases.*.collections.*.documents.*.update") ||
          response.events.includes("databases.*.collections.*.documents.*.create")
        ) {
          const updatedDoc = response.payload;
          if (updatedDoc.$collectionId === "admin_settings") {
            setAdminSettings({
              isCasinoRigged: updatedDoc.isCasinoRigged ?? false,
              rainbowCosmetics: updatedDoc.rainbowCosmetics ?? false,
              customAdminBadge: updatedDoc.customAdminBadge ?? "Operator",
            });
          } else if (updatedDoc.$collectionId === "users") {
            setCash(updatedDoc.cash);
            setGems(updatedDoc.gems);
            setPrestigeLevel(updatedDoc.prestigeLevel);
            setUserStats(updatedDoc as unknown as UserStats);
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
        userStats,
        cash,
        setCash,
        gems,
        setGems,
        prestigeLevel,
        setPrestigeLevel,
        userId,
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
