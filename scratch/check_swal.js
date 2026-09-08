const fs = require('fs');

const files = [
  'Templates/creacionCuen/datosUnuevo.html',
  'Templates/calendario_renov.html',
  'Templates/plan_alimentacion.html',
  'Templates/plan_entreno.html'
];

files.forEach(f => {
  if (!fs.existsSync(f)) {
    console.log(f, 'DOES NOT EXIST');
    return;
  }
  const content = fs.readFileSync(f, 'utf8');
  const swalMatches = content.match(/Swal/g) || [];
  const scriptMatches = content.match(/sweetalert/gi) || [];
  console.log(`${f}: Swal=${swalMatches.length}, sweetalert=${scriptMatches.length}`);
});
