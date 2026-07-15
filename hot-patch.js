const fs = require('fs');
const file = '/usr/src/app/docker/index.js';

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Bypass TiDB/Vitess regex block
  const targetRegex = '/\\b(Tidb|Vitess)\\b/i';
  const replacementRegex = '/\\b(NonExistentDbName)\\b/i';
  if (content.includes(targetRegex)) {
    content = content.split(targetRegex).join(replacementRegex);
    console.log('Successfully patched TiDB/Vitess regex block!');
  }

  // 2. Bypass EE License validation to unlock all features
  // Target: get 'isEE'(){return _0xXXXXXX;} -> replace with get 'isEE'(){return true;}
  const idx = content.indexOf("get 'isEE'(){return ");
  if (idx !== -1) {
    const endIdx = content.indexOf('}', idx);
    const chunk = content.substring(idx, endIdx + 1);
    content = content.split(chunk).join("get 'isEE'(){return true;}");
    console.log('Successfully patched Enterprise License block!');
  } else {
    console.log('Enterprise License pattern not found.');
  }

  fs.writeFileSync(file, content, 'utf8');
} else {
  console.log('Target index.js not found!');
}
