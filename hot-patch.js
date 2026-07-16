const fs = require('fs');
const path = require('path');

function patchFile(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Bypass TiDB/Vitess connection restriction regex
  const targetRegex = '/\\b(Tidb|Vitess)\\b/i';
  const replacementRegex = '/\\b(NonExistentDbName)\\b/i';
  if (content.includes(targetRegex)) {
    content = content.split(targetRegex).join(replacementRegex);
    console.log(`[Regex] Patched: ${file}`);
    changed = true;
  }

  // 2. Bypass Backend EE License validation (isEE getter)
  // Target: get 'isEE'(){return _0xXXXXXX;} -> replace with get 'isEE'(){return true;}
  const eeIdx = content.indexOf("get 'isEE'(){return ");
  if (eeIdx !== -1) {
    const endIdx = content.indexOf('}', eeIdx);
    const chunk = content.substring(eeIdx, endIdx + 1);
    content = content.split(chunk).join("get 'isEE'(){return true;}");
    console.log(`[EE Backend] Patched: ${file}`);
    changed = true;
  }

  // 3. Bypass Frontend EE block flags
  // Find compiled Nuxt declarations: "isEeUI:!1" or "isEeUI:false"
  // We'll replace it with "isEeUI:true" or "isEeUI:!0"
  if (file.endsWith('.js') && (file.includes('_nuxt') || file.includes('public') || file.includes('nc-gui'))) {
    const targets = [
      'isEeUI=false',
      'isEeUI=!1',
      'isEeUI:false',
      'isEeUI:!1',
      'isEEFeatureBlocked=true',
      'isEEFeatureBlocked=!0',
      'isEEFeatureBlocked:true',
      'isEEFeatureBlocked:!0',
      'showEEFeatures=false',
      'showEEFeatures=!1',
      'showEEFeatures:false',
      'showEEFeatures:!1'
    ];

    targets.forEach(target => {
      if (content.includes(target)) {
        let replacement = target;
        if (target.includes('isEeUI')) {
          replacement = target.includes(':') ? 'isEeUI:true' : 'isEeUI=true';
        } else if (target.includes('isEEFeatureBlocked')) {
          replacement = target.includes(':') ? 'isEEFeatureBlocked:false' : 'isEEFeatureBlocked=false';
        } else if (target.includes('showEEFeatures')) {
          replacement = target.includes(':') ? 'showEEFeatures:true' : 'showEEFeatures=true';
        }
        content = content.split(target).join(replacement);
        console.log(`[EE Frontend] Patched (${target} -> ${replacement}): ${file}`);
        changed = true;
      }
    });
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
  }
}

function walkDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (file === 'node_modules' || file === '.git') continue;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (stat.isFile() && /\.(js|json)$/.test(file)) {
        patchFile(fullPath);
      }
    }
  } catch (e) {
    console.error(`Error walking ${dir}:`, e.message);
  }
}

console.log('Starting NocoDB hot-patch...');
walkDir('/usr/src/app/docker');
console.log('NocoDB hot-patch completed.');
