const fs = require('fs');
const path = 'src/modules/database/components/views/grid/GridViewCell.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

function replaceBlock(lines, startKeyword, replacementStr) {
  const startIdx = lines.findIndex(l => l.includes(startKeyword) && lines.indexOf(l) > 880 && lines.indexOf(l) < 1800);
  if (startIdx === -1) { console.log('not found:', startKeyword); return lines; }
  
  let braceCount = 0;
  let started = false;
  let endIdx = -1;
  for (let i = startIdx; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      if (lines[i][j] === '{') { braceCount++; started = true; }
      if (lines[i][j] === '}') { braceCount--; }
    }
    if (started && braceCount === 0) {
      endIdx = i;
      break;
    }
  }
  
  if (endIdx !== -1) {
    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx + 1);
    const replacement = replacementStr.split('\n');
    return [...before, ...replacement, ...after];
  }
  return lines;
}

// 1. replace long_text
lines = replaceBlock(lines, `if (field.type === 'long_text') {`, 
`      if (field.type === 'long_text') {
        return (
          <LongTextCellEditor
            value={localVal}
            fieldName={field.name}
            cellWidth={measuredWidth}
            popoverPos={popoverPos}
            onUpdate={v => { setLocalVal(v); onUpdate(v); }}
            onCancelEdit={onCancelEdit}
          />
        );
      }`);

// 2. replace link_row
lines = replaceBlock(lines, `if (field.type === 'link_row') {`, 
`      if (field.type === 'link_row') {
        const allowMultiple = fieldOptions?.allowMultiple !== false;
        return (
          <LinkRowCellEditor
            value={value}
            targetTableId={targetTableId}
            allowMultiple={allowMultiple}
            onUpdate={(val) => { setLocalVal(val); onUpdate(val); }}
            onCancelEdit={onCancelEdit}
          />
        );
      }`);

// 3. replace single_select and multiple_select
const ssStart = lines.findIndex(l => l.includes(`if (field.type === 'single_select') {`) && lines.indexOf(l) > 880 && lines.indexOf(l) < 1800);
if (ssStart !== -1) {
  let braceCount = 0;
  let started = false;
  let msEndIdx = -1;
  for (let i = ssStart; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      if (lines[i][j] === '{') { braceCount++; started = true; }
      if (lines[i][j] === '}') { braceCount--; }
    }
    if (started && braceCount === 0) {
      const msStart = lines.findIndex((l, idx) => idx > i && l.includes(`if (field.type === 'multiple_select') {`));
      if (msStart !== -1 && msStart < i + 5) {
         let msBrace = 0;
         let msStarted = false;
         for (let k = msStart; k < lines.length; k++) {
           for (let j = 0; j < lines[k].length; j++) {
             if (lines[k][j] === '{') { msBrace++; msStarted = true; }
             if (lines[k][j] === '}') { msBrace--; }
           }
           if (msStarted && msBrace === 0) {
             msEndIdx = k;
             break;
           }
         }
      }
      break;
    }
  }
  
  if (msEndIdx !== -1) {
    const before = lines.slice(0, ssStart);
    const after = lines.slice(msEndIdx + 1);
    const replacement = `      if (field.type === 'single_select' || field.type === 'multiple_select') {
        return (
          <SelectCellEditor
            value={localVal}
            fieldId={field.id}
            isMultiple={field.type === 'multiple_select'}
            options={getFieldOptions()}
            popoverPos={popoverPos}
            onUpdate={(val) => { setLocalVal(val); onUpdate(val); }}
            onUpdateField={onUpdateField}
            onCancelEdit={onCancelEdit}
          />
        );
      }`.split('\n');
    lines = [...before, ...replacement, ...after];
  }
}

let code = lines.join('\n');

// Delete state hooks (we should only delete the comboSearch one to be safe)
code = code.replace(/\/\/ link_row relation modal state when cell is editing[\s\S]*?const \[comboSearch, setComboSearch\] = useState\(''\);/, '');

// Add imports
code = code.replace(
  "import PopoverPortal from '@/components/ui/PopoverPortal';",
  "import PopoverPortal from '@/components/ui/PopoverPortal';\nimport { LongTextCellEditor } from './cells/LongTextCellEditor';\nimport { SelectCellEditor } from './cells/SelectCellEditor';\nimport { LinkRowCellEditor } from './cells/LinkRowCellEditor';\nimport { formatNumberValue } from './cells/utils';"
);

fs.writeFileSync(path, code);
console.log('Refactoring applied successfully');
