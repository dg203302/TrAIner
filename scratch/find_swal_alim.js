const fs = require('fs');
const content = fs.readFileSync('Templates/plan_alimentacion.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Swal')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
