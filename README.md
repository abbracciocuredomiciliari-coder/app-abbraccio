# App Abbraccio

Gestionale per assistenza domiciliare con pazienti, personale e piano di lavoro.

## Struttura

- `backend`: API Node.js + Express + TypeScript
- `frontend`: app React + TypeScript + Vite

## Avvio rapido

1. Installare le dipendenze:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

2. Creare il file di ambiente per il backend:

```bash
cp backend/.env.example backend/.env
```

3. Avviare il backend:

```bash
npm --prefix backend run dev
```

4. Avviare il frontend:

```bash
npm --prefix frontend run dev
```

5. Uso dell'app:

- Apri `http://localhost:3000`
- Usa la pagina `Login` per autenticarti
- Puoi registrarti tramite `Registrati`
- Dopo il login, visualizzerai `Dashboard`, `Pazienti`, `Personale` e `Piano di lavoro`

6. Come inserire dati:

- **Pazienti**: Nella pagina "Pazienti", clicca "Aggiungi Paziente" e compila il form
- **Personale**: Nella pagina "Personale", clicca "Aggiungi Personale" e compila il form
- **Incarichi**: Nella pagina "Piano di lavoro", seleziona paziente e operatore, inserisci attività e data

7. Note sulle API:

- Le chiamate a `/api/patients` e `/api/staff` richiedono autenticazione
- La dashboard `/api/dashboard` è protetta e accessibile a ruoli `admin` o `coordinator`
- L'endpoint `/api/auth/me` restituisce i dati dell'utente corrente

7. Variabili ambiente frontend:

- Imposta `VITE_API_BASE_URL` in un file `.env` nella cartella `frontend` se vuoi usare un URL API diverso da `http://localhost:4000/api`

## Convenzioni

- `backend/src`: logica API ed endpoint
- `frontend/src`: interfaccia utente React
