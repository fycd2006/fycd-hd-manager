const fs = require('fs');
const file = '/usr/src/app/docker/nc-gui/_nuxt/BGeeiuXx.js';

if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  const idx = content.indexOf('T(K2)');
  if (idx !== -1) {
    console.log('T(K2) context:', content.substring(idx - 100, idx + 100));
    const header = content.substring(0, 10000);
    let pos = 0;
    while (true) {
      const importIdx = header.indexOf('K2', pos);
      if (importIdx === -1) break;
      console.log('Import K2 context:', header.substring(importIdx - 50, importIdx + 50));
      pos = importIdx + 2;
    }
  }
} else {
  console.log('BGeeiuXx.js not found!');
}
