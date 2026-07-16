const fs = require('fs');
const file = '/usr/src/app/docker/nc-gui/_nuxt/BGeeiuXx.js';

if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  let pos = 0;
  while (true) {
    const idx = content.indexOf('K2', pos);
    if (idx === -1) break;
    console.log(`FOUND K2 AT INDEX ${idx}:`);
    console.log(content.substring(idx - 60, idx + 60));
    console.log('----------------------------------------------------');
    pos = idx + 2;
  }
} else {
  console.log('BGeeiuXx.js not found!');
}
