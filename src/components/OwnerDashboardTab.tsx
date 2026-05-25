import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Coins, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Plus, 
  Minus,
  UserPlus, 
  BellRing, 
  Crown,
  Database,
  Skull,
  UserCheck,
  UserX,
  ShieldCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Clock,
  ClipboardList,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserStats, MemeCoin, ActiveTab, SimulatedPlayer, LiveTrade } from '../types';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { doc, updateDoc, collection, getDocs, deleteDoc, writeBatch, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';

interface OwnerDashboardProps {
  userStats: UserStats;
  onUpdateStats: (updater: (stats: UserStats) => void) => void;
  coins: MemeCoin[];
  setCoins: React.Dispatch<React.SetStateAction<MemeCoin[]>>;
  onAddNotification: (title: string, message: string, type?: 'info' | 'achievement' | 'trade' | 'crash') => void;
  setActiveTab?: (tab: ActiveTab) => void;
  simulatedPlayers?: SimulatedPlayer[];
  setSimulatedPlayers?: React.Dispatch<React.SetStateAction<SimulatedPlayer[]>>;
  liveTrades?: LiveTrade[];
  registeredUsers?: any[];
}

export default function OwnerDashboardTab({ 
  userStats, 
  onUpdateStats, 
  coins, 
  setCoins, 
  onAddNotification,
  setActiveTab,
  simulatedPlayers = [],
  setSimulatedPlayers,
  liveTrades = [],
  registeredUsers = []
}: OwnerDashboardProps) {
  // Local state for creator controls
  const [customCash, setCustomCash] = useState<number>(50000);
  const [customGems, setCustomGems] = useState<number>(500);
  const [alertTitle, setAlertTitle] = useState<string>('🚨 BLACK SWAN DETECTED');
  const [alertMsg, setAlertMsg] = useState<string>('Whale dev zeke is manipulating the system state!');
  const [alertType, setAlertType] = useState<'info' | 'achievement' | 'trade' | 'crash'>('crash');
  const [broadcastTimeLimit, setBroadcastTimeLimit] = useState<number>(0); // 0 means no limit (minutes)

  // Bot Raid Overrides state
  const [botRaidCoinId, setBotRaidCoinId] = useState<string>('');
  const [botRaidDirection, setBotRaidDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [botRaidIsRunning, setBotRaidIsRunning] = useState<boolean>(false);
  
  // Database purging state
  const [isPurgingDatabase, setIsPurgingDatabase] = useState<boolean>(false);
  const [customBadgeText, setCustomBadgeText] = useState<string>('OWNER');

  // Directory filter of players
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Custom suspension duration (in days)
  const [suspendDurationDays, setSuspendDurationDays] = useState<number>(1);
  
  // Specific money modification state for each user id
  const [userMoneyDelta, setUserMoneyDelta] = useState<Record<string, number>>({});
  const [userGemsDelta, setUserGemsDelta] = useState<Record<string, number>>({});

  // Keep track of which player's activity is currently expanded/opened
  const [expandedPlayerHandle, setExpandedPlayerHandle] = useState<string | null>(null);

  // Manual custom activity entries logging text keyed by handle
  const [customActionTexts, setCustomActionTexts] = useState<Record<string, string>>({});

  // Local falling back logs for real user stats adjustment audits
  const [localUserLogs, setLocalUserLogs] = useState<Array<{ id: string; timestamp: string; action: string; category: 'trade' | 'system' | 'auth' | 'risk' }>>([
    { id: 'u0', timestamp: '2026-05-24T06:10:00Z', action: 'Authorized as administrative sandbox operator.', category: 'auth' }
  ]);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  };

  // Reset all players to default active system
  const handleResetSimulatedDatabase = () => {
    if (setSimulatedPlayers) {
      setSimulatedPlayers([
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
            { id: 'z2', timestamp: '2026-05-24T06:20:00Z', action: 'Executed strategic dev-delist on *ZEKEPUMP for $125,000 profit', category: 'risk' },
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
          nameColor: 'text-zinc-305', 
          isSuspended: false, 
          isAdmin: false,
          createdAt: '2526-04-10T12:00:00Z',
          activityLog: [
            { id: 'da1', timestamp: '2026-05-24T06:12:00Z', action: 'Minted custom microcap coin *APEWAY', category: 'risk' },
            { id: 'da2', timestamp: '2026-05-24T06:14:00Z', action: 'Instantly crashed *APEWAY within 120 seconds for $15,000 profit', category: 'risk' }
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
      ]);
      onAddNotification(
        '🔄 Database Purged',
        'Administrator reset the entire simulated leaderboard profiles database to factory defaults.',
        'info'
      );
      alert('Simulated database restored successfully!');
    }
  };

  // Bug reports local real-time state and operations
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [isPruningBugs, setIsPruningBugs] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'bugs'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setBugReports(list);
    }, (err) => {
      console.error('Real-time bugs check failed. Storing offline/skipped:', err);
    });
    return () => unsub();
  }, []);

  const handleToggleBugStatus = async (bugId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'open' ? 'resolved' : 'open';
      const ref = doc(db, 'bugs', bugId);
      await updateDoc(ref, { status: nextStatus });
      onAddNotification('Status Updated', `Bug report marked as ${nextStatus}!`, 'info');
    } catch (e: any) {
      alert('Failed to update status: ' + e?.message);
    }
  };

  const handleDeleteBugReport = async (bugId: string) => {
    try {
      await deleteDoc(doc(db, 'bugs', bugId));
      onAddNotification('Bug Deleted', 'Bug report removed of active Firestore database slot.', 'info');
    } catch (e: any) {
      alert('Failed to delete bug report: ' + e?.message);
    }
  };

  const handlePruneResolvedBugs = async () => {
    setIsPruningBugs(true);
    try {
      const resolvedList = bugReports.filter(b => b.status === 'resolved');
      if (resolvedList.length === 0) {
        alert('There is no resolved bugs to prune.');
        return;
      }
      const batch = writeBatch(db);
      resolvedList.forEach(bug => {
        batch.delete(doc(db, 'bugs', bug.id));
      });
      await batch.commit();
      onAddNotification('Pruned Database', `Successfully erased ${resolvedList.length} resolved bug reports from storage!`, 'info');
    } catch (e: any) {
      alert('Failed to prune resolved bugs: ' + e?.message);
    } finally {
      setIsPruningBugs(false);
    }
  };

  const handlePruneAllBugs = async () => {
    setIsPruningBugs(true);
    try {
      const batch = writeBatch(db);
      bugReports.forEach(bug => {
        batch.delete(doc(db, 'bugs', bug.id));
      });
      await batch.commit();
      onAddNotification('Wiped Database', 'All bug reports completely cleared to restore maximum free storage space.', 'info');
    } catch (e: any) {
      alert('Failed to wipe bugs: ' + e?.message);
    } finally {
      setIsPruningBugs(false);
    }
  };

  // Modify money state
  const handleUserCashDose = (playerHandle: string, isUser: boolean, isAddition: boolean) => {
    const deltaStr = userMoneyDelta[playerHandle];
    const val = deltaStr !== undefined && !isNaN(Number(deltaStr)) ? Math.max(0, Number(deltaStr)) : 10000;
    
    if (isUser) {
      onUpdateStats((stats) => {
        if (isAddition) {
          stats.cash += val;
        } else {
          stats.cash = Math.max(0, stats.cash - val);
        }
      });
      onAddNotification(
        '💸 Balance Adjusted',
        `Your active cash reserves were forcefully ${isAddition ? 'increased' : 'decreased'} by $${val.toLocaleString()}.`,
        'achievement'
      );

      // Log to system audit
      setLocalUserLogs(prev => [
        {
          id: 'adj_' + Date.now(),
          timestamp: new Date().toISOString(),
          action: `Admin adjusted balance: ${isAddition ? 'Added' : 'Subtracted'} $${val.toLocaleString()} cash`,
          category: 'system' as const
        },
        ...prev
      ]);
    } else {
      // Sync with real registered users in Firestore
      const targetRegUser = registeredUsers.find(r => r.handle === playerHandle);
      if (targetRegUser) {
        const docRef = doc(db, 'users', targetRegUser.uid);
        const prevCash = targetRegUser.cash ?? 5000;
        const newCash = isAddition ? prevCash + val : Math.max(0, prevCash - val);
        
        const auditEntry = {
          id: 'adj_' + Date.now(),
          timestamp: new Date().toISOString(),
          action: `System adjusted balance: ${isAddition ? 'Added' : 'Subtracted'} $${val.toLocaleString()} cash`,
          category: 'system' as const
        };
        
        const updatedLog = [auditEntry, ...(targetRegUser.activityLog || [])];
        
        updateDoc(docRef, {
          cash: newCash,
          activityLog: updatedLog
        }).then(() => {
          onAddNotification(
            '💸 Balance Adjusted',
            `Registered participant ${playerHandle}'s active reserves modified: ${isAddition ? 'Added' : 'Subtracted'} $${val.toLocaleString()}`,
            'achievement'
          );
        }).catch(err => {
          console.error('Error adjusting registered user money in Firestore:', err);
          handleFirestoreError(err, OperationType.UPDATE, `users/${targetRegUser.uid}`);
        });
        return;
      }

      if (setSimulatedPlayers) {
        setSimulatedPlayers((current) =>
          current.map((p) => {
            if (p.handle === playerHandle) {
              const prevProfit = p.profit;
              const newProfit = isAddition ? prevProfit + val : Math.max(0, prevProfit - val);
              const auditEntry = {
                id: 'adj_' + Date.now(),
                timestamp: new Date().toISOString(),
                action: `${isAddition ? 'Resource grant' : 'Resource deduction'}: operator adjusted total profit value by $${val.toLocaleString()}`,
                category: 'system' as const
              };
              return { 
                ...p, 
                profit: newProfit,
                activityLog: [auditEntry, ...(p.activityLog || [])]
              };
            }
            return p;
          })
        );
        onAddNotification(
          '⚡ Player Modified',
          `Sandbox player ${playerHandle}'s total profit was ${isAddition ? 'boosted' : 'docked'} by $${val.toLocaleString()}`,
          'info'
        );
      }
    }
  };

  // Modify gems state
  const handleUserGemsDose = (playerHandle: string, isUser: boolean, isAddition: boolean) => {
    const deltaStr = userGemsDelta[playerHandle];
    const val = deltaStr !== undefined && !isNaN(Number(deltaStr)) ? Math.max(0, Number(deltaStr)) : 100;
    
    if (isUser) {
      onUpdateStats((stats) => {
        if (isAddition) {
          stats.gems += val;
        } else {
          stats.gems = Math.max(0, stats.gems - val);
        }
      });
      onAddNotification(
        '💎 Gems Adjusted',
        `Your active gem reserves were forcefully ${isAddition ? 'increased' : 'decreased'} by 💎 ${val.toLocaleString()}.`,
        'achievement'
      );

      // Log to system audit
      setLocalUserLogs(prev => [
        {
          id: 'gems_adj_' + Date.now(),
          timestamp: new Date().toISOString(),
          action: `Admin adjusted balance: ${isAddition ? 'Added' : 'Subtracted'} 💎 ${val.toLocaleString()} gems`,
          category: 'system' as const
        },
        ...prev
      ]);
    } else {
      // Sync with real registered users in Firestore
      const targetRegUser = registeredUsers.find(r => r.handle === playerHandle);
      if (targetRegUser) {
        const docRef = doc(db, 'users', targetRegUser.uid);
        const prevGems = targetRegUser.gems ?? 250;
        const newGems = isAddition ? prevGems + val : Math.max(0, prevGems - val);
        
        const auditEntry = {
          id: 'gems_adj_' + Date.now(),
          timestamp: new Date().toISOString(),
          action: `System adjusted gems: ${isAddition ? 'Added' : 'Subtracted'} 💎 ${val.toLocaleString()} gems`,
          category: 'system' as const
        };
        
        const updatedLog = [auditEntry, ...(targetRegUser.activityLog || [])];
        
        updateDoc(docRef, {
          gems: newGems,
          activityLog: updatedLog
        }).then(() => {
          onAddNotification(
            '💎 Gems Adjusted',
            `Registered participant ${playerHandle}'s gem reserves modified: ${isAddition ? 'Added' : 'Subtracted'} 💎 ${val.toLocaleString()}`,
            'achievement'
          );
        }).catch(err => {
          console.error('Error adjusting registered user gems in Firestore:', err);
          handleFirestoreError(err, OperationType.UPDATE, `users/${targetRegUser.uid}`);
        });
        return;
      }

      // If simulated player
      if (setSimulatedPlayers) {
        onAddNotification(
          '⚡ Player Modified',
          `Sandbox player ${playerHandle}'s total simulated gems was ${isAddition ? 'increased' : 'decreased'} by 💎 ${val.toLocaleString()}`,
          'info'
        );
      }
    }
  };

  // Toggle user suspension / state banning
  const handleToggleSuspension = (playerHandle: string, isUser: boolean) => {
    if (isUser) {
      alert('❌ SYSTEM ERROR:\n\nYou are strictly forbidden from suspending your own administrative main-thread account.');
      return;
    }
    
    // Calculate expiry based on duration selector
    const expiryTime = Date.now() + suspendDurationDays * 24 * 60 * 60 * 1000;

    // Check if it matches a real registered participant in Firestore
    const targetRegUser = registeredUsers.find(r => r.handle === playerHandle);
    if (targetRegUser) {
      const docRef = doc(db, 'users', targetRegUser.uid);
      const isNowSuspended = !targetRegUser.isSuspended;
      const auditEntry = {
        id: 'susp_' + Date.now(),
        timestamp: new Date().toISOString(),
        action: isNowSuspended ? `Account suspended for ${suspendDurationDays} days` : 'Temporary suspension lifted by operator override action',
        category: 'system' as const
      };
      
      const updatedLog = [auditEntry, ...(targetRegUser.activityLog || [])];
      
      updateDoc(docRef, {
        isSuspended: isNowSuspended,
        suspendedUntil: isNowSuspended ? expiryTime : null,
        activityLog: updatedLog
      }).then(() => {
        const logHeader = isNowSuspended ? '🚫 Participant Suspended' : '✅ Participant Reinstated';
        const logBody = isNowSuspended 
          ? `Registered user ${playerHandle} has been suspended for ${suspendDurationDays} days.`
          : `Registered user ${playerHandle}'s temporary suspension privileges were restored by administrator.`;
        onAddNotification(logHeader, logBody, isNowSuspended ? 'crash' : 'trade');
      }).catch(err => {
        console.error('Error suspending registered user in Firestore:', err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${targetRegUser.uid}`);
      });
      return;
    }

    if (setSimulatedPlayers) {
      let isNowSuspended = false;

      setSimulatedPlayers((current) =>
        current.map((p) => {
          if (p.handle === playerHandle) {
            isNowSuspended = !p.isSuspended;
            const auditEntry = {
              id: 'susp_' + Date.now(),
              timestamp: new Date().toISOString(),
              action: isNowSuspended ? `Account suspended for ${suspendDurationDays} days` : 'Temporary suspension lifted by operator manual override action',
              category: 'system' as const
            };
            return { 
              ...p, 
              isSuspended: isNowSuspended,
              suspendedUntil: isNowSuspended ? expiryTime : null,
              activityLog: [auditEntry, ...(p.activityLog || [])]
            };
          }
          return p;
        })
      );

      const logHeader = isNowSuspended ? '🚫 Play Account Suspended' : '✅ Play Account Reinstated';
      const logBody = isNowSuspended 
        ? `Player ${playerHandle} has been suspended for ${suspendDurationDays} days.`
        : `Player ${playerHandle}'s temporary suspension privileges were fully restored by system owner action.`;

      onAddNotification(logHeader, logBody, isNowSuspended ? 'crash' : 'trade');
    }
  };

  // Toggle user permanent ban (can also be lifted by operator)
  const handleToggleBan = (playerHandle: string, isUser: boolean) => {
    if (isUser) {
      alert('❌ SYSTEM ERROR:\n\nYou are strictly forbidden from banning your own administrative main-thread account.');
      return;
    }
    
    // Check if it matches a real registered participant in Firestore
    const targetRegUser = registeredUsers.find(r => r.handle === playerHandle);
    if (targetRegUser) {
      const docRef = doc(db, 'users', targetRegUser.uid);
      const isNowBanned = !targetRegUser.isBanned;
      const auditEntry = {
        id: 'ban_' + Date.now(),
        timestamp: new Date().toISOString(),
        action: isNowBanned ? 'Account permanently banned by operator manual override' : 'Permanent ban lifted by operator override action',
        category: 'system' as const
      };
      
      const updatedLog = [auditEntry, ...(targetRegUser.activityLog || [])];
      
      updateDoc(docRef, {
        isBanned: isNowBanned,
        activityLog: updatedLog
      }).then(() => {
        const logHeader = isNowBanned ? '💀 Participant Banned (Perm)' : '✅ Ban Lifted';
        const logBody = isNowBanned 
          ? `Registered user ${playerHandle} has been permanently banned from the simulation.`
          : `Registered user ${playerHandle}'s permanent ban was lifted by administrator.`;
        onAddNotification(logHeader, logBody, isNowBanned ? 'crash' : 'trade');
      }).catch(err => {
        console.error('Error banning registered user in Firestore:', err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${targetRegUser.uid}`);
      });
      return;
    }

    if (setSimulatedPlayers) {
      let isNowBanned = false;

      setSimulatedPlayers((current) =>
        current.map((p) => {
          if (p.handle === playerHandle) {
            isNowBanned = !p.isBanned;
            const auditEntry = {
              id: 'ban_' + Date.now(),
              timestamp: new Date().toISOString(),
              action: isNowBanned ? 'Account permanently banned by operator manual override' : 'Permanent ban lifted by operator manual override action',
              category: 'system' as const
            };
            return { 
              ...p, 
              isBanned: isNowBanned,
              activityLog: [auditEntry, ...(p.activityLog || [])]
            };
          }
          return p;
        })
      );

      const logHeader = isNowBanned ? '💀 Play Account Banned (Perm)' : '✅ Ban Lifted';
      const logBody = isNowBanned 
        ? `Player ${playerHandle} has been permanently banned due to system security violations.`
        : `Player ${playerHandle}'s permanent ban was fully lifted by system owner action.`;

      onAddNotification(logHeader, logBody, isNowBanned ? 'crash' : 'trade');
    }
  };

  // Toggle admin promotion
  const handleToggleAdminStatus = (playerHandle: string, isUser: boolean) => {
    if (playerHandle === '@zeke') {
      onAddNotification('❌ Access Denied', 'God-tier Whales cannot be stripped of their privileges.', 'crash');
      return;
    }
    if (isUser) {
      onUpdateStats((stats) => {
        const isCurrentAdmin = stats.title.toLowerCase() === 'admin' || stats.title.toLowerCase() === 'owner';
        stats.title = isCurrentAdmin ? 'Member' : 'Admin';
      });
      onAddNotification(
        '🛡️ Roster Promoted',
        `Your user privileges were changed. Your title is now toggled.`,
        'achievement'
      );
      setLocalUserLogs(prev => [
        {
          id: 'admin_' + Date.now(),
          timestamp: new Date().toISOString(),
          action: `Toggled user privileges structure. New state is now saved.`,
          category: 'auth' as const
        },
        ...prev
      ]);
    } else {
      // Update real registered user role in Firestore
      const targetRegUser = registeredUsers.find(r => r.handle === playerHandle);
      if (targetRegUser) {
        const docRef = doc(db, 'users', targetRegUser.uid);
        const isNowAdmin = !targetRegUser.isAdmin;
        const auditEntry = {
          id: 'admin_' + Date.now(),
          timestamp: new Date().toISOString(),
          action: isNowAdmin ? 'Granted full operational Administrator permissions tag' : 'Stripped Administrator operational permissions tag',
          category: 'auth' as const
        };
        const updatedLog = [auditEntry, ...(targetRegUser.activityLog || [])];
        updateDoc(docRef, {
          isAdmin: isNowAdmin,
          title: isNowAdmin ? 'Admin' : 'Member',
          activityLog: updatedLog
        }).then(() => {
          const logHeader = isNowAdmin ? '🛡️ Administrator Added' : '🛡️ Admin Privilege Stripped';
          const logBody = isNowAdmin 
            ? `Registered user ${playerHandle} has been granted administrative capabilities.`
            : `Registered user ${playerHandle} has been stripped of administrator permissions.`;
          onAddNotification(logHeader, logBody, 'info');
        }).catch(err => {
          console.error('Error updating admin status in Firestore:', err);
          handleFirestoreError(err, OperationType.UPDATE, `users/${targetRegUser.uid}`);
        });
        return;
      }

      if (setSimulatedPlayers) {
        let isNowAdmin = false;
        setSimulatedPlayers((current) =>
          current.map((p) => {
            if (p.handle === playerHandle) {
              isNowAdmin = !p.isAdmin;
              const auditEntry = {
                id: 'admin_' + Date.now(),
                timestamp: new Date().toISOString(),
                action: isNowAdmin ? 'Granted full operational Administrator permissions tag' : 'Stripped Administrator operational permissions tag',
                category: 'auth' as const
              };
              return { 
                ...p, 
                isAdmin: isNowAdmin,
                title: isNowAdmin ? 'Admin' : (p.prestige >= 5 ? 'Whale Dev' : 'Degen'),
                activityLog: [auditEntry, ...(p.activityLog || [])]
              };
            }
            return p;
          })
        );

        const logHeader = isNowAdmin ? '🛡️ Administrator Added' : '🛡️ Admin Privilege Stripped';
        const logBody = isNowAdmin 
          ? `Simulated user ${playerHandle} has been granted administrative capabilities.`
          : `Simulated user ${playerHandle} has been stripped of administrator permissions.`;

        onAddNotification(logHeader, logBody, 'info');
      }
    }
  };

  // Mint instant resources (Cash/Gems self adjustments)
  const handleMintCash = () => {
    onUpdateStats((stats) => {
      stats.cash += customCash;
    });
    onAddNotification(
      '💸 Owner Resource Mint',
      `Minted $${customCash.toLocaleString()} cash from central reserve.`,
      'achievement'
    );
  };

  const handleMintGems = () => {
    onUpdateStats((stats) => {
      stats.gems += customGems;
    });
    onAddNotification(
      '💎 Owner Resource Mint',
      `Minted ${customGems} gems directly to your profile.`,
      'achievement'
    );
  };

  // Run instant 50% pumped price on all active coins
  const handleForceGlobalPump = () => {
    setCoins((prevCoins) =>
      prevCoins.map((coin) => {
        if (false) return coin;
        const newPrice = coin.price * 1.5;
        const newHistory = [...coin.history, newPrice].slice(-24);
        return {
          ...coin,
          price: newPrice,
          history: newHistory,
          change24h: coin.change24h + 50,
        };
      })
    );
    onAddNotification(
      '📈 Market Overdrive',
      'System administrators forced a global +50% price rally across all active tokens!',
      'info'
    );
  };

  // Run instant 50% crash on all active coins
  const handleForceGlobalDump = () => {
    setCoins((prevCoins) =>
      prevCoins.map((coin) => {
        if (false) return coin;
        const newPrice = Math.max(0.0001, coin.price * 0.5);
        const newHistory = [...coin.history, newPrice].slice(-24);
        return {
          ...coin,
          price: newPrice,
          history: newHistory,
          change24h: coin.change24h - 50,
        };
      })
    );
    onAddNotification(
      '📉 Market Demolition',
      'ALERT: System administrators caused a global -50% flash crash!',
      'crash'
    );
  };

  // Force crash pull on a specific coin
  const handleForcedelist = (coinId: string) => {
    const coin = coins.find(c => c.id === coinId);
    if (!coin || false) return;

    setCoins((prevCoins) =>
      prevCoins.map((c) => {
        if (c.id === coinId) {
          return {
            ...c,
            price: 0,
            iscrashed: true,
            history: [...c.history, 0].slice(-24),
          };
        }
        return c;
      })
    );
    
    onAddNotification(
      '💀 INSTANT delist DETECTED',
      `The creator of *${coin.symbol} has drained 100% of the liquidity pool! Token is now worthless.`,
      'crash'
    );
  };

  // Double market capital of a specific coin
  const handleForcePumpSingle = (coinId: string) => {
    const coin = coins.find(c => c.id === coinId);
    if (!coin || false) return;

    setCoins((prevCoins) =>
      prevCoins.map((c) => {
        if (c.id === coinId) {
          const newPrice = c.price * 2.0;
          return {
            ...c,
            price: newPrice,
            history: [...c.history, newPrice].slice(-24),
            change24h: c.change24h + 100,
          };
        }
        return c;
      })
    );

    onAddNotification(
      '🚀 FORCE MULTIPLIER',
      `Admin initiated vertical vector: *${coin.symbol} has been forcefully doubled in market value!`,
      'trade'
    );
  };

  // Dispatch live custom announcement
  const handleDispatchAnnouncement = async () => {
    if (!alertTitle.trim() || !alertMsg.trim()) return;
    
    const broadcastId = 'broadcast_' + Date.now();
    const expiresAt = broadcastTimeLimit > 0 
      ? new Date(Date.now() + broadcastTimeLimit * 60000).toISOString() 
      : undefined;

    const payload = {
      id: broadcastId,
      title: alertTitle.trim(),
      message: alertMsg.trim(),
      type: alertType,
      timestamp: new Date().toISOString(),
      ...(expiresAt ? { expiresAt } : {})
    };

    try {
      await setDoc(doc(db, 'broadcasts', broadcastId), payload);
      onAddNotification(
        '📢 Broadcast Broadcasted',
        `Successfully dispatched system bulletin: "${alertTitle.trim()}" to all online participants.`,
        'achievement'
      );
      setAlertTitle('');
      setAlertMsg('');
    } catch (err: any) {
      console.error('Error dispatching global broadcast to Firestore:', err);
      handleFirestoreError(err, OperationType.WRITE, `broadcasts/${broadcastId}`);
    }
  };

  // 🎰 Casino / Coinflip Rigging Toggle
  const handleToggleCasinoRigged = () => {
    onUpdateStats((stats) => {
      stats.isCasinoRigged = !stats.isCasinoRigged;
    });
    onAddNotification(
      '🎰 Casino Algorithm Modified',
      `Administrative override toggled Coinflip & Chest rig mapping to: ${!userStats.isCasinoRigged ? 'GUARANTEED WIN (RIGGED)' : 'NATURAL STATISTICAL RANDOM'}`,
      'info'
    );
  };

  // 💥 Black Swan Bot Raids Action
  const handleTriggerBotRaid = async () => {
    if (!botRaidCoinId) {
      alert('Please select a target coin to execute bot raid on!');
      return;
    }
    const targetCoin = coins.find(c => c.id === botRaidCoinId);
    if (!targetCoin) return;

    setBotRaidIsRunning(true);
    try {
      const multiplier = botRaidDirection === 'BUY' ? 4.8 : 0.08;
      const finalPrice = Number((targetCoin.price * multiplier).toFixed(7));
      const calculated24h = botRaidDirection === 'BUY' ? targetCoin.change24h + 380 : targetCoin.change24h - 92;
      const nextHistory = [...targetCoin.history, finalPrice].slice(-24);
      const volumeAdd = 150000;

      // Sync target coin in Firestore
      const coinRef = doc(db, 'coins', botRaidCoinId);
      await updateDoc(coinRef, {
        price: finalPrice,
        marketCap: Math.floor(targetCoin.supply * finalPrice),
        history: nextHistory,
        volume24h: targetCoin.volume24h + volumeAdd,
        change24h: calculated24h
      });

      // Local State Update
      setCoins((prevCoins) =>
        prevCoins.map((c) => {
          if (c.id === botRaidCoinId) {
            return {
              ...c,
              price: finalPrice,
              marketCap: Math.floor(c.supply * finalPrice),
              volume24h: c.volume24h + volumeAdd,
              change24h: calculated24h,
              history: nextHistory
            };
          }
          return c;
        })
      );

      // Trigger standard raid announcement
      onAddNotification(
        `💥 BOT RAID ACTIVE: *${targetCoin.symbol}`,
        `50 automated Bot traders initiated massive coordinated high-frequency orders executing ${botRaidDirection === 'BUY' ? 'aggressive accumulation' : 'extreme bulk liquidations'}! Valuation updated instantly to $${finalPrice.toLocaleString('en-US')}`,
        botRaidDirection === 'BUY' ? 'trade' : 'crash'
      );

      alert(`💥 ALGORITHMIC BOT RAID COMPLETED!\n\nTarget Coin: *${targetCoin.symbol}\nDirection: ${botRaidDirection}\nResult: Price shifted from $${targetCoin.price} to $${finalPrice} (${botRaidDirection === 'BUY' ? 'PUMPED +380%' : 'DUMPED -92%'})!`);
    } catch (e: any) {
      console.error('Bot Raid update error:', e);
      alert(`⚠️ Firebase Sync Error: ${e?.message || e}. Applied local updates only.`);
      
      setCoins((prevCoins) =>
        prevCoins.map((c) => {
          if (c.id === botRaidCoinId) {
            const multiplier = botRaidDirection === 'BUY' ? 4.8 : 0.08;
            const finalPrice = Number((c.price * multiplier).toFixed(7));
            const calculated24h = botRaidDirection === 'BUY' ? c.change24h + 380 : c.change24h - 92;
            const nextHistory = [...c.history, finalPrice].slice(-24);
            return {
              ...c,
              price: finalPrice,
              marketCap: Math.floor(c.supply * finalPrice),
              volume24h: c.volume24h + 150000,
              change24h: calculated24h,
              history: nextHistory
            };
          }
          return c;
        })
      );
    } finally {
      setBotRaidIsRunning(false);
    }
  };

  // 🌟 Toggle Premium Rainbow Cosmetics
  const handleToggleRainbowCosmetics = () => {
    onUpdateStats((stats) => {
      stats.rainbowCosmetics = !stats.rainbowCosmetics;
    });
    onAddNotification(
      '🌈 Cosmetics Upgraded',
      `Toggled dynamic rainbow neon animated name badge cosmetics on your profile footer!`,
      'achievement'
    );
  };

  // 🛡️ Set Custom Admin Badge Text
  const handleUpdateAdminBadge = () => {
    const text = customBadgeText.trim();
    onUpdateStats((stats) => {
      stats.customAdminBadge = text || undefined;
    });
    onAddNotification(
      '🛡️ Identity Aura Adjusted',
      `Successfully loaded custom administrator tag: [${text || 'Removed Badge'}] on username template.`,
      'info'
    );
    alert(`🛡️ BADGE UPDATED!\n\nModified profile badge tag to: "${text || 'DISABLED'}"`);
  };

  // 🧹 Firestore Space Cleanup & Collection Purger
  const handleClearDatabaseCollection = async (colName: 'trades' | 'coins' | 'markets') => {
    if (!confirm(`🚨 DATABASE CONSTRAINTS WARNING 🚨\n\nAre you sure you want to completely PURGE all records in the Firestore "${colName.toUpperCase()}" collection to reclaim sandbox space?\n\nThis will permanently delete listings/records from Firestore immediately! There is no recovery.`)) {
      return;
    }

    setIsPurgingDatabase(true);
    try {
      const querySnapshot = await getDocs(collection(db, colName));
      const batch = writeBatch(db);
      let deletedCount = 0;

      querySnapshot.forEach((docSnap) => {
        // Prevent purging core system default listings so sandbox remains bootable
        if (colName === 'coins') {
          const defaultSymbols = ['ROAD', 'PUMP', 'FED', 'DOGE', 'SHIB', 'PEPE', 'WIF'];
          const sym = docSnap.data().symbol;
          if (defaultSymbols.includes(sym)) {
            return;
          }
        }

        batch.delete(docSnap.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      // Locally refresh coins list if coin listings were purged from Firestore
      if (colName === 'coins') {
        setCoins((prev) => prev.filter(c => ['ROAD', 'PUMP', 'FED', 'DOGE', 'SHIB', 'PEPE', 'WIF'].includes(c.symbol)));
      }

      onAddNotification(
        '🧹 Firestore Storage Purged',
        `Cleaned up ${deletedCount} documents inside Firestore collection "${colName}" to free up Firestore quotas.`,
        'info'
      );

      alert(`🧹 DB PURGE SUCCESSFUL!\n\nDeleted ${deletedCount} excess listing documents inside the "${colName.toUpperCase()}" collection! Server space and database structures optimised cleanly.`);
    } catch (e: any) {
      console.error('Clean Database Collection failure:', e);
      alert(`❌ Database Cleaning Failed: ${e?.message || e}`);
    } finally {
      setIsPurgingDatabase(false);
    }
  };

  // Combine database of active profile + simulated ones for admin list
  const rawSystemUsersList = [
    {
      name: `${userStats.username} (You)`,
      handle: userStats.handle,
      profit: userStats.totalProfit + (userStats.cash - 5000),
      cash: userStats.cash,
      gems: userStats.gems,
      prestige: userStats.prestigeLevel,
      title: userStats.title,
      isUser: true,
      isSuspended: !!userStats.isSuspended,
      isBanned: !!userStats.isBanned,
      isAdmin: userStats.title.toLowerCase() === 'owner' || userStats.title.toLowerCase() === 'admin',
      createdAt: userStats.createdAt || '2026-05-24T06:40:00Z',
      activityLog: [
        ...localUserLogs,
        ...(liveTrades
          ? liveTrades
              .filter(t => t.userHandle === userStats.handle)
              .map(t => ({
                id: t.id,
                timestamp: t.timestamp,
                action: `${t.type === 'BUY' ? 'Bought' : t.type === 'SELL' ? 'Sold' : t.type === 'CREATE' ? 'Created' : 'crashed'} *${t.coinSymbol || 'Asset'} coin for $${t.amountUsd.toLocaleString()}`,
                category: (t.type === 'CREATE' ? 'risk' as const : 'trade' as const)
              }))
          : [])
      ]
    },
    ...registeredUsers
      .filter(r => r.handle !== userStats.handle)
      .map(r => ({
        uid: r.uid,
        name: r.username,
        handle: r.handle,
        profit: (r.totalProfit ?? 0) + ((r.cash ?? 5000) - 5000),
        cash: r.cash ?? 5000,
        gems: r.gems ?? 250,
        prestige: r.prestigeLevel || 0,
        title: r.title || (r.isAdmin ? 'Admin' : 'Member'),
        isUser: false,
        isSuspended: !!r.isSuspended,
        isBanned: !!r.isBanned,
        isAdmin: !!r.isAdmin,
        createdAt: r.createdAt || '2026-05-24T06:40:00Z',
        activityLog: r.activityLog || []
      })),
    ...simulatedPlayers
      .filter(p => p.handle !== userStats.handle)
      .map(p => ({
      name: p.name,
      handle: p.handle,
      profit: p.profit,
      cash: p.profit + 5000,
      gems: 250,
      prestige: p.prestige,
      title: p.isAdmin ? 'Admin' : p.title,
      isUser: false,
      isSuspended: p.isSuspended,
      isBanned: !!p.isBanned,
      isAdmin: p.isAdmin,
      createdAt: p.createdAt || '2026-05-18T10:12:00Z',
      activityLog: p.activityLog || []
    }))
  ];

  // Deduplicate rawSystemUsersList by handle
  const seenSystemHandles = new Set<string>();
  const systemUsersList = [];
  for (const u of rawSystemUsersList) {
    if (u.handle) {
      if (!seenSystemHandles.has(u.handle)) {
        seenSystemHandles.add(u.handle);
        systemUsersList.push(u);
      }
    } else {
      systemUsersList.push(u);
    }
  }

  const filteredUsers = systemUsersList.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col gap-6 animate-fade-in text-zinc-100 font-mono">
      {/* Header banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.15)] text-red-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-rose-450 tracking-tight flex items-center gap-2">
              Owner Panel
              <span className="text-[10px] bg-red-950 border border-red-900/40 text-red-400 font-black tracking-widest px-2 py-0.5 rounded-full scale-90 uppercase animate-pulse">
                SYS ADMIN
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Simulated sandbox engine controllers & administrator level overrides</p>
          </div>
        </div>
        
        {/* Reset Database and other action button */}
        <button
          onClick={handleResetSimulatedDatabase}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-90 w-fit border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Purge Leaderboard state
        </button>
      </div>

      {/* --- TASK UPDATE: SYSTEM USER MANAGER SECTION --- */}
      <div className="bg-zinc-900/60 border border-rose-950/40 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-black text-sm text-indigo-400 uppercase tracking-wide">Registered Sandbox Profile Database</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Edit simulated balances, toggle admin tags, and suspend/unban players instantaneously</p>
            </div>
          </div>
          
          
          {/* Controls: search and suspension select */}
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="flex items-center gap-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 focus-within:border-amber-500/50">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <select 
                value={suspendDurationDays}
                onChange={(e) => setSuspendDurationDays(Number(e.target.value))}
                className="bg-transparent text-zinc-300 font-bold focus:outline-none appearance-none cursor-pointer"
              >
                <option value={1}>Suspend 1 Day</option>
                <option value={7}>Suspend 1 Week</option>
                <option value={30}>Suspend 1 Month</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search handles/roles..."
                className="bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-48 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Profiles Admin List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
          {filteredUsers.length === 0 ? (
            <div className="md:col-span-2 text-center py-8 text-xs text-zinc-650 bg-zinc-950/60 rounded-xl border border-zinc-800 border-dashed">
              No sandboxed players matching query.
            </div>
          ) : (
            filteredUsers.map((user) => {
              const deltaVal = userMoneyDelta[user.handle] || 10000;
              return (
                <div 
                  key={user.handle}
                  className={`p-4 rounded-xl border flex flex-col gap-3 transition-all relative overflow-hidden bg-zinc-950/40 ${
                    user.isBanned
                      ? 'border-dashed border-red-650 bg-red-950/15 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                      : user.isSuspended 
                        ? 'border-dashed border-amber-500/30 bg-amber-950/5' 
                        : user.isUser 
                          ? 'border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.05)]'
                          : 'border-zinc-850'
                  }`}
                >
                  {/* Row 1: Profile info */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-black truncate max-w-[130px] ${(user.isSuspended || user.isBanned) ? 'text-zinc-550 line-through' : 'text-zinc-100'}`}>
                          {user.name}
                        </span>
                        {user.isUser && (
                          <span className="text-[8px] bg-orange-950 border border-orange-900/60 text-orange-400 px-1 rounded-sm font-bold uppercase scale-90">
                            YOU
                          </span>
                        )}
                        {user.isAdmin && (
                          <span className="text-[8px] bg-indigo-950 border border-indigo-900/50 text-indigo-400 px-1 rounded-sm font-bold uppercase scale-90 flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" /> ADMIN
                          </span>
                        )}
                        {user.isSuspended && (
                          <span className="text-[8px] bg-amber-500/15 border border-amber-550/40 text-amber-400 px-1 rounded-sm font-bold uppercase scale-90">
                            SUSPENDED (TEMP)
                          </span>
                        )}
                        {user.isBanned && (
                          <span className="text-[8px] bg-red-500/20 border border-red-500/45 text-red-400 px-1 rounded-sm font-bold uppercase scale-90 flex items-center gap-0.5">
                            <Skull className="w-2.5 h-2.5 text-red-400" /> BANNED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono tracking-tight">{user.handle} • Rank role: <span className="font-bold text-zinc-400">{user.title}</span></span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-zinc-500">Net worth indicator</div>
                      <span className={`text-xs font-extrabold ${(user.isSuspended || user.isBanned) ? 'text-zinc-650 line-through' : user.profit >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                        ${user.profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Money Adjustment Controls */}
                  <div className="bg-zinc-950/80 rounded-lg p-2.5 border border-zinc-900 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Adjust Sim Balance</span>
                      <span className="text-[10px] text-zinc-400 font-bold">Qty: ${deltaVal.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Value"
                        value={userMoneyDelta[user.handle] || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          setUserMoneyDelta(prev => ({ ...prev, [user.handle]: val }));
                        }}
                        className="bg-zinc-900 border border-zinc-750 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 max-w-[80px] font-bold"
                      />
                      <button
                        onClick={() => handleUserCashDose(user.handle, user.isUser, true)}
                        className="flex-1 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 text-[10px] font-bold rounded flex items-center justify-center gap-0.5 active:scale-95 transition-all"
                      >
                        <Plus className="w-3 h-3" /> Add Money
                      </button>
                      <button
                        onClick={() => handleUserCashDose(user.handle, user.isUser, false)}
                        className="flex-1 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 text-[10px] font-bold rounded flex items-center justify-center gap-0.5 active:scale-95 transition-all"
                      >
                        <Minus className="w-3 h-3" /> Decrease Money
                      </button>
                    </div>
                  </div>

                  {/* Row 2.5: Gems Adjustment Controls */}
                  <div className="bg-zinc-950/80 rounded-lg p-2.5 border border-zinc-900 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-cyan-500 uppercase tracking-widest font-black">Adjust User Gems</span>
                      <span className="text-[10px] text-cyan-400 font-bold">Qty: 💎 {(userGemsDelta[user.handle] || 100).toLocaleString()}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Gems"
                        value={userGemsDelta[user.handle] || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          setUserGemsDelta(prev => ({ ...prev, [user.handle]: val }));
                        }}
                        className="bg-zinc-900 border border-zinc-750 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 max-w-[80px] font-bold"
                      />
                      <button
                        onClick={() => handleUserGemsDose(user.handle, user.isUser, true)}
                        className="flex-1 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 text-[10px] font-bold rounded flex items-center justify-center gap-0.5 active:scale-95 transition-all"
                      >
                        <Plus className="w-3 h-3" /> Add Gems
                      </button>
                      <button
                        onClick={() => handleUserGemsDose(user.handle, user.isUser, false)}
                        className="flex-1 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 text-[10px] font-bold rounded flex items-center justify-center gap-0.5 active:scale-95 transition-all"
                      >
                        <Minus className="w-3 h-3" /> Decrease Gems
                      </button>
                    </div>
                  </div>

                  {/* Row 3: Admin & Punishment commands */}
                  <div className="flex flex-col gap-2">
                    {/* Toggle Admin */}
                    <button
                      onClick={() => handleToggleAdminStatus(user.handle, user.isUser)}
                      disabled={user.handle === '@zeke'}
                      className={`w-full py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                        user.handle === '@zeke'
                          ? 'bg-zinc-900 border-zinc-800 text-zinc-700 opacity-50 cursor-not-allowed'
                          : user.isAdmin 
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white active:scale-95' 
                            : 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 hover:border-indigo-500/50 text-indigo-400 active:scale-95'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {user.isAdmin ? 'Strip Admin' : 'Make Admin'}
                    </button>

                    <div className="flex gap-2">
                      {/* Toggle Suspension (Only for simulated players, real user can't self-ban) */}
                      <button
                        onClick={() => handleToggleSuspension(user.handle, user.isUser)}
                        disabled={user.isUser}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                          user.isUser
                            ? 'bg-zinc-950 border-zinc-900 text-zinc-650 cursor-not-allowed font-medium'
                            : user.isSuspended
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400'
                              : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 hover:border-amber-500/50 text-amber-400'
                        }`}
                      >
                        {user.isSuspended ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Unsuspend
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            Suspend
                          </>
                        )}
                      </button>

                      {/* Toggle Ban (Only for simulated players, real user can't self-ban) */}
                      <button
                        onClick={() => handleToggleBan(user.handle, user.isUser)}
                        disabled={user.isUser}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                          user.isUser
                            ? 'bg-zinc-950 border-zinc-900 text-zinc-650 cursor-not-allowed font-medium'
                            : user.isBanned
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400'
                              : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 hover:border-red-500/50 text-red-0.5 text-red-400'
                        }`}
                      >
                        {user.isBanned ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Unban
                          </>
                        ) : (
                          <>
                            <Skull className="w-3.5 h-3.5" />
                            Ban
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Row 4: Collapsible Profile Details */}
                  <div className="flex flex-col gap-2 mt-1 border-t border-zinc-900/40 pt-2">
                    <button
                      onClick={() => setExpandedPlayerHandle(expandedPlayerHandle === user.handle ? null : user.handle)}
                      className={`w-full py-1.5 text-[9px] uppercase tracking-wider font-extrabold rounded-lg flex items-center justify-center gap-1 border transition-all ${
                        expandedPlayerHandle === user.handle
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.15)]'
                          : 'bg-zinc-950/85 border-zinc-900 text-zinc-550 hover:text-zinc-350 hover:bg-zinc-900'
                      }`}
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      {expandedPlayerHandle === user.handle ? 'Hide Details' : 'Inspect Profile Meta'}
                    </button>

                    {expandedPlayerHandle === user.handle && (
                      <div className="bg-zinc-950/90 border border-zinc-900 rounded-lg p-3 text-[11px] flex flex-col gap-2.5 animate-fade-in">
                        <div className="flex items-center gap-1.5 text-zinc-400 font-bold border-b border-zinc-900 pb-1.5 justify-between">
                          <div className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase tracking-widest font-black">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>Registered:</span>
                          </div>
                          <span className="text-amber-400 font-mono text-[9.5px]">{formatDate(user.createdAt)}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-zinc-400 font-bold border-b border-zinc-900 pb-1.5 justify-between">
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                            <Coins className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                            <span>Active Cash Balance:</span>
                          </div>
                          <span className="text-emerald-400 font-mono text-[10px]">${(user.cash !== undefined ? user.cash : 5000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-zinc-400 font-bold border-b border-zinc-900 pb-1.5 justify-between">
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Active Gems Balance:</span>
                          </div>
                          <span className="text-cyan-400 font-mono text-[10px]">💎 {(user.gems !== undefined ? user.gems : 250).toLocaleString()}</span>
                        </div>

                        <div className="border-t border-zinc-900 pt-2 flex flex-col gap-1.5">
                          <span className="text-[9px] uppercase tracking-widest text-zinc-550 font-black">Dispatch Custom Action Notice</span>
                          <div className="flex gap-1.5">
                            <input 
                              type="text"
                              placeholder="Insert simulated admin notice..."
                              value={customActionTexts[user.handle] || ''}
                              onChange={(e) => setCustomActionTexts(prev => ({ ...prev, [user.handle]: e.target.value }))}
                              className="flex-1 bg-zinc-900 border border-zinc-850 rounded px-2 py-1 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const text = (customActionTexts[user.handle] || '').trim();
                                  if (!text) return;
                                  const auditEntry = {
                                    id: 'manual_' + Date.now(),
                                    timestamp: new Date().toISOString(),
                                    action: text,
                                    category: 'system' as const
                                  };

                                  const targetRegUser = registeredUsers.find(r => r.handle === user.handle);
                                  if (targetRegUser) {
                                    const docRef = doc(db, 'users', targetRegUser.uid);
                                    const updatedLog = [auditEntry, ...(targetRegUser.activityLog || [])];
                                    updateDoc(docRef, {
                                      activityLog: updatedLog
                                    }).then(() => {
                                      onAddNotification(
                                        '📝 Manual Audit Log Attached',
                                        `Successfully wrote manual audit record to player directory entry for ${user.handle}`,
                                        'info'
                                      );
                                    }).catch(err => {
                                      console.error('Error writing manual audit log:', err);
                                      handleFirestoreError(err, OperationType.UPDATE, `users/${targetRegUser.uid}`);
                                    });
                                  } else if (user.isUser) {
                                    setLocalUserLogs(prev => [auditEntry, ...prev]);
                                    onUpdateStats(stats => {
                                      stats.activityLog = [auditEntry, ...(stats.activityLog || [])];
                                    });
                                  } else {
                                    if (setSimulatedPlayers) {
                                      setSimulatedPlayers((current) =>
                                        current.map((p) => {
                                          if (p.handle === user.handle) {
                                            return { 
                                              ...p, 
                                              activityLog: [auditEntry, ...(p.activityLog || [])] 
                                            };
                                          }
                                          return p;
                                        })
                                      );
                                    }
                                  }
                                  onAddNotification(
                                    '📝 Manual Audit Log Attached',
                                    `Successfully wrote manual audit record to player directory entry for ${user.handle}`,
                                    'info'
                                  );
                                  setCustomActionTexts(prev => ({ ...prev, [user.handle]: '' }));
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const text = (customActionTexts[user.handle] || '').trim();
                                if (!text) return;
                                const auditEntry = {
                                  id: 'manual_' + Date.now(),
                                  timestamp: new Date().toISOString(),
                                  action: text,
                                  category: 'system' as const
                                };

                                const targetRegUser = registeredUsers.find(r => r.handle === user.handle);
                                if (targetRegUser) {
                                  const docRef = doc(db, 'users', targetRegUser.uid);
                                  const updatedLog = [auditEntry, ...(targetRegUser.activityLog || [])];
                                  updateDoc(docRef, {
                                    activityLog: updatedLog
                                  }).then(() => {
                                    onAddNotification(
                                      '📝 Manual Audit Log Attached',
                                      `Successfully wrote manual audit record to player directory entry for ${user.handle}`,
                                      'info'
                                    );
                                  }).catch(err => {
                                    console.error('Error writing manual audit log:', err);
                                    handleFirestoreError(err, OperationType.UPDATE, `users/${targetRegUser.uid}`);
                                  });
                                } else if (user.isUser) {
                                  setLocalUserLogs(prev => [auditEntry, ...prev]);
                                  onUpdateStats(stats => {
                                    stats.activityLog = [auditEntry, ...(stats.activityLog || [])];
                                  });
                                } else {
                                  if (setSimulatedPlayers) {
                                    setSimulatedPlayers((current) =>
                                      current.map((p) => {
                                        if (p.handle === user.handle) {
                                          return { 
                                            ...p, 
                                            activityLog: [auditEntry, ...(p.activityLog || [])] 
                                          };
                                        }
                                        return p;
                                      })
                                    );
                                  }
                                }
                                onAddNotification(
                                  '📝 Manual Audit Log Attached',
                                  `Successfully wrote manual audit record to player directory entry for ${user.handle}`,
                                  'info'
                                );
                                setCustomActionTexts(prev => ({ ...prev, [user.handle]: '' }));
                              }}
                              className="px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-[9px] rounded flex items-center justify-center transition-all active:scale-95 shrink-0"
                            >
                              Write
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recommended Next-Level Owner Powers (Now Fully Coordinated & Operational!) */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-amber-500/20 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider leading-tight">
                👑 Super-Operator Administrative Control Suite
              </h3>
              <p className="text-[10px] text-zinc-500 block font-mono">
                Real-time overrides, algorithmic rigging, and Firestore storage cleanup maintenance.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[8px] font-mono uppercase tracking-widest font-black place-self-start md:place-self-center">
            ACTIVE LEVEL 5 OPERATOR
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono text-xs">
          {/* Power 1: Rigged Casino Rates */}
          <div className="flex flex-col gap-3 p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl hover:border-amber-500/10 transition-colors">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold uppercase tracking-wide">
              <span>🎰 Rig Casino / Cases</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed min-h-[32px]">
              Forces 100% win-rates on Coinflip bets and grants maximum payout cash/gems drops from mystery crates!
            </p>
            <button
              onClick={handleToggleCasinoRigged}
              className={`w-full py-2.5 rounded-lg border font-black uppercase text-[10px] tracking-wider transition-all active:scale-97 select-none ${
                userStats.isCasinoRigged
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              ⚡ Status: {userStats.isCasinoRigged ? 'FULLY RIGGED (ALWAYS WIN!)' : 'NORMAL (50/50 STATISTICAL RANDOM)'}
            </button>
          </div>

          {/* Power 2: Black Swan Bot Raids */}
          <div className="flex flex-col gap-3 p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl hover:border-amber-500/10 transition-colors">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold uppercase tracking-wide">
              <span>💥 Black Swan Bot Raids</span>
            </div>
            <div className="text-[11px] text-zinc-500 leading-relaxed min-h-[32px] flex flex-col gap-2">
              <span>Simulate instant high-frequency orders on a selected coin to pump (+380%) or crash (-92%) candles:</span>
              <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                <select
                  value={botRaidCoinId}
                  onChange={(e) => setBotRaidCoinId(e.target.value)}
                  className="col-span-1 border bg-zinc-950 border-zinc-800 rounded px-1.5 py-1 text-[10px] text-zinc-350 focus:outline-none focus:border-amber-500 max-w-full truncate font-bold"
                >
                  <option value="">-- Choose Coin --</option>
                  {coins.map(c => (
                    <option key={c.id} value={c.id}>{c.symbol} (${c.price.toFixed(4)})</option>
                  ))}
                </select>
                <select
                  value={botRaidDirection}
                  onChange={(e) => setBotRaidDirection(e.target.value as 'BUY' | 'SELL')}
                  className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[10px] text-zinc-350 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="BUY">PUMP (BUY)</option>
                  <option value="SELL">DUMP (SELL)</option>
                </select>
                <button
                  onClick={handleTriggerBotRaid}
                  disabled={botRaidIsRunning || !botRaidCoinId}
                  className="bg-amber-550 text-black hover:bg-amber-400 disabled:opacity-45 disabled:pointer-events-none transition-all font-black text-[9px] uppercase tracking-wider rounded px-2 select-none"
                >
                  {botRaidIsRunning ? 'Raid...' : 'Raid!'}
                </button>
              </div>
            </div>
          </div>

          {/* Power 3: Custom Premium Cosmetics */}
          <div className="flex flex-col gap-3 p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl hover:border-amber-500/10 transition-colors">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold uppercase tracking-wide">
              <span>🌟 Custom Premium Cosmetics</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed min-h-[32px]">
              Toggle animated multi-color neon profiles on the sidebar or attach operational identity titles.
            </p>
            <div className="flex gap-2.5 mt-auto">
              <button
                onClick={handleToggleRainbowCosmetics}
                className={`flex-1 py-1.5 px-3 rounded text-[9.5px] uppercase font-bold border transition-colors ${
                  userStats.rainbowCosmetics
                    ? 'bg-rose-500/10 border-rose-500/35 text-rose-455'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                🌈 Rainbow: {userStats.rainbowCosmetics ? 'ON' : 'OFF'}
              </button>
              <div className="flex flex-1 gap-1">
                <input
                  type="text"
                  maxLength={10}
                  value={customBadgeText}
                  onChange={(e) => setCustomBadgeText(e.target.value.toUpperCase())}
                  placeholder="BADGE"
                  className="w-16 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleUpdateAdminBadge}
                  className="bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 font-bold px-2 rounded text-[10px] uppercase tracking-wider"
                >
                  Set
                </button>
              </div>
            </div>
          </div>

          {/* Power 4: Clear Database Space Cleanup Maintenance */}
          <div className="flex flex-col gap-3 p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl hover:border-amber-500/10 transition-colors">
            <div className="flex items-center gap-2 text-red-400 font-extrabold uppercase tracking-wide">
              <Database className="w-3.5 h-3.5 animate-pulse text-red-400" />
              <span>🧹 Database Space Maintenance</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed min-h-[32px]">
              Erase list clutter & purge Firestore transaction loads back to pristine state for optimum loading speeds.
            </p>
            <div className="grid grid-cols-4 gap-1 mt-auto">
              <button
                onClick={() => handleClearDatabaseCollection('trades')}
                disabled={isPurgingDatabase}
                className="py-1.5 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 text-red-400 font-extrabold text-[8px] uppercase rounded tracking-wider transition-all disabled:opacity-40 text-center"
              >
                Clear Trades
              </button>
              <button
                onClick={() => handleClearDatabaseCollection('coins')}
                disabled={isPurgingDatabase}
                className="py-1.5 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 text-red-400 font-extrabold text-[8px] uppercase rounded tracking-wider transition-all disabled:opacity-40 text-center"
              >
                Clear Coins
              </button>
              <button
                onClick={() => handleClearDatabaseCollection('markets')}
                disabled={isPurgingDatabase}
                className="py-1.5 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 text-red-400 font-extrabold text-[8px] uppercase rounded tracking-wider transition-all disabled:opacity-40 text-center"
              >
                Clear Markets
              </button>
              <button
                onClick={handlePruneAllBugs}
                disabled={isPruningBugs}
                className="py-1.5 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 text-rose-400 font-extrabold text-[8px] uppercase rounded tracking-wider transition-all disabled:opacity-40 text-center"
              >
                Clear Bugs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Resource Minting Panel */}
        <div className="lg:col-span-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
          <h3 className="text-base font-black text-rose-400 border-b border-zinc-800 pb-2.5 flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            Central Bank Mint
          </h3>

          <div className="space-y-4">
            {/* Cash Mint */}
            <div className="flex flex-col gap-2 p-3.5 bg-zinc-950/50 border border-zinc-850 rounded-xl">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Instant Cash Value</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={customCash}
                  onChange={(e) => setCustomCash(Math.max(1, Number(e.target.value)))}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 flex-1 font-bold"
                />
                <button
                  onClick={handleMintCash}
                  className="px-4 py-1.5 bg-yellow-500/15 hover:bg-yellow-500/35 border border-yellow-500/30 text-yellow-500 hover:brightness-110 active:scale-95 transition-all text-xs font-bold rounded-lg whitespace-nowrap"
                >
                  Mint Cash
                </button>
              </div>
            </div>

            {/* Gems Mint */}
            <div className="flex flex-col gap-2 p-3.5 bg-zinc-950/50 border border-zinc-850 rounded-xl">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Instant Gems Value</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={customGems}
                  onChange={(e) => setCustomGems(Math.max(1, Number(e.target.value)))}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 flex-1 font-bold"
                />
                <button
                  onClick={handleMintGems}
                  className="px-4 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/35 border border-cyan-500/30 text-cyan-400 hover:brightness-110 active:scale-95 transition-all text-xs font-bold rounded-lg whitespace-nowrap"
                >
                  Mint Gems
                </button>
              </div>
            </div>

            {/* What is the purpose of Minting explanation */}
            <div className="bg-gradient-to-br from-indigo-950/40 to-cyan-950/20 border border-indigo-900/40 rounded-xl p-4 flex flex-col gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
              <h4 className="text-xs font-black text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                ❓ Purpose & Use of Minting
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                In this simulated decentralized economy, <strong>"Minting"</strong> empowers administrators with the unlimited capability to generate standard and premium capital out of thin air:
              </p>
              <ul className="text-[10px] text-zinc-500 space-y-1.5 pl-3 list-disc">
                <li>
                  <strong className="text-zinc-350">Liquidity Injecting:</strong> Create simulated Cash/Gems to inject liquidity into your wallet and participate actively as an artificial market marker.
                </li>
                <li>
                  <strong className="text-zinc-350">Prestige Testing:</strong> Fast-track progression elements or purchase custom premium badges and multi-color neon sidebar status cosmetics instantly.
                </li>
                <li>
                  <strong className="text-zinc-350">User Rewards / Airdrops:</strong> Boost active participants, design manual giveaway actions, and backup trade deficits during black swan bot raid events!
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Global Market Shocks */}
        <div className="lg:col-span-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
          <h3 className="text-base font-black text-rose-400 border-b border-zinc-800 pb-2.5 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            Market Manipulation Overrides
          </h3>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Trigger massive automated system shocks to test ticker responsiveness or force total liquidations under simulation:
          </p>

          <div className="grid grid-cols-2 gap-3.5 mt-2">
            <button
              onClick={handleForceGlobalPump}
              className="p-4 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/15 text-emerald-400 rounded-xl text-left transition-all active:scale-98"
            >
              <TrendingUp className="w-5 h-5 mb-1.5" />
              <div className="font-bold text-xs">Global Pump</div>
              <div className="text-[10px] text-zinc-500 mt-1">Force +50% bump on all coins</div>
            </button>

            <button
              onClick={handleForceGlobalDump}
              className="p-4 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/15 text-rose-450 rounded-xl text-left transition-all active:scale-98"
            >
              <TrendingDown className="w-5 h-5 mb-1.5" />
              <div className="font-bold text-xs">Global Crash</div>
              <div className="text-[10px] text-zinc-500 mt-1">Force -50% dump on all coins</div>
            </button>
          </div>
        </div>

      </div>

      {/* Broadcast System Banner Alert Dispatcher */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
        <h3 className="text-base font-black text-rose-450 border-b border-zinc-800 pb-2.5 flex items-center gap-2">
          <BellRing className="w-5 h-5 text-rose-450" />
          Broadcast System Feed Announcement
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 uppercase font-black">Headline Label</label>
            <input 
              type="text" 
              value={alertTitle}
              onChange={(e) => setAlertTitle(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-bold focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wide">Bulletin / Message & Config</label>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mr-1">Duration:</span>
                {[0, 60, 1440, 10080, 43200].map(val => (
                  <button
                    key={val}
                    onClick={() => setBroadcastTimeLimit(val)}
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all border ${
                      broadcastTimeLimit === val 
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.2)]' 
                        : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-dashed hover:border-solid hover:border-zinc-700'
                    }`}
                  >
                    {val === 0 ? 'Perm' : val === 60 ? '1h' : val === 1440 ? '1d' : val === 10080 ? '1w' : '1m'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <input 
                type="text" 
                value={alertMsg}
                onChange={(e) => setAlertMsg(e.target.value)}
                placeholder="Message content..."
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-medium focus:border-rose-500 focus:outline-none w-full focus:ring-1 focus:ring-rose-500/30 transition-all placeholder:text-zinc-700 shadow-inner"
              />
              <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch">
                {/* Custom Inline Type Selector */}
                <div className="flex bg-zinc-950/80 p-1 rounded-lg border border-zinc-800/80 overflow-hidden shrink-0 shadow-inner">
                  {[
                    { id: 'info', icon: '💬', label: 'Info', color: 'text-indigo-400', activeBg: 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.15)] bg-gradient-to-b from-indigo-500/20 to-transparent' },
                    { id: 'trade', icon: '📈', label: 'Trade', color: 'text-emerald-400', activeBg: 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] bg-gradient-to-b from-emerald-500/20 to-transparent' },
                    { id: 'achievement', icon: '🏆', label: 'Award', color: 'text-amber-400', activeBg: 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)] bg-gradient-to-b from-amber-500/20 to-transparent' },
                    { id: 'crash', icon: '🚨', label: 'Alert', color: 'text-rose-400', activeBg: 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)] bg-gradient-to-b from-rose-500/20 to-transparent' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setAlertType(t.id as any)}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 border z-10 relative ${
                        alertType === t.id 
                          ? `${t.activeBg} ${t.color}` 
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border-transparent hover:border-zinc-700/50 hover:shadow-sm'
                      }`}
                    >
                      <span className="text-xs">{t.icon}</span>
                      <span className="hidden sm:inline tracking-widest">{t.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleDispatchAnnouncement}
                  disabled={!alertTitle.trim() || !alertMsg.trim()}
                  className="px-6 bg-rose-500 hover:bg-rose-500 min-w-[140px] border border-rose-400/40 text-white rounded-lg text-[10px] font-black transition-all shrink-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] uppercase tracking-widest h-10 sm:h-auto flex items-center justify-center gap-2 group relative overflow-hidden text-clip"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-150%] animate-[shimmer_2s_infinite] group-hover:translate-x-[150%] transition-transform duration-700"></div>
                  <svg className="w-3.5 h-3.5 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2Z"></path></svg>
                  <span className="relative z-10">Broadcast</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- TASK UPDATE: SYSTEM BUG REPORTS MONITOR CONSOLE --- */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
            <div>
              <h3 className="font-black text-sm text-zinc-100 uppercase tracking-wide">De-escalated Bug Reports Console</h3>
              <p className="text-[10px] text-zinc-550 mt-0.5">Real-time alerts submitted by users. Capped database usage configuration keeps storage under 1MB.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePruneResolvedBugs}
              disabled={isPruningBugs || bugReports.filter(b => b.status === 'resolved').length === 0}
              className="px-3 py-1 bg-zinc-950 hover:bg-zinc-805 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white font-extrabold rounded-md uppercase tracking-wide transition-all disabled:opacity-45 cursor-pointer"
            >
              Prune Resolved ({bugReports.filter(b => b.status === 'resolved').length})
            </button>
            <button
              onClick={handlePruneAllBugs}
              disabled={isPruningBugs || bugReports.length === 0}
              className="px-3 py-1 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 text-[10px] text-red-400 font-extrabold rounded-md uppercase tracking-wide transition-all disabled:opacity-45 cursor-pointer"
            >
              Prune All ({bugReports.length})
            </button>
          </div>
        </div>

        {bugReports.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-650 bg-zinc-950/40 rounded-xl border border-zinc-850/80 border-dashed">
            🟢 No bug reports currently active in queue. All systems operating smoothly.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
            {bugReports.map((bug) => (
              <div 
                key={bug.id} 
                className={`p-4 rounded-xl border flex flex-col gap-2 bg-zinc-950/40 transition-all ${
                  bug.status === 'resolved' 
                    ? 'border-emerald-500/15 opacity-60' 
                    : 'border-rose-500/10 hover:border-zinc-850'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
                        {bug.category}
                      </span>
                      <span className={`text-xs font-black truncate max-w-[140px] ${bug.status === 'resolved' ? 'text-zinc-500 line-through' : 'text-zinc-250'}`}>
                        {bug.title}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1 font-mono flex flex-col gap-0.5">
                      <div>
                        Reported by: <span className="text-zinc-300 font-bold">{bug.reportedBy || `${bug.userName || 'Anonymous'} (${bug.userHandle || '@anonymous'})`}</span>
                      </div>
                      <div>
                        Date: <span className="text-zinc-400">{new Date(bug.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider shrink-0 select-none ${
                    bug.status === 'resolved' 
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' 
                      : 'bg-rose-950 text-rose-450 border border-rose-900/40 animate-pulse'
                  }`}>
                    {bug.status}
                  </span>
                </div>

                <p className={`text-xs bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-900/60 leading-relaxed break-words font-mono ${
                  bug.status === 'resolved' ? 'text-zinc-650 font-normal shadow-sm' : 'text-zinc-400 font-semibold text-glow-indigo/5'
                }`}>
                  {bug.description}
                </p>

                <div className="flex items-center gap-2 mt-1 justify-end">
                  <button
                    onClick={() => handleToggleBugStatus(bug.id, bug.status)}
                    className={`px-2.5 py-1 text-[9px] uppercase font-black rounded border transition-all cursor-pointer ${
                      bug.status === 'resolved'
                        ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400'
                    }`}
                  >
                    {bug.status === 'resolved' ? 'Reopen' : 'Resolve'}
                  </button>
                  <button
                    onClick={() => handleDeleteBugReport(bug.id)}
                    className="px-2.5 py-1 text-[9px] bg-red-950/10 hover:bg-red-950/30 border border-red-950/30 hover:border-red-500/30 text-rose-400 uppercase font-black rounded transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Coins Override Grid */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
        <h3 className="text-base font-black text-zinc-300 border-b border-zinc-800 pb-2.5 flex items-center gap-2">
          <Skull className="w-5 h-5 text-zinc-550" />
          Coin-Specific Controls (Instant Pumps & Selective crashs)
        </h3>

        <p className="text-xs text-zinc-500">
          Actively control current meme-coins circulating in the arena. You can double values or selectively pull liquidity to test dev risk ratios:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-1.5">
          {coins.map((coin) => (
            <div 
              key={coin.id}
              className={`p-4 rounded-xl border ${false ? 'border-dashed border-red-500/20 bg-red-950/5' : 'border-zinc-800 bg-zinc-950/40'} flex flex-col gap-1.5 relative overflow-hidden`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-extrabold text-sm text-zinc-200 flex items-center gap-1.5">
                    <span className="text-lg">{coin.avatarEmoji}</span>
                    <span className="truncate max-w-[120px]">{coin.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">*{coin.symbol}</span>
                  </div>
                  <span className="text-[9px] text-zinc-505 block mt-0.5">Created by {coin.creator}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold ${false ? 'text-rose-500' : 'text-emerald-400'}`}>
                    {false ? 'crashed' : `$${coin.price.toFixed(4)}`}
                  </span>
                </div>
              </div>

              {!false ? (
                <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-900/40">
                  <button
                    onClick={() => handleForcePumpSingle(coin.id)}
                    className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/15 hover:border-emerald-500/40 text-emerald-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Double Price
                  </button>
                  <button
                    onClick={() => handleForcedelist(coin.id)}
                    className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-550/20 border border-rose-500/15 hover:border-rose-500/40 text-rose-450 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Skull className="w-3.5 h-3.5" />
                    Force crash
                  </button>
                </div>
              ) : (
                <div className="text-center py-2 text-[10px] text-rose-500/40 font-bold uppercase tracking-wider bg-rose-950/5 rounded-lg border border-rose-950/40 mt-3 flex items-center justify-center gap-1">
                  🚫 LIQUIDITY DRAINED DEFINITIVELY
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
