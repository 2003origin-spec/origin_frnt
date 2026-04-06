const fs = require('fs');
const content = fs.readFileSync('src/server/store.ts', 'utf8');
const idMatches = content.match(/id:\s*['"]q\d+['"]/g);
console.log("Number of questions in mock store:", idMatches ? idMatches.length : 0);
