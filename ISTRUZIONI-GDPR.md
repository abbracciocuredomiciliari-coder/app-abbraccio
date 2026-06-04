# 📋 Istruzioni Operative - GDPR App Abbraccio

## 🎯 COSA DEVI FARE SUBITO

### 1. Aggiungi la chiave di criptazione al backend

Vai su Render (o dove hai deployato il backend) → Environment Variables:

```
ENCRYPTION_KEY=questa-deve-essere-esattamente-32-car!!
```

**Come generarla:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"
```

### 2. Riavvia il server
Su Render → clicca "Manual Deploy" → "Clear Build Cache & Deploy"

---

## 🚀 GUIDA ALL'USO

### Per ogni NUOVO PAZIENTE:

1. **Vai a**: Menu → "Consensi GDPR"
2. **Cerca** il paziente (inizia a scrivere il nome)
3. **Clicca** sul paziente trovato
4. **Clicca** "Registra Consenso"
5. **Compila** il form:
   - Scegli chi firma (paziente/tutore)
   - Nome e cognome del firmatario
   - Spunta le finalità (normalmente tutte tranne ricerca)
   - Spunta i dati sensibili autorizzati
6. **Clicca** "Registra Consenso"
7. **Stampa** il PDF con il pulsante "Stampa"
8. **Fai firmare** il documento al paziente
9. **Conserva** il documento cartaceo (obbligo legale 10 anni)

### Per REVOCARE un consenso:

1. Cerca il paziente
2. Trova il consenso attivo (verde)
3. Clicca "Revoca"
4. Conferma
5. Il paziente dovrà firmare un nuovo consenso per riattivare i servizi

### Per VEDERE l'INFORMATIVA PRIVACY:

- URL pubblica: `https://tuo-dominio.com/informativa-privacy.html`
- Puoi stamparla e farla leggere ai pazienti

---

## 📊 COME FUNZIONA IL SISTEMA

### Tracciabilità automatica
Il sistema registra automaticamente:
- Chi ha guardato un paziente
- Chi ha modificato i dati
- Da quale IP
- A che ora
- Per quanto tempo

**Dove vedi i log:** Admin può chiamare `GET /api/audit-log` (solo admin)

### Rate Limiting (protezione)
- Massimo 5 tentativi di login ogni 15 minuti
- Massimo 100 chiamate API al minuto per utente
- Blocco automatico se superi i limiti

### Criptazione
- I dati sensibili sono criptati con AES-256
- La chiave è in `ENCRYPTION_KEY` (environment variable)
- Senza quella chiave i dati sono irrecuperabili

---

## ⚠️ CHECKLIST OBBLIGHI GDPR

### ✅ Devi avere (già fatto dal sistema):
- [x] Audit log tracciato
- [x] Criptazione dati
- [x] Rate limiting
- [x] Accesso JWT sicuro
- [x] Informativa privacy online

### 📋 Devi fare tu:
- [ ] Personalizzare `informativa-privacy.html` con i tuoi dati (nome struttura, indirizzo, DPO)
- [ ] Registrare consenso per OGNI paziente attivo
- [ ] Stampare e far firmare ogni consenso
- [ ] Conservare i consensi firmati per 10 anni
- [ ] Nominare un DPO (Responsabile Protezione Dati) se hai più di 10 dipendenti
- [ ] Creare una PEC per comunicazioni legali

### 📄 Documenti da avere pronti:
1. Registro attività trattamento (già in `GDPR-COMPLIANCE.md`)
2. Nomina incaricati (i tuoi operatori)
3. Informativa privacy (già creata, da personalizzare)
4. Modulo consenso (generato automaticamente dall'app)

---

## 🆘 IN CASO DI PROBLEMI

### "Errore: ENCRYPTION_KEY non impostata"
→ Aggiungi la variabile d'ambiente su Render e riavvia

### "Rate limit superato"
→ Aspetta 15 minuti o contatta l'admin

### "Non riesco a registrare consenso"
→ Verifica che il paziente esista in "Pazienti"
→ Verifica di essere loggato come admin/coordinator

---

## 📞 CONTATTI UTILI

- **Garante Privacy**: www.garanteprivacy.it
- **Numero verde**: 06.696771
- **Email per breach**: dpo@tua-struttura.it (da configurare)

---

**Ultimo aggiornamento**: 4 Giugno 2026
