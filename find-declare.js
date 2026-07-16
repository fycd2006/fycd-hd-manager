const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath);
    } else if (stat.isFile() && /\.js$/.test(file)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Let's search for "isEeUI" definition. In the compiled code, it will be defined as something like:
        // `isEeUI = !1` or `isEeUI = false` or `isEeUI: !1`
        const idx = content.indexOf('isEeUI:');
        if (idx !== -1) {
          console.log(`Found isEeUI: definition in ${fullPath}:`);
          console.log(content.substring(idx - 100, idx + 100));
        }
        const idx2 = content.indexOf('isEeUI=');
        if (idx2 !== -1) {
          console.log(`Found isEeUI= definition in ${fullPath}:`);
          console.log(content.substring(idx2 - 100, idx2 + 100));
        }
      } catch (e) {}
    }
  }
}

search('/usr/src/app/docker/nc-gui');
