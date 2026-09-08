const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('./Templates/calendario_renov.html', 'utf8');
const scriptRegex = /<script(?:\s+type="module")?>([\s\S]*?)<\/script>/gi;
let m;
let count = 0;
while ((m = scriptRegex.exec(html)) !== null) {
    count++;
    let code = m[1].replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '// import removed');
    new vm.Script(code);
}
console.log(`calendario_renov.html: ${count} scripts compiled successfully!`);
