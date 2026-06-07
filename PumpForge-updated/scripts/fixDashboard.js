import fs from 'fs';

let content = fs.readFileSync('src/components/OwnerDashboardTab.tsx', 'utf8');

content = content.replace(/try\s*\{\s*const docRef = doc\([^)]*\);\s*await updateDoc\([^)]*\);\s*\} catch\s*\([^)]*\)\s*\{\s*handleFirestoreError\([^)]*\);\s*\}/g, '/* Removed Firebase update */');
content = content.replace(/try\s*\{\s*const docRef = doc\([\s\S]*?updateDoc\([\s\S]*?handleFirestoreError\([\s\S]*?\);\s*\}/g, '/* Removed Firebase update */');

fs.writeFileSync('src/components/OwnerDashboardTab.tsx', content);

let appContent = fs.readFileSync('src/App.tsx', 'utf8');
appContent = appContent.replace(/const \{ databases, Query \} = await import\("appwrite"\);/g, 'const { Query } = await import("appwrite");');
fs.writeFileSync('src/App.tsx', appContent);

