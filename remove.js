import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Remove firebase imports
content = content.replace(/\/\/ Firebase imports\n+import\s+\{[\s\S]*?\}\s*from\s*"\.\/firebase";\n+import\s+\{[\s\S]*?\}\s*from\s*"firebase\/auth";\n+import\s+\{[\s\S]*?\}\s*from\s*"firebase\/firestore";\n+/g, '');

fs.writeFileSync('src/App.tsx', content);
