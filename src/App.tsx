/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import HomeTab from './components/HomeTab';
import MarketTab from './components/MarketTab';
import HopiumTab from './components/HopiumTab';
import ArcadeTab from './components/ArcadeTab';
import LeaderboardTab from './components/LeaderboardTab';
import ShopTab from './components/ShopTab';
import AchievementsTab from './components/AchievementsTab';
import PortfolioTab from './components/PortfolioTab';
import TreemapTab from './components/TreemapTab';
import CreateCoinTab from './components/CreateCoinTab';
import NotificationsTab from './components/NotificationsTab';
import SettingsTab from './components/SettingsTab';
import AboutTab from './components/AboutTab';
import ProfileTab from './components/ProfileTab';
import OwnerDashboardTab from './components/OwnerDashboardTab';
import BugReportModal from './components/BugReportModal';
import {
  MemeCoin,
  UserStats,
  PortfolioHolding,
  LiveTrade,
  PredictionMarket,
  Achievement,
  ActiveTab,
  NotificationItem,
  SimulatedPlayer,
  Broadcast
} from './types';
import { INITIAL_COINS } from './data/memeCoins';
import { Award, Gift, Sparkles, X, ChevronRight, Check, Gamepad2, ShoppingBag, PlusCircle, Lock, LogIn, TrendingUp, Crown, Skull, BellRing } from 'lucide-react';

// Appwrite imports
import { account, databases } from './appwrite';

// Firebase imports
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  query,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  getDocs,
  getDocFromServer,
  orderBy,
  limit,
  increment
} from 'firebase/firestore';

const PRESTIGE_NAMES = [
  'Degen Level I',
  'Ape Prestige II',
  'Giga Whaler III',
  'Supreme Lord IV',
  'Absolute Dev V',
  'Interstellar Sage VI'
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedCoinIdForMarket, setSelectedCoinIdForMarket] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const cached = localStorage.getItem('cached_appwrite_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);
  const [isStatsLoaded, setIsStatsLoaded] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('cached_appwrite_stats');
    } catch {
      return false;
    }
  });




  // Core local states (fallbacks/synced depending on auth)
  const [coins, setCoins] = useState<MemeCoin[]>(INITIAL_COINS);
  const [userStats, setUserStats] = useState<UserStats>(() => {
    try {
      const cachedUser = localStorage.getItem('cached_appwrite_user');
      const cachedStats = localStorage.getItem('cached_appwrite_stats');
      if (cachedUser && cachedStats) {
        return JSON.parse(cachedStats);
      }
    } catch (e) {
      console.error('Error loading fallback userStats cache:', e);
    }
    return {
      username: 'Guest Player',
      handle: '@guest_degen',
      title: 'Member',
      isPremium: false,
      nameColor: 'text-zinc-400 font-extrabold',
      cash: 5000.00,
      gems: 90,
      prestigeLevel: 0,
      totalProfit: 0,
      coinsCreatedCount: 0,
      tradesCount: 0,
      lastDailyRewardClaim: null,
      createdAt: '2026-05-24T06:40:00Z'
    };
  });
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [liveTrades, setLiveTrades] = useState<LiveTrade[]>([]);
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<(UserStats & { uid: string })[]>([]);
  const [simulatedPlayers, setSimulatedPlayers] = useState<SimulatedPlayer[]>(() => {
    const saved = localStorage.getItem('memex_simulated_players');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing sim players:', e);
      }
    }
    return [
      { 
        id: '@zeke', 
        name: 'Zeke', 
        handle: '@zeke', 
        profit: 852000.00, 
        prestige: 5, 
        title: 'Whale Dev', 
        nameColor: 'text-orange-400 font-extrabold text-glow', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-02-14T10:15:30Z',
        activityLog: [
          { id: 'z1', timestamp: '2026-05-24T05:12:00Z', action: 'Created coin *ZEKEPUMP with liquidity $50,000', category: 'risk' },
          { id: 'z2', timestamp: '2026-05-24T06:20:00Z', action: 'Executed strategic trade on *ZEKEPUMP for $125,000 profit', category: 'risk' },
          { id: 'z3', timestamp: '2026-05-24T06:45:00Z', action: 'Bought 1,500,000 *ROAD tokens for $45,000', category: 'trade' },
          { id: 'z4', timestamp: '2026-05-24T07:05:00Z', action: 'Claimed Daily Sandbox Credit multiplier bonus', category: 'system' }
        ]
      },
      { 
        id: '@stonks', 
        name: 'Stonks Master', 
        handle: '@stonks', 
        profit: 432000.00, 
        prestige: 2, 
        title: 'Giga Trader', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-03-01T15:24:12Z',
        activityLog: [
          { id: 's1', timestamp: '2026-05-24T01:30:00Z', action: 'Sold 500,000 *FED coins at peak value for $180k profit', category: 'trade' },
          { id: 's2', timestamp: '2026-05-24T03:15:00Z', action: 'Placed $50,000 bet on Predict Market: "ROAD valuation of 150K"', category: 'trade' },
          { id: 's3', timestamp: '2026-05-24T04:40:00Z', action: 'Unlocked Achievement: "Giga Hype Lord III"', category: 'system' }
        ]
      },
      { 
        id: '@sol_expert', 
        name: 'Sol Expert', 
        handle: '@sol_expert', 
        profit: 492000.00, 
        prestige: 4, 
        title: 'Giga Trader', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-01-20T08:05:11Z',
        activityLog: [
          { id: 'so1', timestamp: '2026-05-24T02:11:00Z', action: 'Bought bottom tier liquidity of *ROAD for $80,000', category: 'trade' },
          { id: 'so2', timestamp: '2026-05-24T04:59:00Z', action: 'Exchanged gems to unlock Cosmic Slate profile flair', category: 'system' }
        ]
      },
      { 
        id: '@degen_ape', 
        name: 'Degen Ape', 
        handle: '@degen_ape', 
        profit: 154000.50, 
        prestige: 0, 
        title: 'Degen', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2526-04-10T12:00:00Z',
        activityLog: [
          { id: 'da1', timestamp: '2026-05-24T06:12:00Z', action: 'Minted custom microcap coin *APEWAY', category: 'risk' },
          { id: 'da2', timestamp: '2026-05-24T06:14:00Z', action: 'Closed *APEWAY within 120 seconds for $15,000 profit', category: 'risk' }
        ]
      },
      { 
        id: '@pump_master', 
        name: 'Pump Master', 
        handle: '@pump_master', 
        profit: 238500.00, 
        prestige: 1, 
        title: 'Degen', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-05-18T19:40:00Z',
        activityLog: [
          { id: 'pm1', timestamp: '2026-05-24T03:30:00Z', action: 'Acquired 100,000,000 *ROAD tokens at standard pool rate', category: 'trade' }
        ]
      },
      { 
        id: '@moon_boy', 
        name: 'Moon Boy', 
        handle: '@moon_boy', 
        profit: 154000.50, 
        prestige: 0, 
        title: 'Degen', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-05-21T06:15:00Z',
        activityLog: [
          { id: 'mb1', timestamp: '2026-05-24T04:02:00Z', action: 'Bought *STARS with full available wallet size', category: 'trade' }
        ]
      },
      { 
        id: '@alpha', 
        name: 'Alpha caller', 
        handle: '@alpha', 
        profit: 407500.00, 
        prestige: 3, 
        title: 'Giga Trader', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-02-28T22:11:44Z',
        activityLog: [
          { id: 'al1', timestamp: '2026-05-24T01:10:00Z', action: 'Published live shill message trigger in Hopium Lobby', category: 'system' },
          { id: 'al2', timestamp: '2026-05-24T05:44:00Z', action: 'Withdrew $120,000 cash balance into offline wallet vault', category: 'trade' }
        ]
      },
      { 
        id: '@whale', 
        name: 'Crypto Whale', 
        handle: '@whale', 
        profit: 830000.00, 
        prestige: 8, 
        title: 'Whale Dev', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-01-05T01:30:15Z',
        activityLog: [
          { id: 'w1', timestamp: '2026-05-24T00:05:00Z', action: 'Bought 85% of standard pool allocation of *ROAD', category: 'trade' },
          { id: 'w2', timestamp: '2026-05-24T03:55:00Z', action: 'Claimed Daily Extreme multiplier booster of $24,000', category: 'system' }
        ]
      },
      { 
        id: '@paper_hands', 
        name: 'Paper Hands', 
        handle: '@paper_hands', 
        profit: 154000.50, 
        prestige: 0, 
        title: 'Degen', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-05-02T13:45:00Z',
        activityLog: [
          { id: 'ph1', timestamp: '2026-05-24T05:00:00Z', action: 'Panic-sold entire *ROAD token balance after -3% dip', category: 'trade' }
        ]
      },
      { 
        id: '@diamond_dev', 
        name: 'Diamond Dev', 
        handle: '@diamond_dev', 
        profit: 238500.00, 
        prestige: 1, 
        title: 'Degen', 
        nameColor: 'text-zinc-300', 
        isSuspended: false, 
        isAdmin: false,
        createdAt: '2026-04-30T10:12:00Z',
        activityLog: [
          { id: 'dd1', timestamp: '2026-05-24T02:30:00Z', action: 'Acquired Dev credentials token in custom sandbox', category: 'system' }
        ]
      },
    ];
  });
  const [isOfflineDevice, setIsOfflineDevice] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dismissed_broadcasts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showDailyToast, setShowDailyToast] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInReason, setSignInReason] = useState('');
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [coinToDelete, setCoinToDelete] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState<boolean>(false);
  const [isDailyRewardAvailable, setIsDailyRewardAvailable] = useState(true);
  const [dailyRewardTimer, setDailyRewardTimer] = useState('Claim Available!');

  // Appwrite Session initializer and handler functions (located below all state declarations)
  useEffect(() => {
    const initSession = async () => {
      setIsCheckingRedirect(true);
      try {
        // 1. Explicitly check for and handle incoming OAuth redirect query parameters (userId & secret)
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        const secret = urlParams.get('secret');

        if (userId && secret) {
          try {
            console.log("⚡ Found OAuth redirect parameters. Creating manual session for userId:", userId);
            
            // Clean local caches first to avoid any stale session override
            localStorage.removeItem('cached_appwrite_user');
            localStorage.removeItem('cached_appwrite_stats');
            
            await account.createSession(userId, secret);
            
            // Clean up the URL query parameters so page refreshes don't re-trigger OAuth session creation
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);

            // Immediately trigger a full context reload to dissolve cached states and initialize freshly
            window.location.reload();
            return;
          } catch (sessionErr: any) {
            console.error("Failed to create session from redirect parameters:", sessionErr);
            alert(`Appwrite OAuth Session Activation Error: ${sessionErr?.message || sessionErr}`);
          }
        }

        const user = await account.get();
        if (user) {
          // Immediately fetch game data from Appwrite databases if exists or create document
          let profileDoc: any;
          try {
            profileDoc = await databases.getDocument("pumpforge", "users", user.$id);
          } catch (err: any) {
            const isNotFound = err?.code === 404 || String(err).includes('404') || err?.message?.includes('not found');
            if (isNotFound) {
              console.log("Creating brand new Appwrite database profile for user:", user.$id);
              profileDoc = await databases.createDocument("pumpforge", "users", user.$id, {
                total_value: 0.0,
                cash: 5000.00, // Initialize new users with the standard 5000 cash balance
                coins: 0,
                gems: 90,
                prestigeLevel: 0,
                tradesCount: 0,
                lastDailyRewardClaim: ""
              });
            } else {
              throw err;
            }
          }

          // Map user and document data to states
          const mappedUser = {
            ...user,
            uid: user.$id,
            displayName: user.name || user.email.split('@')[0] || 'Appwrite Player'
          };
          
          const isOwnerEmail = (user.email === 'realzekeee@gmail.com' || user.email === 'realzekee@gmail.com');
          const finalUsername = user.name || user.email.split('@')[0] || 'Appwrite Player';
          const finalHandle = '@' + finalUsername.toLowerCase().replace(/[^a-z0-9]/g, '');

          const finalUserStats = {
            username: finalUsername,
            handle: finalHandle,
            title: isOwnerEmail ? 'Owner' : 'Member',
            isPremium: isOwnerEmail,
            nameColor: isOwnerEmail ? 'text-rose-500 font-extrabold text-glow tracking-wider' : 'text-zinc-400 font-bold',
            cash: profileDoc.cash ?? 5000.00,
            gems: profileDoc.gems ?? 90,
            prestigeLevel: profileDoc.prestigeLevel ?? 0,
            totalProfit: profileDoc.total_value ?? 0,
            coinsCreatedCount: profileDoc.coins ?? 0,
            tradesCount: profileDoc.tradesCount ?? 0,
            lastDailyRewardClaim: profileDoc.lastDailyRewardClaim || null,
            createdAt: user.$createdAt || new Date().toISOString()
          };

          // Cache the states immediately inside localStorage to prevent flashes or resets on asset rerenders
          localStorage.setItem('cached_appwrite_user', JSON.stringify(mappedUser));
          localStorage.setItem('cached_appwrite_stats', JSON.stringify(finalUserStats));

          setCurrentUser(mappedUser);
          setUserStats(finalUserStats);
          setIsStatsLoaded(true);

          // Pre-populate holdings and achievements from localStorage mapped by user ID for pragmatic local persistence
          const cachedHoldings = localStorage.getItem(`memex_holdings_${user.$id}`);
          if (cachedHoldings) {
            setHoldings(JSON.parse(cachedHoldings));
          } else {
            setHoldings([]);
          }

          const cachedAchs = localStorage.getItem(`memex_achievements_${user.$id}`);
          if (cachedAchs) {
            setAchievements(JSON.parse(cachedAchs));
          } else {
            setAchievements([
              { id: 'a1', title: "Baby's First Buy", description: 'Procure your first simulated meme coin.', category: 'trading', target: 1, current: 0, claimed: false, cashReward: 200, gemReward: 15 },
              { id: 'a2', title: 'Paper Hands', description: 'Dump an asset for simulated losses.', category: 'trading', target: 1, current: 0, claimed: false, cashReward: 100, gemReward: 10 },
              { id: 'a3', title: 'Swaps Accumulator', description: 'Execute 10 successful coin purchases.', category: 'trading', target: 10, current: 0, claimed: false, cashReward: 1200, gemReward: 40 },
              { id: 'a4', title: 'Creative Intelligence', description: 'Launch your first customized token dev asset.', category: 'creation', target: 1, current: 0, claimed: false, cashReward: 1500, gemReward: 50 },
              { id: 'a5', title: 'Trading Master', description: 'Create your first meme coin.', category: 'creation', target: 1, current: 0, claimed: false, cashReward: 4000, gemReward: 100 },
              { id: 'a6', title: 'Cash Hoarder I', description: 'Accumulate $50,000 cash balance reserves.', category: 'wealth', target: 50000, current: 10000, claimed: false, cashReward: 3500, gemReward: 75 },
              { id: 'a7', title: 'Prestige Pioneer', description: 'Reset status to activate permanent Prestige Level I.', category: 'prestige', target: 1, current: 0, claimed: false, cashReward: 10000, gemReward: 250 },
              { id: 'a8', title: 'Prestige Elite V', description: 'Advance to Prestige level 5.', category: 'prestige', target: 5, current: 0, claimed: false, cashReward: 100000, gemReward: 1500 }
            ]);
          }
        }
      } catch (err: any) {
        console.log('No Appwrite session found or failed to fetch session:', err);
        
        // Exclude generic 401 unauthenticated signals to avoid popping up alerts on regular guest players,
        // but alert all other unexpected system/network/database errors or oauth failures.
        const isNormalUnauthenticated = err?.code === 401 || err?.message?.includes('unauthorized') || String(err).includes('401');
        if (!isNormalUnauthenticated) {
          alert(`Appwrite Diagnostic Error: Failed to load user profile or databases schema.\nMessage: ${err?.message || err}`);
        }

        // Clean up session caches on standard session failures
        localStorage.removeItem('cached_appwrite_user');
        localStorage.removeItem('cached_appwrite_stats');
        
        setCurrentUser(null);
        setIsStatsLoaded(false);
        setUserStats({
          username: 'Guest Player',
          handle: '@guest_degen',
          title: 'Member',
          isPremium: false,
          nameColor: 'text-zinc-400 font-extrabold',
          cash: 5000.00,
          gems: 90,
          prestigeLevel: 0,
          totalProfit: 0,
          coinsCreatedCount: 0,
          tradesCount: 0,
          lastDailyRewardClaim: null
        });
        setHoldings([]);
        setAchievements([
          { id: 'a1', title: "Baby's First Buy", description: 'Procure your first simulated meme coin.', category: 'trading', target: 1, current: 0, claimed: false, cashReward: 200, gemReward: 15 },
          { id: 'a2', title: 'Paper Hands', description: 'Dump an asset for simulated losses.', category: 'trading', target: 1, current: 0, claimed: false, cashReward: 100, gemReward: 10 },
          { id: 'a3', title: 'Swaps Accumulator', description: 'Execute 10 successful coin purchases.', category: 'trading', target: 10, current: 0, claimed: false, cashReward: 1200, gemReward: 40 },
          { id: 'a4', title: 'Creative Intelligence', description: 'Launch your first customized token dev asset.', category: 'creation', target: 1, current: 0, claimed: false, cashReward: 1500, gemReward: 50 },
          { id: 'a5', title: 'Trading Master', description: 'Create your first meme coin.', category: 'creation', target: 1, current: 0, claimed: false, cashReward: 4000, gemReward: 100 },
          { id: 'a6', title: 'Cash Hoarder I', description: 'Accumulate $50,000 cash balance reserves.', category: 'wealth', target: 50000, current: 10000, claimed: false, cashReward: 3500, gemReward: 75 },
          { id: 'a7', title: 'Prestige Pioneer', description: 'Reset status to activate permanent Prestige Level I.', category: 'prestige', target: 1, current: 0, claimed: false, cashReward: 10000, gemReward: 250 },
          { id: 'a8', title: 'Prestige Elite V', description: 'Advance to Prestige level 5.', category: 'prestige', target: 5, current: 0, claimed: false, cashReward: 100000, gemReward: 1500 }
        ]);
      } finally {
        setIsCheckingRedirect(false);
      }
    };

    initSession();
  }, []);

  // Sync state changes back to Appwrite Database if user stats are fully loaded
  useEffect(() => {
    if (!currentUser || !isStatsLoaded) return;
    
    const syncToAppwrite = async () => {
      try {
        await databases.updateDocument("pumpforge", "users", currentUser.uid || currentUser.$id, {
          total_value: userStats.totalProfit || 0.0,
          cash: userStats.cash || 0.0,
          coins: userStats.coinsCreatedCount || 0,
          gems: userStats.gems || 0,
          prestigeLevel: userStats.prestigeLevel || 0,
          tradesCount: userStats.tradesCount || 0,
          lastDailyRewardClaim: userStats.lastDailyRewardClaim || ""
        });
        
        // Also keep stats storage cache up-to-date with current state modifications
        localStorage.setItem('cached_appwrite_stats', JSON.stringify(userStats));
      } catch (e) {
        console.error('Failed to sync state to Appwrite databases:', e);
      }
    };

    const handler = setTimeout(syncToAppwrite, 1500);
    return () => clearTimeout(handler);
  }, [
    userStats.totalProfit,
    userStats.cash,
    userStats.coinsCreatedCount,
    userStats.gems,
    userStats.prestigeLevel,
    userStats.tradesCount,
    userStats.lastDailyRewardClaim,
    currentUser,
    isStatsLoaded
  ]);

  // Authentication Callbacks
  const handleGoogleSignIn = async () => {
    setIsCheckingRedirect(true);
    try {
      // Clear legacy storage cache to guarantee fresh login
      localStorage.removeItem('cached_appwrite_user');
      localStorage.removeItem('cached_appwrite_stats');
      account.createOAuth2Session("google" as any, "https://pump-forge-zeke.vercel.app");
    } catch (e: any) {
      console.error('Appwrite Google sign-in failed:', e);
      alert(`Appwrite Auth Error: ${e?.message || 'Failed to start OAuth session'}`);
      setIsCheckingRedirect(false);
    }
  };

  const handleSignOut = async () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutConfirm(false);
    try {
      await account.deleteSession('current');
    } catch (e) {
      console.error('Appwrite Sign out error:', e);
    } finally {
      // Fully clear session storage caches
      localStorage.removeItem('cached_appwrite_user');
      localStorage.removeItem('cached_appwrite_stats');
      
      setCurrentUser(null);
      setIsStatsLoaded(false);
      setUserStats({
        username: 'Guest Player',
        handle: '@guest_degen',
        title: 'Member',
        isPremium: false,
        nameColor: 'text-zinc-400 font-extrabold',
        cash: 5000.00,
        gems: 90,
        prestigeLevel: 0,
        totalProfit: 0,
        coinsCreatedCount: 0,
        tradesCount: 0,
        lastDailyRewardClaim: null
      });
      setHoldings([]);
      onAddNotification('Signed Out', 'Returned to Guest Sandbox mode.', 'info');
      // Instantly trigger full layout refresh
      window.location.reload();
    }
  };

  // 1. GUEST USER LOCAL STORAGE LOADERS (ONLY IF UN-AUTHENTICATED)
  useEffect(() => {
    if (currentUser) return; // Skip if signed in to Firebase
  }, [currentUser]);

  // 2. FIRESTORE AUTHENTICATION & MULTI-USER REAL-TIME SUBSCRIPTIONS
  // permanently migrated to Appwrite account.get() & databases.getDocument() on start
  useEffect(() => {
    // Session states are handled via Appwrite in the main initializer
  }, []);

  // 3. GLOBAL SHARED COINS, TRADES FEED & MARKETS SYNC
  useEffect(() => {
    // Coins global listener
    const coinsUnsub = onSnapshot(collection(db, 'coins'), (snap) => {
      if (snap.empty) {
        setCoins(INITIAL_COINS);
      } else {
        const list: MemeCoin[] = [];
        snap.forEach((doc) => list.push(doc.data() as MemeCoin));
        setCoins(list);
      }
    }, (error) => {
      console.error('Coins snapshot subscription error:', error);
    });

    // Prediction markets global listener
    const marketsUnsub = onSnapshot(collection(db, 'markets'), (snap) => {
      if (snap.empty) {
        const DEFAULT_MARKETS = [
          { id: 'm1', question: 'Will *ROAD hit a $150K valuation by Friday?', description: 'Based on shill room hype, ROAD represents the premium culture asset.', yesPool: 4500, noPool: 3200, yesPercentage: 58, resolved: false, resolvedOutcome: null, endTime: 'Next Friday', category: 'trading' },
          { id: 'm2', question: 'Will Slots simulation return a grand Jackpot win on next 10 attempts?', description: 'Probabilities dictate slot engines have a high variance output.', yesPool: 150, noPool: 6400, yesPercentage: 2, resolved: false, resolvedOutcome: null, endTime: 'Within 2 hours', category: 'arcade' },
          { id: 'm3', question: 'Will Zeke reach Prestige I status inside the next 12 hours?', description: 'Requires $100K liquid cash balance to trigger Prestige system.', yesPool: 8500, noPool: 1000, yesPercentage: 89, resolved: true, resolvedOutcome: 'YES', endTime: 'Completed', category: 'general' }
        ];
        setMarkets(DEFAULT_MARKETS);
      } else {
        const list: PredictionMarket[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: d.id,
            question: d.question,
            description: d.description,
            yesPool: d.yesPool,
            noPool: d.noPool,
            yesPercentage: d.yesPercentage,
            resolved: d.resolved,
            resolvedOutcome: d.resolvedOutcome,
            endTime: d.endTime,
            category: d.category,
            userBetAmount: 0, // default override
            userBetSide: null // default override
          } as PredictionMarket);
        });
        setMarkets(list);
      }
    }, (error) => {
      console.error('Markets snapshot subscription error:', error);
    });

    // Trades live feed global listener (Limit and ordered by creation timestamp)
    const tradesQuery = query(collection(db, 'trades'), orderBy('timestamp', 'desc'), limit(15));
    const tradesUnsub = onSnapshot(tradesQuery, (snap) => {
      const list: LiveTrade[] = [];
      snap.forEach((doc) => list.push(doc.data() as LiveTrade));
      if (list.length > 0) {
        setLiveTrades(list);
      }
    }, (error) => {
      console.error('Trades snapshot subscription error:', error);
    });

    // Real-time dynamic synced participants list from database
    const usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: (UserStats & { uid: string })[] = [];
      snap.forEach((doc) => {
        list.push({
          uid: doc.id,
          ...(doc.data() as UserStats)
        });
      });
      setRegisteredUsers(list);
    }, (error) => {
      console.error('Real registered users synchronization error:', error);
    });

    // Broadcasts global real-time listener
    const broadcastsUnsub = onSnapshot(collection(db, 'broadcasts'), (snap) => {
      const list: Broadcast[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as Broadcast);
      });
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setBroadcasts(list);
    }, (error) => {
      console.error('Broadcasts snapshot subscription error:', error);
    });

    return () => {
      coinsUnsub();
      marketsUnsub();
      tradesUnsub();
      usersUnsub();
      broadcastsUnsub();
    };
  }, []);

  // 4. WORKER INTERVALS
  // DAILY COOLDOWN INTERVAL WORKER
  useEffect(() => {
    const updateDailyCooldown = () => {
      if (!userStats.lastDailyRewardClaim) {
        setIsDailyRewardAvailable(true);
        setDailyRewardTimer('Claim Available!');
        return;
      }


      const claimTime = new Date(userStats.lastDailyRewardClaim).getTime();
      const now = new Date().getTime();
      const dif = 24 * 60 * 60 * 1000 - (now - claimTime);

      if (dif <= 0) {
        setIsDailyRewardAvailable(true);
        setDailyRewardTimer('Claim Available!');
      } else {
        setIsDailyRewardAvailable(false);
        const hrs = Math.floor(dif / (1000 * 60 * 65));
        const mins = Math.floor((dif % (1000 * 60 * 60)) / (1000 * 65));
        setDailyRewardTimer(`Next in ${hrs}h ${mins}m`);
      }
    };

    updateDailyCooldown();
    const timer = setInterval(updateDailyCooldown, 45000); // refresh timer check
    return () => clearInterval(timer);
  }, [userStats.lastDailyRewardClaim]);

  // Update specific current achievement trackers whenever statistics change
  useEffect(() => {
    setAchievements((prev) =>
      prev.map((ach) => {
        let nextVal = ach.current;
        if (ach.id === 'a1' && userStats.tradesCount >= 1) nextVal = 1;
        if (ach.id === 'a3') nextVal = userStats.tradesCount;
        if (ach.id === 'a4' && userStats.coinsCreatedCount >= 1) nextVal = 1;
        if (ach.id === 'a6') nextVal = Math.floor(userStats.cash);
        if (ach.id === 'a7' && userStats.prestigeLevel >= 1) nextVal = 1;
        if (ach.id === 'a8') nextVal = userStats.prestigeLevel;

        return { ...ach, current: nextVal };
      })
    );
  }, [userStats.cash, userStats.tradesCount, userStats.coinsCreatedCount, userStats.prestigeLevel]);

  // Check for suspension expiration to auto-unsuspend
  useEffect(() => {
    if (userStats?.isSuspended && userStats.suspendedUntil) {
      if (userStats.suspendedUntil <= Date.now()) {
        if (currentUser) {
          updateDoc(doc(db, 'users', currentUser.uid), {
            isSuspended: false,
            suspendedUntil: null
          }).catch(e => console.error('Failed to auto-unsuspend:', e));
        } else {
          setUserStats(prev => ({ ...prev, isSuspended: false, suspendedUntil: undefined }));
        }
      }
    }
  }, [userStats?.isSuspended, userStats?.suspendedUntil, currentUser]);

  // LIVE MARKET TICKING INTERVAL
  // Simulates market transactions by other bots every 4 seconds, fluctuating pricing history!
  useEffect(() => {
    const marketTick = setInterval(() => {
      setCoins((prevCoins) => {
        return prevCoins.map((coin) => {

          // Normal pricing updates
          const isPump = Math.random() < 0.52; // slightly bullish bias
          const variance = (Math.random() * 0.15) + 0.01; // up to 15% fluctuation
          const delta = isPump ? 1 + variance : 1 - variance;

          const nextPrice = Number((coin.price * delta).toFixed(7));
          const nextHistory = [...coin.history.slice(-14), nextPrice];
          const calculated24h = ((nextPrice - coin.history[0]) / (coin.history[0] || 1)) * 105;

          // Randomly trigger live tick log
          if (Math.random() < 0.18) {
            const handlers = ['@stonks', '@degen_ape', '@pump_master', '@moon_boy', '@josh_rich', '@alpha_whale'];
            const botHandle = handlers[Math.floor(Math.random() * handlers.length)];
            const sizeUsd = Math.floor(Math.random() * 4500) + 150;
            const actionType = Math.random() < 0.6 ? 'BUY' : 'SELL';

            const newTrade: LiveTrade = {
              id: 'ticker-' + Math.random().toString(36).substring(3),
              timestamp: new Date().toLocaleTimeString(),
              type: actionType,
              coinId: coin.id,
              coinSymbol: coin.symbol,
              coinName: coin.name,
              amountUsd: sizeUsd,
              userHandle: botHandle
            };

            setLiveTrades((prev) => [newTrade, ...prev.slice(0, 18)]);
          }

          return {
            ...coin,
            price: nextPrice,
            marketCap: Math.floor(coin.supply * nextPrice),
            change24h: calculated24h,
            history: nextHistory
          };
        });
      });
    }, 4500);

    return () => clearInterval(marketTick);
  }, []);

  function onAddNotification(
    title: string,
    msg: string,
    type: 'info' | 'achievement' | 'trade' | 'crash' = 'info'
  ) {
    const newItem: NotificationItem = {
      id: 'notif-' + Math.random().toString(36).substring(3),
      title,
      message: msg,
      timestamp: new Date().toLocaleTimeString(),
      type
    };
    setNotifications((prev) => [newItem, ...prev.slice(0, 5)]);
  }

  function handleDismissBroadcast(id: string) {
    setDismissedBroadcastIds((prev) => {
      const nextDismissed = [...prev, id];
      localStorage.setItem('dismissed_broadcasts', JSON.stringify(nextDismissed));
      return nextDismissed;
    });
  }

  const handleClaimDailyReward = async () => {
    if (!currentUser) {
      setSignInReason('claim your $1,500 daily allowance');
      setShowSignInModal(true);
      return;
    }

    if (!isDailyRewardAvailable) return;

    // Daily claim yields $1200 + 25% for each prestige level
    const mult = 1 + userStats.prestigeLevel * 0.25;
    const cashYield = Math.floor(1200 * mult);

    const nextClaimTime = new Date().toISOString();
    const nextCash = userStats.cash + cashYield;

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          cash: Number(nextCash.toFixed(2)),
          lastDailyRewardClaim: nextClaimTime
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `users/${currentUser.uid}`);
      }
    } else {
      setUserStats((prev) => ({
        ...prev,
        cash: prev.cash + cashYield,
        lastDailyRewardClaim: nextClaimTime
      }));
    }

    onAddNotification('Daily claimed', `Gained $${cashYield.toLocaleString()} cash reward (Includes prestige mult)!`, 'info');
    setShowDailyToast(true);
    setTimeout(() => {
      setShowDailyToast(false);
    }, 8000);
  };

  const tradeAction = async (coinId: string, amountCoins: number, type: 'BUY' | 'SELL') => {
    const coin = coins.find((c) => c.id === coinId);
    if (!coin) return;

    const totalUsdVal = amountCoins * coin.price;

    if (type === 'BUY') {
      if (!currentUser) {
        setSignInReason('buy meme-coin assets');
        setShowSignInModal(true);
        return;
      }

      if (userStats.cash < totalUsdVal) {
        alert('Insufficient funds to buy this asset!');
        return;
      }

      const existingHolding = holdings.find((h) => h.coinId === coinId);
      let nextAmount = amountCoins;
      let nextAvgBuyPrice = coin.price;

      if (existingHolding) {
        nextAmount = existingHolding.amount + amountCoins;
        nextAvgBuyPrice = (existingHolding.amount * existingHolding.avgBuyPrice + totalUsdVal) / nextAmount;
      }

      const nextCash = userStats.cash - totalUsdVal;
      const nextTradesCount = userStats.tradesCount + 1;

      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const holdingRef = doc(db, 'users', currentUser.uid, 'holdings', coinId);
          const tradeId = 't-' + Math.random().toString(36).substring(3);
          const tradeRef = doc(db, 'trades', tradeId);
          const coinRef = doc(db, 'coins', coinId);

          const priceImpact = coin.price * (1 + 0.005 * (amountCoins / coin.supply));
          const finalPrice = Math.min(priceImpact, coin.price * 3);
          const nextHistory = [...coin.history.slice(-14), finalPrice];

          const batch = writeBatch(db);
          batch.update(userRef, {
            cash: Number(nextCash.toFixed(2)),
            tradesCount: nextTradesCount
          });
          batch.set(holdingRef, {
            coinId,
            amount: nextAmount,
            avgBuyPrice: nextAvgBuyPrice
          });
          batch.update(coinRef, {
            price: finalPrice,
            marketCap: Math.floor(coin.supply * finalPrice),
            history: nextHistory,
            volume24h: coin.volume24h + totalUsdVal
          });
          batch.set(tradeRef, {
            id: tradeId,
            timestamp: new Date().toLocaleTimeString(),
            type: 'BUY',
            coinId,
            coinSymbol: coin.symbol,
            coinName: coin.name,
            amountUsd: totalUsdVal,
            amountTokens: amountCoins,
            userHandle: userStats.handle
          });

          await batch.commit();
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `tradeAction/buy/${coinId}`);
        }
      } else {
        setHoldings((prev) => {
          if (existingHolding) {
            return prev.map((h) =>
              h.coinId === coinId ? { ...h, amount: nextAmount, avgBuyPrice: nextAvgBuyPrice } : h
            );
          } else {
            return [...prev, { coinId, amount: amountCoins, avgBuyPrice: coin.price }];
          }
        });

        setUserStats((prev) => ({
          ...prev,
          cash: prev.cash - totalUsdVal,
          tradesCount: prev.tradesCount + 1
        }));
      }

      onAddNotification(
        'Buy Order filled',
        `Successfully bought ${amountCoins.toLocaleString()} *${coin.symbol} for $${totalUsdVal.toFixed(2)}`,
        'trade'
      );
    } else {
      const existingHolding = holdings.find((h) => h.coinId === coinId);
      if (!existingHolding || existingHolding.amount < amountCoins) {
        alert('You do not own that amount of coin holdings!');
        return;
      }

      const nextAmount = existingHolding.amount - amountCoins;
      const profitDelta = amountCoins * (coin.price - existingHolding.avgBuyPrice);
      const nextCash = userStats.cash + totalUsdVal;
      const nextProfit = userStats.totalProfit + profitDelta;
      const nextTradesCount = userStats.tradesCount + 1;

      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const holdingRef = doc(db, 'users', currentUser.uid, 'holdings', coinId);
          const tradeId = 't-' + Math.random().toString(36).substring(3);
          const tradeRef = doc(db, 'trades', tradeId);
          const coinRef = doc(db, 'coins', coinId);

          const priceImpact = coin.price * (1 - 0.005 * (amountCoins / coin.supply));
          const finalPrice = Math.max(0.0000001, priceImpact);
          const nextHistory = [...coin.history.slice(-14), finalPrice];

          const batch = writeBatch(db);
          batch.update(userRef, {
            cash: Number(nextCash.toFixed(2)),
            totalProfit: nextProfit,
            tradesCount: nextTradesCount
          });

          if (nextAmount <= 0) {
            batch.delete(holdingRef);
          } else {
            batch.set(holdingRef, {
              coinId,
              amount: nextAmount,
              avgBuyPrice: existingHolding.avgBuyPrice
            });
          }

          batch.update(coinRef, {
            price: finalPrice,
            marketCap: Math.floor(coin.supply * finalPrice),
            history: nextHistory,
            volume24h: coin.volume24h + totalUsdVal
          });

          batch.set(tradeRef, {
            id: tradeId,
            timestamp: new Date().toLocaleTimeString(),
            type: 'SELL',
            coinId,
            coinSymbol: coin.symbol,
            coinName: coin.name,
            amountUsd: totalUsdVal,
            amountTokens: amountCoins,
            userHandle: userStats.handle
          });

          await batch.commit();
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `tradeAction/sell/${coinId}`);
        }
      } else {
        setHoldings((prev) => {
          return prev
            .map((h) => {
              if (h.coinId === coinId) {
                return { ...h, amount: h.amount - amountCoins };
              }
              return h;
            })
            .filter((h) => h.amount > 0);
        });

        setUserStats((prev) => ({
          ...prev,
          cash: prev.cash + totalUsdVal,
          totalProfit: prev.totalProfit + profitDelta,
          tradesCount: prev.tradesCount + 1
        }));
      }

      if (profitDelta < 0) {
        if (currentUser) {
          try {
            await updateDoc(doc(db, 'users', currentUser.uid, 'achievements', 'a2'), { current: 1 });
          } catch (e) {
            console.error('Achievement update failure: ', e);
          }
        } else {
          setAchievements((p) =>
            p.map((ach) => (ach.id === 'a2' ? { ...ach, current: 1 } : ach))
          );
        }
      }

      onAddNotification(
        'Sell order filled',
        `Sold ${amountCoins.toLocaleString()} *${coin.symbol} for $${totalUsdVal.toFixed(2)}`,
        'trade'
      );
    }
  };

  const handleLaunchOwnCoin = async (name: string, symbol: string, desc: string, emoji: string): Promise<{success: boolean, error?: string}> => {
    if (!currentUser) {
      setSignInReason('launch custom coins');
      setShowSignInModal(true);
      return { success: false, error: 'User not signed in' };
    }

    const existingOwnCoin = coins.find((c) => c.creator === userStats.handle);
    if (existingOwnCoin) {
      return { success: false, error: `❌ 1-COIN LIMIT: You already have an active coin (*${existingOwnCoin.symbol}). Delete it before launching!` };
    }

    if (userStats.cash < 1100) {
      return { success: false, error: `❌ INSUFFICIENT FUNDS: Launching a coin costs $1,100 list fee.` };
    }

    const listPrice = 0.005;
    const cleanSymbol = symbol.toLowerCase().replace(/[^a-z0-9_\-]/g, '');
    const cleanRand = Math.random().toString(36).substring(2).replace(/[^a-z0-9]/g, '');
    const coinId = `${cleanSymbol}-${cleanRand}`;

    const newMeme: MemeCoin = {
      id: coinId,
      name,
      symbol,
      creator: userStats.handle,
      description: desc,
      avatarEmoji: emoji,
      avatarBg: 'bg-emerald-950 text-emerald-300 border-emerald-500',
      price: listPrice,
      marketCap: 1000,
      supply: 200000,
      volume24h: 300,
      change24h: 0,
      history: [listPrice, listPrice, listPrice, listPrice],
      isUserCreated: true
    };

    const nextCash = userStats.cash - 1100;
    const nextCreatedCount = userStats.coinsCreatedCount + 1;

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        const userRef = doc(db, 'users', currentUser.uid);
        const coinRef = doc(db, 'coins', coinId);
        const tradeRandom = Math.random().toString(36).substring(2).replace(/[^a-z0-9]/g, '');
        const tradeId = `create-${tradeRandom}`;
        const tradeRef = doc(db, 'trades', tradeId);

        batch.update(userRef, {
          cash: Number(nextCash.toFixed(2)),
          coinsCreatedCount: nextCreatedCount
        });
        batch.set(coinRef, newMeme);
        batch.set(tradeRef, {
          id: tradeId,
          timestamp: new Date().toLocaleTimeString(),
          type: 'CREATE',
          coinId: coinId,
          coinSymbol: symbol,
          coinName: name,
          amountUsd: 1100,
          userHandle: userStats.handle
        });

        await batch.commit();
      } catch (e: any) {
        handleFirestoreError(e, OperationType.WRITE, `handleLaunchOwnCoin/${coinId}`);
        return { success: false, error: 'Failed to save to Firestore: ' + (e?.message || e) };
      }
    } else {
      setCoins((prev) => [newMeme, ...prev]);
      setUserStats((prev) => ({
        ...prev,
        cash: nextCash,
        coinsCreatedCount: nextCreatedCount
      }));
    }

    onAddNotification('Coin Created!', `Launched custom token *${symbol} as dev creator!`, 'info');
    return { success: true };
  };



  const handleDeleteOwnCoin = (coinId: string) => {
    setCoinToDelete(coinId);
  };

  const handleConfirmDeleteOwnCoin = async () => {
    if (!coinToDelete) return;
    const coinId = coinToDelete;
    setCoinToDelete(null);

    if (!currentUser) {
      setSignInReason('delete your created coins');
      setShowSignInModal(true);
      return;
    }

    const coin = coins.find((c) => c.id === coinId);
    if (!coin) return;

    if (currentUser) {
      try {
        const coinRef = doc(db, 'coins', coinId);
        await deleteDoc(coinRef);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `handleDeleteOwnCoin/${coinId}`);
      }
    }

    setCoins((prev) => prev.filter((c) => c.id !== coinId));
    onAddNotification('COIN DELETED', `Permanently removed *${coin.symbol} from listing records.`, 'info');
  };

  const handlePlaceHopiumBet = async (marketId: string, side: 'YES' | 'NO', amount: number) => {
    if (!currentUser) {
      setSignInReason('place speculation bets and earn money');
      setShowSignInModal(true);
      return;
    }

    const market = markets.find((m) => m.id === marketId);
    if (!market) return;

    const nextCash = userStats.cash - amount;

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        const marketRef = doc(db, 'markets', marketId);
        const betRef = doc(db, 'users', currentUser.uid, 'bets', marketId);
        const userRef = doc(db, 'users', currentUser.uid);

        const yesAdd = side === 'YES' ? amount : 0;
        const noAdd = side === 'NO' ? amount : 0;

        batch.update(marketRef, {
          yesPool: market.yesPool + yesAdd,
          noPool: market.noPool + noAdd
        });
        batch.set(betRef, {
          marketId,
          amount,
          side
        });
        batch.update(userRef, {
          cash: Number(nextCash.toFixed(2))
        });

        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `handlePlaceHopiumBet/${marketId}`);
      }
    } else {
      setMarkets((prev) => {
        return prev.map((m) => {
          if (m.id === marketId) {
            const yesAdd = side === 'YES' ? amount : 0;
            const noAdd = side === 'NO' ? amount : 0;
            return {
              ...m,
              yesPool: m.yesPool + yesAdd,
              noPool: m.noPool + noAdd,
              userBetAmount: amount,
              userBetSide: side
            };
          }
          return m;
        });
      });

      setUserStats((prev) => ({
        ...prev,
        cash: nextCash
      }));
    }

    onAddNotification('Bet receipt', `Placed custom ${side} bet of $${amount} cash!`, 'info');
  };

  const handleCreatePredictionLocal = async (
    question: string,
    description: string,
    category: 'trading' | 'general' | 'arcade'
  ) => {
    const marketId = 'm-' + Math.random().toString(36).substring(3);
    const newMarket: PredictionMarket = {
      id: marketId,
      question,
      description,
      yesPool: 50,
      noPool: 50,
      yesPercentage: 50,
      userBetAmount: 0,
      userBetSide: null,
      resolved: false,
      resolvedOutcome: null,
      endTime: 'Within 24 hours',
      category
    };

    const nextCash = userStats.cash - 500;

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        const marketRef = doc(db, 'markets', marketId);
        const userRef = doc(db, 'users', currentUser.uid);

        batch.set(marketRef, {
          id: marketId,
          question,
          description,
          yesPool: 50,
          noPool: 50,
          yesPercentage: 50,
          resolved: false,
          resolvedOutcome: null,
          endTime: 'Within 24 hours',
          category
        });
        batch.update(userRef, {
          cash: Number(nextCash.toFixed(2))
        });

        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `handleCreatePredictionLocal/${marketId}`);
      }
    } else {
      setMarkets((p) => [newMarket, ...p]);
      setUserStats((prev) => ({
        ...prev,
        cash: nextCash
      }));
    }

    onAddNotification('Market Created', `Launched local prediction question for $500 fee.`, 'info');
  };

  const claimAchievement = async (id: string) => {
    if (!currentUser) {
      setSignInReason('claim achievement rewards and earn money');
      setShowSignInModal(true);
      return;
    }

    const ach = achievements.find((a) => a.id === id);
    if (!ach || ach.claimed) return;

    const nextCash = userStats.cash + ach.cashReward;
    const nextGems = userStats.gems + ach.gemReward;

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        const userRef = doc(db, 'users', currentUser.uid);
        const achRef = doc(db, 'users', currentUser.uid, 'achievements', id);

        batch.update(userRef, {
          cash: Number(nextCash.toFixed(2)),
          gems: nextGems
        });
        batch.update(achRef, { claimed: true });

        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `users/${currentUser.uid}/achievements/${id}`);
      }
    } else {
      setAchievements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, claimed: true } : a))
      );

      setUserStats((prev) => ({
        ...prev,
        cash: nextCash,
        gems: nextGems
      }));
    }

    onAddNotification(
      'Milestone Claimed',
      `Checked off "${ach.title}"! Gained $${ach.cashReward} & 💎 ${ach.gemReward}!`,
      'info'
    );
  };

  const claimAllAchievements = async () => {
    if (!currentUser) {
      setSignInReason('claim achievement rewards and earn money');
      setShowSignInModal(true);
      return;
    }

    const claimable = achievements.filter((a) => a.current >= a.target && !a.claimed);
    if (claimable.length === 0) return;

    let totalCash = 0;
    let totalGems = 0;

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        const userRef = doc(db, 'users', currentUser.uid);

        claimable.forEach((ach) => {
          totalCash += ach.cashReward;
          totalGems += ach.gemReward;
          const achRef = doc(db, 'users', currentUser.uid, 'achievements', ach.id);
          batch.update(achRef, { claimed: true });
        });

        const nextCash = userStats.cash + totalCash;
        const nextGems = userStats.gems + totalGems;

        batch.update(userRef, {
          cash: Number(nextCash.toFixed(2)),
          gems: nextGems
        });

        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `claimAllAchievements`);
      }
    } else {
      setAchievements((prev) =>
        prev.map((a) => {
          if (a.current >= a.target && !a.claimed) {
            totalCash += a.cashReward;
            totalGems += a.gemReward;
            return { ...a, claimed: true };
          }
          return a;
        })
      );

      setUserStats((prev) => ({
        ...prev,
        cash: prev.cash + totalCash,
        gems: prev.gems + totalGems
      }));
    }

    onAddNotification(
      'Bulk Claimed',
      `Claimed ${claimable.length} rewards: $${totalCash.toLocaleString()} and 💎 ${totalGems}!`,
      'info'
    );
    alert(`👑 BATCH CLAIMED!\n\nYou gathered +$${totalCash.toLocaleString()} cash and +${totalGems} Gems!`);
  };

  const handlePrestigeSystem = async () => {
    if (!currentUser) {
      setSignInReason('trigger Prestige resets and earn prestige rewards');
      setShowSignInModal(true);
      return;
    }

    if (userStats.cash < 100000.0) {
      alert(`⚠️ Requirement not met!\n\nYou must accumulate at least $100.00K in simulated Cash Reserves. (Current: $${userStats.cash.toLocaleString()})`);
      return;
    }

    const nextLvl = userStats.prestigeLevel + 1;
    const title = PRESTIGE_NAMES[nextLvl - 1] || 'Galactic Legend';

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        const userRef = doc(db, 'users', currentUser.uid);
        const achRef = doc(db, 'users', currentUser.uid, 'achievements', 'a7');

        batch.update(userRef, {
          cash: 5000.0,
          gems: userStats.gems + 500,
          prestigeLevel: nextLvl,
          title,
          totalProfit: 0,
          tradesCount: 0,
          coinsCreatedCount: 0
        });

        batch.update(achRef, { current: 1 });

        // Delete holdings subcollection contents
        holdings.forEach((h) => {
          const hRef = doc(db, 'users', currentUser.uid, 'holdings', h.coinId);
          batch.delete(hRef);
        });

        await batch.commit();
        setShowPrestigeModal(false);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `handlePrestigeSystem`);
      }
    } else {
      setUserStats((prev) => ({
        ...prev,
        cash: 5000.0,
        gems: prev.gems + 500,
        prestigeLevel: nextLvl,
        title,
        totalProfit: 0,
        tradesCount: 0,
        coinsCreatedCount: 0
      }));

      setHoldings([]);
      setCoins(INITIAL_COINS);
      setShowPrestigeModal(false);

      setAchievements((prev) =>
        prev.map((ach) => (ach.id === 'a7' ? { ...ach, current: 1 } : ach))
      );
    }

    onAddNotification('PRESTIGE ACQUIRED', `Advanced to ${title}! Daily reward multiplier active!`, 'achievement');
    alert(`🔥 PRESTIGE ACCOMPLISHED! 🔥\n\nYou leveled up to Prestige Level ${nextLvl}! Your cash reserves and holdings have reset, but you gained permanent daily rewards bonuses!`);
  };

  const handleSubmitBug = async (title: string, description: string, category: string): Promise<boolean> => {
    if (!currentUser) {
      setSignInReason('submit a bug report');
      setShowSignInModal(true);
      return false;
    }

    // Fast-rate limiting check via localStorage to protect database writes
    const rateLimitKey = `last_bug_reported_${currentUser.uid}`;
    const lastReport = localStorage.getItem(rateLimitKey);
    if (lastReport) {
      const elapsed = Date.now() - parseInt(lastReport);
      const limitMs = 30 * 1000; // 30 seconds limit to avoid spam or accidental double submissions
      if (elapsed < limitMs) {
        const remaining = Math.ceil((limitMs - elapsed) / 1000);
        alert(`⚠️ Please wait ${remaining}s before reporting another issue.`);
        return false;
      }
    }

    const bugId = `bug-${Date.now()}`;
    const newBug = {
      id: bugId,
      title,
      description,
      category,
      userId: currentUser.uid,
      userHandle: userStats.handle,
      timestamp: new Date().toISOString(),
      status: 'open'
    };

    try {
      await setDoc(doc(db, 'bugs', bugId), newBug);
      localStorage.setItem(rateLimitKey, Date.now().toString());
      onAddNotification('Bug Reported!', `Successfully logged your bug "${title}" into active queue!`, 'info');
      return true;
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `handleSubmitBug/${bugId}`);
      alert('Could not submit bug. Connection might be offline or Firestore security rules rejected save: ' + e?.message);
      return false;
    }
  };

  const handleHardResetGame = async () => {
    if (currentUser) {
        try {
          const batch = writeBatch(db);
          const userRef = doc(db, 'users', currentUser.uid);
          batch.update(userRef, {
            cash: 5000.0,
            gems: 250,
            prestigeLevel: 0,
            title: 'Member',
            totalProfit: 0,
            tradesCount: 0,
            coinsCreatedCount: 0,
            lastDailyRewardClaim: null
          });

          holdings.forEach((h) => {
            const hRef = doc(db, 'users', currentUser.uid, 'holdings', h.coinId);
            batch.delete(hRef);
          });

          await batch.commit();
          alert('🔄 Database Arena profile reset successfully!');
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'hardReset');
        }
    } else {
      setLiveTrades([]);
      setMarkets([]);
      setCoins(INITIAL_COINS);
      setUserStats({
        username: 'Guest Degen',
        handle: '@guest',
        title: 'Member',
        isPremium: false,
        nameColor: 'text-zinc-400 font-bold',
        cash: 0.00,
        gems: 50,
        prestigeLevel: 0,
        totalProfit: 0,
        coinsCreatedCount: 0,
        tradesCount: 0,
        lastDailyRewardClaim: null
      });
      setHoldings([]);
      setLiveTrades([]);
      setMarkets([
        {
          id: 'm1',
          question: 'Will *ROAD hit a $150K valuation by Friday??',
          description: 'Based on shill room hype, ROAD represents the premium culture asset.',
          yesPool: 4500,
          noPool: 3200,
          yesPercentage: 58,
          userBetAmount: 0,
          userBetSide: null,
          resolved: false,
          resolvedOutcome: null,
          endTime: 'Next Friday',
          category: 'trading'
        },
        {
          id: 'm2',
          question: 'Will Slots simulation return a grand Jackpot win on next 10 attempts?',
          description: 'Probabilities dictate slot engines have a high variance output.',
          yesPool: 150,
          noPool: 6400,
          yesPercentage: 2,
          userBetAmount: 0,
          userBetSide: null,
          resolved: false,
          resolvedOutcome: null,
          endTime: 'Within 2 hours',
          category: 'arcade'
        }
      ]);
      alert('🔄 Game simulator reset to initial default baseline successfully!');
    }
  };

  const handleSendMoney = async (handle: string, amount: number, coinId: string): Promise<{ success: boolean; message: string }> => {
    const cleanHandle = handle.replace('@', '').toLowerCase();
    const receiver = registeredUsers.find(u => u.handle.toLowerCase() === `@${cleanHandle}`);

    if (!receiver) {
      if (!currentUser) {
        // Return false to prevent guest offline transfers to nobody
        return { success: false, message: `User @${cleanHandle} not found in the database!` };
      }
      return { success: false, message: `User @${cleanHandle} not found in the database!` };
    }

    if (receiver.uid === currentUser?.uid) {
      return { success: false, message: 'You cannot send to yourself.' };
    }

    try {
      if (currentUser) {
        const batch = writeBatch(db);
        
        if (coinId === 'cash') {
          const nextCash = userStats.cash - amount;
          if (nextCash < 0) return { success: false, message: 'Insufficient cash!' };
  
          // Reduce sender
          const senderRef = doc(db, 'users', currentUser.uid);
          batch.update(senderRef, { cash: nextCash });
  
          // Increase receiver
          const receiverRef = doc(db, 'users', receiver.uid);
          batch.update(receiverRef, { cash: increment(amount) });
  
          setUserStats((prev) => ({ ...prev, cash: nextCash }));
        } else if (coinId === 'gems') {
          const nextGems = userStats.gems - amount;
          if (nextGems < 0) return { success: false, message: 'Insufficient gems!' };
  
          // Reduce sender
          const senderRef = doc(db, 'users', currentUser.uid);
          batch.update(senderRef, { gems: Math.floor(nextGems) });
  
          // Increase receiver
          const receiverRef = doc(db, 'users', receiver.uid);
          batch.update(receiverRef, { gems: increment(Math.floor(amount)) });
  
          setUserStats((prev) => ({ ...prev, gems: Math.floor(nextGems) }));
        } else {
          // Coin transfer
          const holding = holdings.find(h => h.coinId === coinId);
          if (!holding || holding.amount < amount) return { success: false, message: 'Insufficient coins!' };
  
          const nextAmount = holding.amount - amount;
  
          // Decrease sender holding
          const senderHoldingRef = doc(db, 'users', currentUser.uid, 'holdings', coinId);
          if (nextAmount > 0) {
            batch.update(senderHoldingRef, { amount: nextAmount });
          } else {
            batch.delete(senderHoldingRef);
          }
  
          // Increase receiver holding
          const receiverHoldingRef = doc(db, 'users', receiver.uid, 'holdings', coinId);
          batch.set(receiverHoldingRef, { coinId, amount: increment(amount) }, { merge: true });
  
          // Decrease local
          setHoldings((prev) => prev.map(h => h.coinId === coinId ? { ...h, amount: Math.max(0, h.amount - amount) } : h).filter(h => h.amount > 0));
        }
  
        await batch.commit();
      } else {
         // Guest mode simulation, we just fail it since guest shouldn't distribute money to real people
         return { success: false, message: 'Guests cannot perform real transfers. Sign in to join the network!' };
      }

      return { success: true, message: 'Sent' };
    } catch (e) {
       console.error("Transfer error:", e);
       handleFirestoreError(e, OperationType.WRITE, 'handleSendMoney');
       return { success: false, message: 'Transfer failed. Check connection and permissions.' };
    }
  };

  const handleUpdateStats = async (updater: (stats: UserStats) => void) => {
    setUserStats((prev) => {
      const clone = { ...prev };
      updater(clone);

      if (currentUser) {
        updateDoc(doc(db, 'users', currentUser.uid), {
          cash: Number(clone.cash.toFixed(2)),
          gems: clone.gems,
          totalProfit: clone.totalProfit,
          tradesCount: clone.tradesCount,
          prestigeLevel: clone.prestigeLevel,
          title: clone.title,
          username: clone.username,
          handle: clone.handle,
          nameColor: clone.nameColor,
          isPremium: clone.isPremium
        }).catch((e) => {
          console.error('Firebase autosave stats failure: ', e);
        });
      }

      return clone;
    });
  };

  if (isCheckingRedirect) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4 animate-pulse">
           <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
           <div>Loading User Session...</div>
        </div>
      </div>
    );
  }

  if (userStats?.isSuspended || userStats?.isBanned) {
    const isBannedObj = !!userStats?.isBanned;
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none font-mono">
        <div className={`max-w-md bg-zinc-900/60 border rounded-2xl p-8 flex flex-col items-center gap-6 shadow-2xl transition-all ${
          isBannedObj 
            ? 'border-red-600/40 shadow-[0_0_50px_rgba(220,38,38,0.12)]' 
            : 'border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.08)]'
        }`}>
          <div className={`w-16 h-16 rounded-full border flex items-center justify-center shadow-lg animate-pulse ${
            isBannedObj
              ? 'bg-red-500/10 border-red-550/30 text-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)]'
              : 'bg-amber-500/10 border-amber-550/30 text-amber-550 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
          }`}>
            {isBannedObj ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className={`text-xl font-black uppercase tracking-widest ${isBannedObj ? 'text-red-500' : 'text-amber-500'}`}>
              {isBannedObj ? 'Profile Banned' : 'Profile Suspended'}
            </h1>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-extrabold font-mono">
              {isBannedObj ? 'Permanent Account Exclusion' : 'Temporary Sandbox Cool Down'}
            </p>
          </div>
          <div className="text-sm text-zinc-400 font-mono leading-relaxed bg-zinc-950/60 p-4 rounded-xl border border-zinc-900">
            {isBannedObj ? (
              <span>
                "Your profile <span className="text-red-400 font-extrabold">{userStats.handle}</span> has been <span className="text-red-500 underline font-black">permanently banned</span> by administrative operators due to safety checks, security rules, or sandbox terminal violations. Both suspension and ban states can be lifted by an authorized administrator/owner."
              </span>
            ) : (
              <span>
                "Your profile <span className="text-amber-400 font-extrabold">{userStats.handle}</span> is <span className="text-amber-500 underline font-extrabold">temporarily suspended</span> by administrative operators due to safety, risk auditing, or trading-volume simulation parameters. Administrators can lift this state at any time."
              </span>
            )}
          </div>
          <div className={`text-[10px] uppercase tracking-widest font-black flex items-center gap-1.5 pt-2 ${isBannedObj ? 'text-red-650' : 'text-amber-600'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isBannedObj ? 'bg-red-600' : 'bg-amber-500'}`}></span>
            {isBannedObj ? 'Administrative Permanent Exclusion' : 'Administrative Temporary Lockdown'}
          </div>
          <button 
            onClick={() => handleConfirmSignOut()}
            className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-250 text-xs font-black uppercase tracking-wider rounded-lg transition-all"
          >
            Sign Out Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 flex-col md:flex-row">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userStats={userStats}
        onClaimDailyReward={handleClaimDailyReward}
        liveTrades={liveTrades}
        onOpenPrestigeModal={() => setShowPrestigeModal(true)}
        onResetProgress={handleHardResetGame}
        dailyRewardTimer={dailyRewardTimer}
        isDailyRewardAvailable={isDailyRewardAvailable}
        currentUser={currentUser}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        coins={coins}
        holdings={holdings}
        onOpenBugReportModal={() => setShowBugReportModal(true)}
      />

      <main className="flex-1 min-w-0 p-5 md:p-8 max-w-7xl mx-auto flex flex-col gap-6 overflow-x-hidden">
        {/* Offline banner removed */}

        {/* Real-time Synced Broadcast Banners */}
        {broadcasts
          .filter((b) => !dismissedBroadcastIds.includes(b.id) && (!b.expiresAt || new Date(b.expiresAt).getTime() > Date.now()))
          .map((b) => {
            // Determine styling theme based on type
            let icon = <BellRing className="w-5 h-5 text-indigo-400" />;
            let containerStyle = "bg-indigo-950/20 border-indigo-900/40 text-indigo-300";
            let labelStyle = "text-indigo-400 bg-indigo-500/10";

            if (b.type === 'trade') {
              icon = <TrendingUp className="w-5 h-5 text-emerald-400" />;
              containerStyle = "bg-emerald-950/25 border-emerald-900/40 text-emerald-300";
              labelStyle = "text-emerald-400 bg-emerald-500/10";
            } else if (b.type === 'achievement') {
              icon = <Crown className="w-5 h-5 text-amber-400" />;
              containerStyle = "bg-amber-950/25 border-amber-900/40 text-amber-300";
              labelStyle = "text-amber-400 bg-amber-500/10";
            } else if (b.type === 'crash' || b.type === 'delist') {
              icon = <Skull className="w-5 h-5 text-rose-450 animate-pulse" />;
              containerStyle = "bg-rose-950/25 border-rose-900/45 text-rose-300";
              labelStyle = "text-rose-400 bg-rose-500/10";
            } else if (b.type === 'info') {
              icon = <Sparkles className="w-5 h-5 text-cyan-400" />;
              containerStyle = "bg-cyan-950/25 border-cyan-900/40 text-cyan-300";
              labelStyle = "text-cyan-400 bg-cyan-500/10";
            }

            return (
              <div 
                key={b.id} 
                className={`relative border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ease-in-out shadow-lg animate-fade-in ${containerStyle}`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-1 sm:mt-0 p-2 bg-black/40 rounded-xl border border-white/5 shrink-0 flex items-center justify-center">
                    {icon}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm tracking-wide text-white">{b.title}</span>
                      <span className={`text-[8.5px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded ${labelStyle}`}>
                        System Broadcast
                      </span>
                    </div>
                    <span className="text-xs text-zinc-350 leading-relaxed font-semibold">
                      {b.message}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => handleDismissBroadcast(b.id)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white hover:text-white border border-white/10 hover:border-white/25 text-xs font-black rounded-xl tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Acknowledge</span>
                  </button>
                </div>
              </div>
            );
          })}


        {/* Tab Workspace Views content */}
        {activeTab === 'home' && (
          <HomeTab
            coins={coins}
            userStats={userStats}
            achievements={achievements}
            onClaimAchievement={claimAchievement}
            setActiveTab={setActiveTab}
            onTradeCoin={(coinId) => {
              const cn = coins.find((c) => c.id === coinId);
              if (cn) {
                setSelectedCoinIdForMarket(coinId);
                setActiveTab('market');
              }
            }}
          />
        )}

        {activeTab === 'market' && (
          <MarketTab
            coins={coins}
            userStats={userStats}
            holdings={holdings}
            onTradeAction={tradeAction}
            onDeleteOwnCoin={handleDeleteOwnCoin}
            initialCoinId={selectedCoinIdForMarket}
          />
        )}

        {activeTab === 'hopium' && (
          <HopiumTab
            markets={markets}
            userStats={userStats}
            onPlaceBet={handlePlaceHopiumBet}
            onCreateMarket={handleCreatePredictionLocal}
          />
        )}

        {activeTab === 'arcade' && (
          !currentUser ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center font-mono animate-fade-in max-w-xl mx-auto select-none" id="arcade-lock-screen">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-805 flex items-center justify-center text-rose-500 mb-6 shadow-xl relative">
                <Gamepad2 className="w-8 h-8" />
                <Lock className="w-4 h-4 text-zinc-400 absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-1 box-content" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Arcade Simulator Locked</h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-8">
                You are playing in Guest Sandbox. High-stakes arcade operations (Coinflip, Slots, Mines, Dice, and Tower) require a dynamic Google-authenticated profile to prevent session loss and secure cash drops.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2.5 shadow-lg shadow-rose-950/20 active:scale-98 transition-all text-xs uppercase tracking-wider font-mono"
              >
                <LogIn className="w-4 h-4 text-white" />
                <span>Connect Google Profile</span>
              </button>
            </div>
          ) : (
            <ArcadeTab
              userStats={userStats}
              onUpdateStats={handleUpdateStats}
              onAddNotification={onAddNotification}
            />
          )
        )}

        {activeTab === 'leaderboard' && <LeaderboardTab userStats={userStats} simulatedPlayers={simulatedPlayers} />}

        {activeTab === 'shop' && (
          !currentUser ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center font-mono animate-fade-in max-w-xl mx-auto select-none" id="shop-lock-screen">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-805 flex items-center justify-center text-amber-500 mb-6 shadow-xl relative">
                <ShoppingBag className="w-8 h-8 font-bold" />
                <Lock className="w-4 h-4 text-zinc-400 absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-1 box-content" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Forge Shop Locked</h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-8">
                Purchasing rare profile colors and high-volume Mystery Crates requires a Cloud Sync Profile. Secure your progress and sync with our Firebase database.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2.5 shadow-lg shadow-rose-950/20 active:scale-98 transition-all text-xs uppercase tracking-wider font-mono"
              >
                <LogIn className="w-4 h-4 text-white" />
                <span>Connect Google Profile</span>
              </button>
            </div>
          ) : (
            <ShopTab
              userStats={userStats}
              onUpdateStats={handleUpdateStats}
              onAddNotification={onAddNotification}
            />
          )
        )}

        {activeTab === 'achievements' && (
          <AchievementsTab
            achievements={achievements}
            userStats={userStats}
            onClaimAchievement={claimAchievement}
            onClaimAll={claimAllAchievements}
          />
        )}

        {activeTab === 'portfolio' && (
          <PortfolioTab
            userStats={userStats}
            holdings={holdings}
            coins={coins}
            onUpdateStats={handleUpdateStats}
            onAddNotification={onAddNotification}
            onSendMoney={handleSendMoney}
            registeredUsers={registeredUsers}
          />
        )}

        {activeTab === 'treemap' && (
          <TreemapTab
            coins={coins}
            onTradeCoin={(coinId) => {
              setSelectedCoinIdForMarket(coinId);
              setActiveTab('market');
            }}
          />
        )}

        {activeTab === 'create-coin' && (
          !currentUser ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center font-mono animate-fade-in max-w-xl mx-auto select-none" id="create-lock-screen">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-805 flex items-center justify-center text-teal-500 mb-6 shadow-xl relative">
                <PlusCircle className="w-8 h-8" />
                <Lock className="w-4 h-4 text-zinc-400 absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-1 box-content" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Create Token Locked</h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-8">
                Becoming a dev to mint custom coins, aggregate bot tracking volume, and execute strategic trades requires Google profile credentials.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2.5 shadow-lg shadow-rose-950/20 active:scale-98 transition-all text-xs uppercase tracking-wider font-mono"
              >
                <LogIn className="w-4 h-4 text-white" />
                <span>Connect Google Profile</span>
              </button>
            </div>
          ) : (
            <CreateCoinTab userStats={userStats} onCreateCoin={handleLaunchOwnCoin} />
          )
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab notifications={notifications} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab userStats={userStats} onUpdateStats={handleUpdateStats} currentUserEmail={currentUser?.email} />
        )}

        {activeTab === 'owner-dashboard' && (
          (() => {
            const isOwnerEmail = (currentUser?.email || '').trim().toLowerCase() === 'realzekeee@gmail.com' || (currentUser?.email || '').trim().toLowerCase() === 'realzekee@gmail.com';
            const isStaff = userStats.title.toLowerCase() === 'owner' || userStats.title.toLowerCase() === 'admin';
            const hasOwnerDashboard = isOwnerEmail || isStaff;

            if (!hasOwnerDashboard) {
              return (
                <div id="access-denied-panel" className="flex flex-col items-center justify-center min-h-[500px] border border-red-950/40 bg-zinc-950 rounded-2xl p-8 font-mono text-center max-w-lg mx-auto my-12 animate-fade-in">
                  <div className="text-red-500 font-extrabold text-3xl mb-4">🚨 ACCESS DENIED</div>
                  <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
                    This control panel is strictly restricted to administrator developers. Your attempts have been logged.
                  </p>
                  <button 
                    id="return-home-btn"
                    onClick={() => setActiveTab('home')}
                    className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-all duration-200"
                  >
                    Return to Safe Zone
                  </button>
                </div>
              );
            }

            return (
              <OwnerDashboardTab 
                userStats={userStats} 
                onUpdateStats={handleUpdateStats} 
                coins={coins} 
                setCoins={setCoins} 
                onAddNotification={onAddNotification}
                setActiveTab={setActiveTab}
                simulatedPlayers={simulatedPlayers}
                setSimulatedPlayers={setSimulatedPlayers}
                liveTrades={liveTrades}
                registeredUsers={registeredUsers}
              />
            );
          })()
        )}

        {activeTab === 'about' && (
          <AboutTab />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            userStats={userStats}
            holdings={holdings}
            coins={coins}
            achievements={achievements}
            liveTrades={liveTrades}
          />
        )}
      </main>

      {/* Extreme prestige popup confirmation */}
      {showPrestigeModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full relative font-mono text-center select-none animate-slide-up">
            <button
              onClick={() => setShowPrestigeModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-orange-950 border border-orange-900 text-orange-400 rounded-xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg animate-pulse">
              👑
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Prestige Reset System
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed font-semibold">
              Ready to reset your current simulation gains to lock in permanent perks? Resetting requires <strong className="text-zinc-200">$100,000.00 cash reserves</strong>.
            </p>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-900 text-xs text-left mb-4 flex flex-col gap-1.5 leading-normal">
              <span className="text-[10px] text-zinc-500 uppercase font-black">Prestige Gains:</span>
              <span className="text-emerald-400 font-bold">• Permanently increases daily rewards by +25%</span>
              <span className="text-cyan-405 font-bold">• Immediately unlocks +500 Gems</span>
              <span className="text-yellow-400 font-bold">• Upgrades your public title next to name</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handlePrestigeSystem}
                className="w-full bg-orange-655 hover:bg-orange-550 py-3 rounded-xl font-bold font-mono text-xs text-white shadow border border-orange-550"
              >
                Confirm Prestige Reset
              </button>
              <button
                onClick={() => setShowPrestigeModal(false)}
                className="w-full bg-zinc-950 hover:bg-zinc-800 py-2 rounded-xl text-zinc-400 hover:text-white border border-zinc-850 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled custom Daily Reward alert toast as seen in video */}
      {showDailyToast && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md bg-zinc-950 border-2 border-emerald-500/80 p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4 z-50 animate-bounce">
          <div className="flex items-start gap-2.5">
            <span className="text-xl">🟢</span>
            <div className="flex flex-col">
              <span className="text-xs font-black text-white">Daily reward claimed! +$1,500</span>
              <span className="text-[10px] text-zinc-400 mt-0.5">Login streak: 1 days</span>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('portfolio');
              setShowDailyToast(false);
            }}
            className="bg-white hover:bg-zinc-200 text-zinc-950 px-3 py-1.5 rounded-lg text-xs font-bold leading-none shrink-0"
          >
            View Portfolio
          </button>
        </div>
      )}

      {/* Google Sign-In Intercept Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" id="google-auth-intercept-modal">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full relative font-mono text-center select-none animate-slide-up">
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInReason('');
              }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-rose-950 border border-rose-900 text-rose-400 rounded-xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg animate-pulse">
              🔒
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Authentication Required
            </h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Google authentication is required to <span className="text-rose-450 font-semibold">{signInReason || 'interact with this feature'}</span>. Sign in to link your progress, trade securely, and back up assets!
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  setShowSignInModal(false);
                  setSignInReason('');
                  await handleGoogleSignIn();
                }}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 py-3 rounded-xl font-bold font-mono text-xs text-white shadow border border-orange-500 flex items-center justify-center gap-2"
                id="modal-google-signin-btn"
              >
                <LogIn className="w-4 h-4 text-white" />
                <span>Sign in with Google</span>
              </button>
              <button
                onClick={() => {
                  setShowSignInModal(false);
                  setSignInReason('');
                }}
                className="w-full bg-zinc-950 hover:bg-zinc-850 py-2 rounded-xl text-zinc-400 hover:text-white border border-zinc-850 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showBugReportModal && (
        <BugReportModal 
          userStats={userStats}
          currentUser={currentUser}
          onClose={() => setShowBugReportModal(false)}
          onSubmitBug={handleSubmitBug}
        />
      )}

      {/* Delete Coin Confirmation Modal */}
      {coinToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full relative font-mono text-center select-none animate-slide-up">
            <button
              onClick={() => setCoinToDelete(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-red-950/80 border border-red-900 text-red-500 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg">
              🗑️
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Delete Listed Token?
            </h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Are you sure you want to permanently delete <span className="text-rose-400 font-bold">*{coins.find(c => c.id === coinToDelete)?.symbol || 'Token'}</span> from the listing records? This action is permanent and cannot be undone.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmDeleteOwnCoin}
                className="w-full bg-red-650 hover:bg-red-700 py-3 rounded-xl font-bold font-mono text-xs text-white shadow border border-red-500 flex items-center justify-center gap-2 transition-colors"
              >
                Permanently Delete
              </button>
              <button
                onClick={() => setCoinToDelete(null)}
                className="w-full bg-zinc-950 hover:bg-zinc-850 py-2 rounded-xl text-zinc-400 hover:text-white border border-zinc-850 text-xs"
              >
                Keep Listing (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full relative font-mono text-center select-none animate-slide-up">
            <button
              onClick={() => setShowSignOutConfirm(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-zinc-950 border border-zinc-800 text-orange-500 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg">
              👋
            </div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Log Out of Profile?
            </h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Are you sure you want to sign out? You will be returned to Guest Sandbox mode, where progress is saved locally but not synced with the cloud.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmSignOut}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 py-3 rounded-xl font-bold font-mono text-xs text-white shadow border border-orange-500 flex items-center justify-center gap-2 transition-all"
              >
                Sign Out
              </button>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="w-full bg-zinc-950 hover:bg-zinc-850 py-2 rounded-xl text-zinc-400 hover:text-white border border-zinc-850 text-xs"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

