# 🚀 Guida Deploy Cloud — App Abbraccio

Questa guida ti permette di mettere l'app online in modo che sia accessibile
da qualsiasi dispositivo (PC, tablet, smartphone) tramite browser web.

**Costo stimato: GRATUITO** (con i piani free di MongoDB Atlas, Render e Vercel)

---

## 📋 Panoramica architettura cloud

```
[Browser / Smartphone]
        │
        ▼
[Vercel] — Frontend React (GRATUITO)
   https://app-abbraccio-frontend-rw2c.vercel.app
        │
        ▼
[Render] — Backend Node.js/Express (GRATUITO o $7/mese)
   https://app-abbraccio-backend.onrender.com
        │
        ▼
[MongoDB Atlas] — Database (GRATUITO fino a 512MB)
   cluster0.xxxxx.mongodb.net
```

---

## PASSO 1 — Crea il repository GitHub

Il codice deve essere su GitHub per poter fare il deploy automatico.

1. Vai su **https://github.com** e crea un account (se non ce l'hai)
2. Clicca **"New repository"**
3. Nome: `app-abbraccio`
4. Visibilità: **Private** (importante per dati sanitari!)
5. Clicca **"Create repository"**

Poi dal terminale di Windsurf, esegui:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/app-abbraccio.git
git push -u origin main
```

---

## PASSO 2 — MongoDB Atlas (Database cloud)

1. Vai su **https://cloud.mongodb.com** e crea un account gratuito
2. Clicca **"Build a Database"** → scegli **M0 FREE**
3. Provider: **AWS**, Regione: **Europe (Frankfurt)** (più vicino all'Italia)
4. Nome cluster: `app-abbraccio`
5. Clicca **"Create"**

### Configura accesso:
6. **Database Access** → Add New User:
   - Username: `abbraccio-admin`
   - Password: genera una password sicura (salvala!)
   - Role: **Atlas Admin**

7. **Network Access** → Add IP Address:
   - Clicca **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ Per maggiore sicurezza in futuro, aggiungi solo l'IP di Render

8. **Connect** → **Drivers** → copia la stringa di connessione:
   ```
   mongodb+srv://abbraccio-admin:PASSWORD@cluster0.xxxxx.mongodb.net/app-abbraccio?retryWrites=true&w=majority
   ```
   Sostituisci `PASSWORD` con la password che hai scelto.

---

## PASSO 3 — Render (Backend)

1. Vai su **https://render.com** e crea un account (usa GitHub per login)
2. Clicca **"New +"** → **"Web Service"**
3. Connetti il repository GitHub `app-abbraccio`
4. Configura:
   - **Name**: `app-abbraccio-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: Free (o Starter $7/mese per non avere sleep dopo 15 min)

5. **Environment Variables** — aggiungi queste variabili:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `MONGODB_URI` | `mongodb+srv://abbraccio-admin:PASSWORD@cluster0.xxxxx.mongodb.net/app-abbraccio?retryWrites=true&w=majority` |
   | `JWT_SECRET` | `una-stringa-segreta-lunga-almeno-32-caratteri-CAMBIALA` |
   | `FRONTEND_URL` | `https://app-abbraccio-frontend-rw2c.vercel.app` (lo aggiungi dopo il deploy Vercel) |

6. Clicca **"Create Web Service"**
7. Aspetta il deploy (5-10 minuti)
8. Copia l'URL del backend: `https://app-abbraccio-backend.onrender.com`

### Disco persistente per allegati:
9. Vai su **Settings** → **Disks** → **Add Disk**:
   - Name: `uploads`
   - Mount Path: `/opt/render/project/src/uploads`
   - Size: 1 GB (gratuito)

---

## PASSO 4 — Vercel (Frontend)

### Prima: aggiorna la variabile d'ambiente del frontend

Crea il file `frontend/.env.production`:
```
VITE_API_URL=https://app-abbraccio-backend.onrender.com/api
```

Poi fai commit e push:
```bash
git add .
git commit -m "Add production env"
git push
```

### Deploy su Vercel:
1. Vai su **https://vercel.com** e crea un account (usa GitHub)
2. Clicca **"New Project"**
3. Importa il repository `app-abbraccio`
4. Configura:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | `https://app-abbraccio.onrender.com/api` |
6. Clicca **"Deploy"**
7. Aspetta 2-3 minuti
8. Il tuo URL sarà: `https://app-abbraccio-frontend-rw2c.vercel.app`

---

## PASSO 5 — Aggiorna FRONTEND_URL su Render

Ora che hai l'URL di Vercel, torna su Render:
1. **Environment** → modifica `FRONTEND_URL` con `https://app-abbraccio-frontend-rw2c.vercel.app`
2. Render riavvierà automaticamente il backend

---

## ✅ Verifica finale

Apri `https://app-abbraccio-frontend-rw2c.vercel.app` nel browser.
Dovresti vedere la pagina di login dell'app.

Testa:
- [ ] Login funziona
- [ ] Pazienti si caricano
- [ ] Piano di lavoro funziona
- [ ] Allegati si aprono

---

## 📱 Accesso da smartphone

L'app è già una **Progressive Web App (PWA)**. Da smartphone:

**iPhone/iPad:**
1. Apri Safari → vai su `https://app-abbraccio-frontend-rw2c.vercel.app`
2. Tocca il pulsante **Condividi** (quadrato con freccia)
3. Scorri e tocca **"Aggiungi a schermata Home"**
4. L'app apparirà come icona sul telefono!

**Android:**
1. Apri Chrome → vai su `https://app-abbraccio-frontend-rw2c.vercel.app`
2. Tocca i tre puntini in alto a destra
3. Tocca **"Aggiungi a schermata Home"**

---

## 🔒 Sicurezza

- ✅ Tutti i dati viaggiano su HTTPS (crittografati)
- ✅ Autenticazione JWT con token 30 giorni
- ✅ Database MongoDB Atlas con accesso protetto da password
- ✅ Repository GitHub privato
- ⚠️ Cambia il `JWT_SECRET` con una stringa lunga e casuale
- ⚠️ Non condividere mai le credenziali MongoDB

---

## 💰 Costi

| Servizio | Piano | Costo |
|----------|-------|-------|
| MongoDB Atlas | M0 Free | **GRATUITO** (512MB) |
| Render | Free | **GRATUITO** (si "addormenta" dopo 15 min inattività) |
| Render | Starter | **$7/mese** (sempre attivo, consigliato) |
| Vercel | Hobby | **GRATUITO** |
| **Totale** | Free | **€0/mese** |
| **Totale** | Produzione | **~€7/mese** |

---

## 🆘 Problemi comuni

**"Application Error" su Render:**
→ Controlla i log su Render Dashboard → Logs

**"CORS error" nel browser:**
→ Verifica che `FRONTEND_URL` su Render corrisponda esattamente all'URL Vercel

**Database non si connette:**
→ Verifica la stringa `MONGODB_URI` e che l'IP 0.0.0.0/0 sia autorizzato su Atlas

**Allegati non si caricano:**
→ Verifica che il disco sia montato su Render (Settings → Disks)
