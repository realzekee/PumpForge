import fs from 'fs';

let text = fs.readFileSync('src/components/OwnerDashboardTab.tsx', 'utf8');

// Replace realtime bugs listener 
text = text.replace(/const q = query[\s\S]*?return \(\) => unsub\(\);\n\s*\}, \[\]\);/, `
    let active = true;
    const fetchBugs = async () => {
      try {
        const { Query } = await import("appwrite");
        const res = await databases.listDocuments("pumpforge", "bugs", [Query.orderDesc("timestamp")]);
        if (active) {
          setBugReports(res.documents.map(d => ({ id: d.$id, ...d })));
        }
      } catch (err) {
      }
    };
    fetchBugs();
    return () => { active = false; };
  }, []);
`);

text = text.replace(/const ref = doc\(db, "bugs", bugId\);\s*await updateDoc\(ref, \{ status: nextStatus \}\);/, `await databases.updateDocument("pumpforge", "bugs", bugId, { status: nextStatus });`);

text = text.replace(/await deleteDoc\(doc\(db, "bugs", bugId\)\);/, `await databases.deleteDocument("pumpforge", "bugs", bugId);`);

text = text.replace(/const docRef = doc\(db, "users", targetRegUser\.uid\);\s*await updateDoc\(docRef, \{\s*cash: newCash,\s*\}\);/g, `
      await databases.updateDocument("pumpforge", "users", targetRegUser.uid, { cash: newCash });
`);

text = text.replace(/const docRef = doc\(db, "users", targetRegUser\.uid\);\s*await updateDoc\(docRef, \{\s*gems: newGems,\s*\}\);/g, `
      await databases.updateDocument("pumpforge", "users", targetRegUser.uid, { gems: newGems });
`);

text = text.replace(/const docRef = doc\(db, "users", targetRegUser\.uid\);\s*await updateDoc\(docRef, \{\s*totalProfit: newProfit,\s*\}\);/g, `
      await databases.updateDocument("pumpforge", "users", targetRegUser.uid, { totalProfit: newProfit });
`);

text = text.replace(/const coinRef = doc\(db, "coins", botRaidCoinId\);\s*await updateDoc\(coinRef, payload\);/g, `
      await databases.updateDocument("pumpforge", "coins", botRaidCoinId, payload);
`);

text = text.replace(/const docRef = doc\(\s*db,\s*"users",\s*targetRegUser\.uid,\s*\);\s*await updateDoc\(docRef, \{\s*cash: newCash,\s*\}\);/g, `await databases.updateDocument("pumpforge", "users", targetRegUser.uid, { cash: newCash });`);

text = text.replace(/const docRef = doc\(\s*db,\s*"users",\s*targetRegUser\.uid,\s*\);\s*await updateDoc\(docRef, \{\s*gems: newGems,\s*\}\);/g, `await databases.updateDocument("pumpforge", "users", targetRegUser.uid, { gems: newGems });`);

fs.writeFileSync('src/components/OwnerDashboardTab.tsx', text);
