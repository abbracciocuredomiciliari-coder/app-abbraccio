---
description: Verifica incrementale e pubblicazione del modulo Telemedicina
---

# Verifica e pubblicazione Telemedicina

## Pre-requisiti
- Backend avviato (`npm start` o `node dist/index.js`) e MongoDB raggiungibile.
- Frontend buildato o in dev (`npm run dev`).
- SMTP configurato per ricevere inviti (opzionale: in test si possono controllare i log).

## Fase 0/1 — Fondazioni e ruoli
1. Accedere come admin/coordinatore.
2. Aprire **Telemedicina** dal menu laterale.
3. Verificare che compaiano le schede: Agenda, Nuovo, Dispositivi, Professioni, Report, Governance, Pacchetti.

## Fase 1 — Video-consulto
1. Tab **Nuovo**: selezionare un paziente, data/ora, professione e un partecipante esterno (nome + email).
2. Salvare: controllare che il teleconsulto appaia in **Agenda** e che venga inviata email (log SMTP).
3. Cliccare **Entra in sala**: verificare la pagina `/telemedicina/sala?id=...` con iframe Jitsi.
4. Nella sala, inserire note di ingresso/uscita e salvare.

## Fase 2 — Caregiver/Paziente
1. Loggarsi come `paziente_registrato`.
2. Aprire **Telemedicina** dal menu e verificare la lista appuntamenti.
3. Cliccare **Entra nella sala** e confermare apertura della stessa room dell'operatore.

## Fase 3 — Dispositivi e parametri
1. Tab **Dispositivi**: aggiungere un dispositivo a un paziente.
2. Inserire manualmente un parametro vitale; verificare che venga evidenziato come anomalo se fuori soglia.
3. Controllare in **Agenda → Alert aperti** (o nel componente Dispositivi) che sia stato creato un alert.
4. Cliccare **Sincronizza** dispositivo: verificare messaggio di registrazione.

## Fase 4 — AI / Report
1. Tab **Report**: selezionare paziente, generare riepilogo.
2. Verificare che compaiano ultimi valori, anomalie, teleconsulti e raccomandazioni.

## Fase 5 — Governance
1. Tab **Governance**: creare una soglia personalizzata e un protocollo per una professione.
2. Inserire un parametro che violi la soglia: verificare alert con soglia personalizzata.

## Fase 6 — Business
1. Tab **Pacchetti**: creare un pacchetto commerciale con professioni, dispositivi e parametri inclusi.
2. Verificare che compaia nella lista pacchetti attivi.

## Pubblicazione
- `npm run build` nel frontend deve completarsi senza errori.
- `npx tsc --noEmit` nel backend deve passare.
- Deploy del backend e del frontend secondo la normale pipeline (Render/Vercel/PM2).
