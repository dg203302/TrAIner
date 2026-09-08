const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('./Templates/plan_entreno.html', 'utf8');

// Extract modules and inline scripts
const scriptRegex = /<script(?:\s+type="module")?>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
    count++;
    let code = match[1];
    // replace imports so vm can compile
    code = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '// import removed');
    try {
        new vm.Script(code);
        console.log(`Script #${count} compiled successfully!`);
    } catch (e) {
        console.error(`Script #${count} syntax error:`, e.message);
        process.exit(1);
    }
}
console.log('ALL SCRIPTS IN plan_entreno.html ARE 100% VALID!');
