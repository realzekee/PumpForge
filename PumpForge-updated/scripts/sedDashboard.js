import fs from 'fs';
let content = fs.readFileSync('src/components/OwnerDashboardTab.tsx', 'utf8');

// replace doc(db
content = content.replace(/const docRef = doc\(db, "users", targetRegUser\.uid\);/g, '/* Removed doc ref */');
content = content.replace(/updateDoc\(docRef, \{[^\}]+\}\)/g, 'Promise.resolve()');
// line 1378
content = content.replace(/const docRef = doc\(db, "broadcasts", broadcastId\);/g, '/* */');

// replace the rest
content = content.replace(/doc\(\s*db,\s*"users",\s*targetRegUser\.uid,\s*\);/g, 'null');
content = content.replace(/updateDoc\(.*?\)/g, 'Promise.resolve()');
fs.writeFileSync('src/components/OwnerDashboardTab.tsx', content);
