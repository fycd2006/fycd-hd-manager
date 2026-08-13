const fs = require('fs');
const path = 'src/modules/database/components/views/grid/GridViewCell.tsx';
let code = fs.readFileSync(path, 'utf8');

// Add imports
code = code.replace(
  "import PopoverPortal from '@/components/ui/PopoverPortal';",
  "import PopoverPortal from '@/components/ui/PopoverPortal';\nimport { LongTextCellEditor } from './cells/LongTextCellEditor';\nimport { SelectCellEditor } from './cells/SelectCellEditor';\nimport { LinkRowCellEditor } from './cells/LinkRowCellEditor';\nimport { formatNumberValue } from './cells/utils';"
);

// Remove unused state hooks that we moved
code = code.replace(/\/\/ link_row relation modal state when cell is editing[\s\S]*?const \[comboSearch, setComboSearch\] = useState\(''\);/, '');

// Replace link_row render
code = code.replace(/if \(field\.type === 'link_row'\) \{[\s\S]*?return \([\s\S]*?<\/ModalOverlay>\s*\);\s*\}/, 
`if (field.type === 'link_row') {
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

// Replace select render
code = code.replace(/if \(field\.type === 'single_select'\) \{[\s\S]*?if \(field\.type === 'multiple_select'\) \{[\s\S]*?<\/PopoverPortal>\s*<\/>\s*\);\s*\}/, 
`if (field.type === 'single_select' || field.type === 'multiple_select') {
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
      }`);

// Replace long_text render
code = code.replace(/if \(field\.type === 'long_text'\) \{[\s\S]*?<\/PopoverPortal>\s*\);\s*\}/, 
`if (field.type === 'long_text') {
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

fs.writeFileSync(path, code);
console.log('Refactoring applied');
