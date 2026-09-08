const fs = require('fs');
const content = fs.readFileSync('Templates/plan_entreno.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('custom-sheet-backdrop') || l.includes('modal-') || l.includes('id="modal') || l.includes('class="modal')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
