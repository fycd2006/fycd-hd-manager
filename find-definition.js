const fs = require('fs');
const path = require('path');

function search(dir) {
  try {
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
          // Match variations of isEeUI assignment
          const matches = [
            'isEeUI=!1',
            'isEeUI=false',
            'isEeUI = !1',
            'isEeUI = false',
            'isEeUI:!1',
            'isEeUI:false'
          ];
          for (const match of matches) {
            if (content.includes(match)) {
              console.log(`FOUND DEFINITION (${match}):`, fullPath);
              // Print context
              const idx = content.indexOf(match);
              console.log(content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 100)));
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

search('/usr/src/app/docker/nc-gui');
