const fs = require('fs');
const file = '/usr/src/app/docker/nc-gui/_nuxt/BGeeiuXx.js';

if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  let pos = 0;
  while (true) {
    const idx = content.indexOf('isEeUI', pos);
    if (idx === -1) break;
    console.log(`FOUND isEeUI AT INDEX ${idx}:`);
    console.log(content.substring(Math.max(0, idx - 80), Math.min(content.length, idx + 80)));
    console.log('----------------------------------------------------');
    pos = idx + 6;
  }
} else {
  console.log('BGeeiuXx.js not found!');
}
