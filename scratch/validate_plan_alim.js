const fs = require('fs');
const { parse } = require('node:path');
const vm = require('vm');

const html = fs.readFileSync('Templates/plan_alimentacion.html', 'utf8');
const scriptRegex = /<script(?:\s+type="module")?>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  const code = match[1].trim();
  if (!code) continue;
  count++;
  try {
    new vm.Script(code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '// import replaced'));
    console.log(`Script ${count} compiled cleanly!`);
  } catch (e) {
    console.error(`Script ${count} error:`, e.message);
    process.exit(1);
  }
}
console.log(`All ${count} scripts verified.`);
