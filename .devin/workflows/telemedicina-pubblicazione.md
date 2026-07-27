---
description: Pubblicazione produzione del modulo Telemedicina
---

# Pubblicazione Telemedicina

## Pre-requisiti
- Variabili d'ambiente di produzione pronte su `.env` (PORT, MONGODB_URI, JWT_SECRET, FRONTEND_URL, SMTP_* opzionali).
- Node.js >= 18.

## 1. Build locale (un solo comando)
```powershell
cd backend
npm run build:prod
```
Produce:
- `backend/dist/` → server compilato
- `backend/public/` → frontend pronto per essere servito dal backend

## 2. Upload su Aruba
Caricare via FTP/SFTP l'intera cartella `backend` (inclusi `dist/`, `public/`, `package.json`, `package-lock.json`) e il file `.env` personalizzato.

## 3. Avvio
Nel pannello Node.js di Aruba o via SSH:
```bash
cd backend
npm install
npm start
```
Il server risponde sia sulle API (`/api/*`) che sul frontend (`/`).

## 4. Variabili d'ambiente principali
```env
NODE_ENV=production
PORT=4000
MONGODB_URI=tuo_uri_mongodb
JWT_SECRET=tuo_secret_32_chars
FRONTEND_URL=https://tuodominio.it
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```

## 5. Verifica post-deploy
1. `https://tuodominio.it/api/health` → ok
2. `https://tuodominio.it/` → app React
3. Navigare in **Telemedicina** e controllare le tab (pacchetti, governance, dispositivi, report, FHIR)
4. Testare la sala video e l'export FHIR

## 6. Rollback
Sostituire `backend/dist` e `backend/public` con i file della versione precedente e riavviare.
