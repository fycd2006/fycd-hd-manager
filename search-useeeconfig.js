const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      search(fullPath);
    } else if (file.endsWith('.js')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Let's look for "useEeConfig"
        const idx = content.indexOf('useEeConfig');
        if (idx !== -1) {
          // print if it's the declaration
          if (content.includes('useEeConfig =') || content.includes('useEeConfig=') || content.includes('function useEeConfig') || content.includes('useEeConfig:')) {
            console.log(`FOUND useEeConfig DECLARATION IN: ${fullPath}`);
            console.log(content.substring(idx - 100, idx + 200));
            console.log('----------------------------------------------------');
          }
        }
      } catch (e) {}
    }
  }
}

search('/usr/src/app/docker/nc-gui');
