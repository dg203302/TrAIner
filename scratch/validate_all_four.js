const fs = require('fs');
const vm = require('vm');

const files = [
  'Templates/creacionCuen/datosUnuevo.html',
  'Templates/calendario_renov.html',
  'Templates/plan_alimentacion.html',
  'Templates/plan_entreno.html'
];

let allPassed = true;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const scriptRegex = /<script(?:\s+type="module")?>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  console.log(`\nValidating ${file}...`);
  while ((match = scriptRegex.exec(content)) !== null) {
    const code = match[1].trim();
    if (!code) continue;
    count++;
    try {
      new vm.Script(code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '// import replaced'));
      console.log(`  ✓ Script ${count} compiled cleanly!`);
    } catch (e) {
      console.error(`  ✗ Script ${count} error in ${file}:`, e.message);
      allPassed = false;
    }
  }
  if (count === 0) {
    console.log(`  (no inline script tags found in ${file})`);
  }
});

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\nAll 4 templates verified with 100% clean compilation!');
}
