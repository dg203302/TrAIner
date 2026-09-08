const fs = require('fs');
const content = fs.readFileSync('Templates/plan_entreno.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('sweetalert')) {
    console.log(`SweetAlert line ${i+1}: ${l.trim()}`);
  }
  if (l.includes('Swal')) {
    console.log(`Swal line ${i+1}: ${l.trim()}`);
  }
});
