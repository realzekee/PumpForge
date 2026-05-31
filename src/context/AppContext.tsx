import React, { createContext, useContext, useState, useEffect } from "react";
import { account, databases, client } from "../appwrite";

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [cash, setCash] = useState(5000);
  const [gems, setGems] = useState(90);
  const [prestigeLevel, setPrestigeLevel] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const initAppwrite = async () => {
      try {
        const user = await account.get();
        setCurrentUser(user);
        setUserId(user.$id);
        const doc = await databases.getDocument("pumpforge", "users", user.$id);
        setUserStats(doc);
        setCash(doc.cash ?? 5000);
        setGems(doc.gems ?? 90);
        setPrestigeLevel(doc.prestigeLevel ?? 0);
      } catch (e) {
        console.error("Appwrite init error in context:", e);
      }
    };
    initAppwrite();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = client.subscribe(
      `databases.pumpforge.collections.users.documents.${userId}`,
      (response: any) => {
        if (response.events.includes("databases.*.collections.*.documents.*.update")) {
          const updatedDoc = response.payload;
          setCash(updatedDoc.cash);
          setGems(updatedDoc.gems);
          setPrestigeLevel(updatedDoc.prestigeLevel);
          setUserStats(updatedDoc);
        }
      }
    );
    return () => unsub();
  }, [userId]);

  return (
    <AppContext.Provider value={{ currentUser, userStats, cash, setCash, gems, setGems, prestigeLevel, setPrestigeLevel, userId }}>
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
