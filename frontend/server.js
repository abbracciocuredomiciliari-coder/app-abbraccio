const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, 'dist');

// Verifica che la cartella dist esista
if (!fs.existsSync(distPath)) {
  console.error('ERRORE: Cartella dist non trovata!');
  console.error('Path cercato:', distPath);
  process.exit(1);
}

console.log('Serving static files from:', distPath);

// Serve i file statici dalla cartella dist
app.use(express.static(distPath));

// Fallback a index.html per tutte le route (SPA support)
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(500).send('index.html non trovato in: ' + indexPath);
  }
  res.sendFile('index.html', { root: distPath });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Dist folder contents:', fs.readdirSync(distPath));
});
