import fs from 'fs';

let text = fs.readFileSync('src/App.tsx', 'utf8');

// replace Firebase Auth block
text = text.replace(/try\s*\{\s*if\s*\(!auth\.currentUser\)\s*\{\s*await signInAnonymously\(auth\);[\s\S]*?catch\s*\(fbAuthErr\)\s*\{[\s\S]*?\}\n/, '');

// replace setDoc for user Stats dual-syncing
text = text.replace(/\/\/ Force-sync latest profile metadata[\s\S]*?catch\s*\(fsSyncErr\)\s*\{\s*console\.error\("Firestore user profile sync error:",\s*fsSyncErr\);\s*\}/, '');

// replace marketsUnsub
text = text.replace(/const marketsUnsub = onSnapshot\([\s\S]*?console\.error\("Markets snapshot subscription error:",\s*error\);\s*\},\s*\);/, `const DEFAULT_MARKETS = [
            {
              id: "m1",
              question: "Will *ROAD hit a $150K valuation by Friday?",
              description: "Based on shill room hype, ROAD represents the premium culture asset.",
              yesPool: 4500,
              noPool: 3200,
              yesPercentage: 58,
              resolved: false,
              resolvedOutcome: null,
              endTime: "Next Friday",
              category: "trading",
            },
            {
              id: "m2",
              question: "Will Slots simulation return a grand Jackpot win on next 10 attempts?",
              description: "Probabilities dictate slot engines have a high variance output.",
              yesPool: 150,
              noPool: 6400,
              yesPercentage: 2,
              resolved: false,
              resolvedOutcome: null,
              endTime: "Within 2 hours",
              category: "arcade",
            },
            {
              id: "m3",
              question: "Will Zeke reach Prestige I status inside the next 12 hours?",
              description: "Requires $100K liquid cash balance to trigger Prestige system.",
              yesPool: 8500,
              noPool: 1000,
              yesPercentage: 89,
              resolved: true,
              resolvedOutcome: "YES",
              endTime: "Completed",
              category: "general",
            },
          ];
          setMarkets(DEFAULT_MARKETS);
          const marketsUnsub = () => {};`);

// replace usersUnsub
text = text.replace(/const usersUnsub = onSnapshot\(\s*collection\(db, "users"\)[\s\S]*?console\.error\("Real registered users synchronization error:", error\);\s*\},\s*\);/, 'const usersUnsub = () => {}; setRegisteredUsers([]);');

// replace broadcastsUnsub
text = text.replace(/const broadcastsUnsub = onSnapshot\(\s*collection\(db, "broadcasts"\)[\s\S]*?console\.error\("Broadcasts snapshot subscription error:", error\);\s*\},\s*\);/, 'const broadcastsUnsub = () => {};');

// replace batch creation for launching a coin
text = text.replace(/const batch = writeBatch\(db\);[\s\S]*?handleFirestoreError\([\s\S]*?\);\n\s*return[\s\S]*?\n\s*\}/g, `
        setUserStats((prev) => ({
          ...prev,
          cash: nextCash,
          coinsCreatedCount: nextCreatedCount,
        }));
`);

// Delete doc coin deletion
text = text.replace(/\/\/ Delete document from Firestore\s*const coinRef = doc\(db, "coins", coinId\);\s*await deleteDoc\(coinRef\);\s*\} catch \(e\) \{\s*handleFirestoreError\([\s\S]*?\);\s*\}/g, '} catch (e) {}');

// Write batch for markets and bugs
text = text.replace(/try \{\s*const batch = writeBatch\(db\);[\s\S]*?handleFirestoreError\([\s\S]*?\);\n\s*\}/g, '');
text = text.replace(/try \{\s*await setDoc\(doc\(db, "bugs"[\s\S]*?handleFirestoreError\([\s\S]*?\);\s*\}/g, `
        safeStorage.setItem(rateLimitKey, Date.now().toString());
        onAddNotification(
          "Report Sent",
          "Your bug report has been logged. Thank you!",
          "info"
        );
`);

// Replace writeBatch everywhere else
text = text.replace(/const batch = writeBatch\(db\);[\s\S]*?batch\.commit\(\);\s*/g, '');

text = text.replace(/} catch \(e\) \{\s*handleFirestoreError\([^)]*\);\s*\}?/g, '');

text = text.replace(/updateDoc\(doc\(db, "users", currentUser\.uid\)[^;]*;/g, '');
text = text.replace(/updateDoc\(doc\(db, "users", currentUser\.uid\)[^\)]*\)\.catch\([^)]*\);/g, '');

fs.writeFileSync('src/App.tsx', text);
