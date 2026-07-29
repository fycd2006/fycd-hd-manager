// 將 Antigravity 輸出的結構化 JSON 轉換成人類可讀的 PR 留言 markdown
// 分成兩層的原因：AI 輸出穩定的 JSON 供程式解析／自動化使用，
// 這支腳本只負責「呈現」，未來要接 CODEOWNERS 路由、👍👎 統計都直接讀 JSON 即可，不必重新解析 markdown。

const fs = require('fs');

const SEVERITY_EMOJI = { critical: '🔴', major: '🟠', minor: '🟡' };
const CATEGORY_LABEL = {
  correctness: '正確性', react: 'React', security: '安全性',
  performance: '效能', maintainability: '可維護性', testing: '測試覆蓋率'
};

function renderComment(review) {
  const { tool_summary, findings, priority_summary, top_priority_files } = review;

  let body = `## 🤖 Antigravity 自動程式碼檢核\n\n`;
  body += `**靜態工具結果**：ESLint ${tool_summary?.eslint_issues ?? 0} 項 · `;
  body += `Stylelint ${tool_summary?.stylelint_issues ?? 0} 項 · `;
  body += `npm audit ${tool_summary?.npm_audit_vulnerabilities ?? 0} 個漏洞 · `;
  body += `（另有 ${tool_summary?.baseline_excluded_count ?? 0} 項既有問題不在本次範圍）\n\n`;

  if (!findings || findings.length === 0) {
    body += `✅ 未發現本次 PR 新增的語意層問題。\n`;
    return body;
  }

  body += `| 嚴重程度 | 類別 | 檔案:行號 | 問題 | 建議修正 |\n`;
  body += `|---|---|---|---|---|\n`;

  const order = { critical: 0, major: 1, minor: 2 };
  const sorted = [...findings].sort((a, b) => (order[a.severity] ?? 99) - (order[b.severity] ?? 99));

  for (const f of sorted) {
    const emoji = SEVERITY_EMOJI[f.severity] || '';
    const cat = CATEGORY_LABEL[f.category] || f.category;
    body += `| ${emoji} ${f.severity} | ${cat} | \`${f.file}:${f.line}\` | ${f.description} | ${f.suggested_fix} |\n`;
  }

  body += `\n**總結**：${priority_summary}\n`;
  if (top_priority_files && top_priority_files.length > 0) {
    body += `**優先處理檔案**：${top_priority_files.map(f => `\`${f}\``).join(', ')}\n`;
  }
  body += `\n---\n*僅回報本次 PR 新增的問題，既有問題不在此範圍*`;

  return body;
}

try {
  const raw = fs.readFileSync('review.json', 'utf8');
  const review = JSON.parse(raw);
  fs.writeFileSync('review-comment.md', renderComment(review));
} catch (err) {
  // JSON 解析失敗時的保底方案：不要讓整個 workflow 失敗，
  // 而是把原始輸出附上並標註解析錯誤，方便除錯 prompt
  const fallback = `## 🤖 Antigravity 自動程式碼檢核\n\n` +
    `⚠️ 本次 AI 輸出無法解析為預期的 JSON 格式，請人工確認以下原始輸出：\n\n` +
    `<details><summary>原始輸出</summary>\n\n\`\`\`\n` +
    (fs.existsSync('review.json') ? fs.readFileSync('review.json', 'utf8') : '(無輸出檔案)') +
    `\n\`\`\`\n</details>\n\n錯誤訊息：\`${err.message}\``;
  fs.writeFileSync('review-comment.md', fallback);
}
