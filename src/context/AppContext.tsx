import React, { createContext, useContext, useState, useEffect } from "react";
import { account, databases, client } from "../appwrite";
import { Permission, Role } from "appwrite";

export type ArcadeRigMode = "fair" | "win" | "lose";

interface AdminSettings {
  isCasinoRigged: boolean;
  arcadeRigMode: ArcadeRigMode;
  rainbowCosmetics: boolean;
  customAdminBadge: string;
}

interface AppContextType {
  currentUser: any;
  userStats: any;
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [cash, setCash] = useState(5000);
  const [gems, setGems] = useState(90);
  const [prestigeLevel, setPrestigeLevel] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
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
        // Fetch or create admin settings
        try {
          const settingsDoc = await databases.getDocument("pumpforge", "admin_settings", "global");
          const mode: ArcadeRigMode = settingsDoc.arcadeRigMode || (settingsDoc.isCasinoRigged ? "win" : getSavedRigMode());
          setAdminSettings({
            isCasinoRigged: mode === "win",
            arcadeRigMode: mode,
            rainbowCosmetics: settingsDoc.rainbowCosmetics ?? false,
            customAdminBadge: settingsDoc.customAdminBadge ?? "Operator"
          });
        } catch (setErr) {
          console.warn("Global admin_settings not found, trying to create...", setErr);
          try {
            await databases.createDocument("pumpforge", "admin_settings", "global", {
              isCasinoRigged: false,
              arcadeRigMode: "fair",
              rainbowCosmetics: false,
              customAdminBadge: "Operator"
            }, [
              Permission.read(Role.any()),
              Permission.update(Role.any()),
              Permission.delete(Role.any())
            ]);
          } catch(e) {
             console.warn("Could not create admin_settings, maybe collection missing. Using default.", e);
          }
        }

        const user = await account.get();
        setCurrentUser(user);
        setUserId(user.$id);
        const doc = await databases.getDocument("pumpforge", "users", user.$id);
        setUserStats(doc);
        setCash(doc.cash ?? 5000);
        setGems(doc.gems ?? 90);
        setPrestigeLevel(doc.prestigeLevel ?? 0);
        
        const lastC = doc.lastClaimed || doc.lastDailyRewardClaim;
        if (lastC) {
           localStorage.setItem("pf_last_claimed", lastC);
        }

        // Mirror session validation flag to bypass Firefox ETP dropping the third-party cookie
        localStorage.setItem("pf_session_valid", "true");
        localStorage.setItem("pf_fallback_userId", user.$id);
      } catch (e: any) {
        console.warn(
          "Appwrite init error in context (possible Firefox ETP):",
          e,
        );
        if (e?.code === 403) {
          import("sonner").then(({ toast }) => {
            toast.error(
              "Appwrite Permission Denied (403): Check your Security Roles or Collection Permissions in the console.",
            );
          });
        }

        // Firefox ETP fallback hydration
        const isSessionValid = localStorage.getItem("pf_session_valid");
        const fallbackId = localStorage.getItem("pf_fallback_userId");
        if (isSessionValid === "true" && fallbackId) {
          console.log("Hydrating user state from Firefox ETP fallback");
          try {
            const doc = await databases.getDocument(
              "pumpforge",
              "users",
              fallbackId,
            );
            setUserStats(doc);
            setCash(doc.cash ?? 5000);
            setGems(doc.gems ?? 90);
            setPrestigeLevel(doc.prestigeLevel ?? 0);
            setUserId(fallbackId);
            // Reconstruct minimal user to keep the app working
            setCurrentUser({
              $id: fallbackId,
              email: doc.email || "",
              name: doc.username || "Player",
            });
          } catch (fallbackErr) {
            console.error("ETP hydration also failed:", fallbackErr);
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
      [
        `databases.pumpforge.collections.users.documents.${userId}`,
        `databases.pumpforge.collections.admin_settings.documents.global`
      ],
      (response: any) => {
        if (
          response.events.includes("databases.*.collections.*.documents.*.update") ||
          response.events.includes("databases.*.collections.*.documents.*.create")
        ) {
          const updatedDoc = response.payload;
          if (updatedDoc.$collectionId === "admin_settings") {
            const mode: ArcadeRigMode = updatedDoc.arcadeRigMode || (updatedDoc.isCasinoRigged ? "win" : "fair");
            setAdminSettings({
              isCasinoRigged: mode === "win",
              arcadeRigMode: mode,
              rainbowCosmetics: updatedDoc.rainbowCosmetics ?? false,
              customAdminBadge: updatedDoc.customAdminBadge ?? "Operator"
            });
          } else if (updatedDoc.$collectionId === "users") {
            setCash(updatedDoc.cash);
            setGems(updatedDoc.gems);
            setPrestigeLevel(updatedDoc.prestigeLevel);
            setUserStats(updatedDoc);
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

