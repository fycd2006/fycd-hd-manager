const fs = require('fs');
const file = '/usr/src/app/docker/nc-gui/_nuxt/BGeeiuXx.js';

if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  let pos = 0;
  while (true) {
    const idx = content.indexOf('isEeUI:', pos);
    if (idx === -1) break;
    console.log(`FOUND isEeUI: export mapping at index ${idx}:`);
    console.log(content.substring(idx - 100, idx + 100));
    console.log('----------------------------------------------------');
    pos = idx + 7;
  }
} else {
  console.log('BGeeiuXx.js not found!');
}
