const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '../../frontend/dist');
const target = path.join(__dirname, '../public');

if (!fs.existsSync(source)) {
  console.error('ERRORE: cartella frontend/dist non trovata. Esegui prima "npm run build" nel frontend.');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Copiato frontend/dist in backend/public (${fs.readdirSync(target).length} elementi)`);
