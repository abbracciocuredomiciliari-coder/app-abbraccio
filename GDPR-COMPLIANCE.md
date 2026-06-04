# 🛡️ GDPR Compliance - App Abbraccio Cure Domiciliari

## 📋 Documento di Registro delle Attività di Trattamento (Art. 30 GDPR)

### Responsabile della Protezione Dati (DPO)
- **Nome:** [Da nominare]
- **Email:** privacy@abbraccio-cure.it
- **Telefono:** [Da inserire]

---

## 🔒 Misure di Sicurezza Implementate

### 1. AUTENTICAZIONE E ACCESSO
| Misure | Stato | Dettaglio |
|--------|-------|-----------|
| JWT Token | ✅ | Scadenza 24h, firma HMAC SHA-256 |
| RBAC | ✅ | Ruoli: admin, coordinator, operatore, direttore |
| Rate Limiting | ✅ | 5 tentativi login / 15 min |
| HSTS | ✅ | HTTPS forzato, preload |

### 2. TRACCIABILITÀ (Audit Trail)
| Elemento | Tracciato |
|----------|-----------|
| Chi | User ID, Email, Ruolo |
| Cosa | Azione (READ/CREATE/UPDATE/DELETE) |
| Quando | Timestamp preciso |
| Dove | IP Address, User Agent |
| Su cosa | Risorsa e ID specifico |

**Conservazione log:** 2 anni (conforme GDPR art. 30)

### 3. CONSENSO INFORMATO
- ✅ Registrazione digitale consensi
- ✅ Versione informativa tracciata
- ✅ Revoca consenso possibile
- ✅ Pseudonimizzazione paziente

### 4. PROTEZIONE DATI
| Tipo | Protezione |
|------|------------|
| Dati sanitari | Pseudonimizzazione su richiesta |
| Password | Hash bcrypt (non reversibile) |
| File upload | JWT required per accesso |
| Backup | Criptati (da implementare su produzione) |

---

## 📜 Diritti dell'Interessato (Art. 15-22 GDPR)

### 1. DIRITTO DI ACCESSO (Art. 15)
**Endpoint:** `GET /api/gdpr/report-trattamento/:patientId`

Genera report completo di tutti i dati del paziente.

### 2. DIRITTO DI RETTIFICA (Art. 16)
I dati possono essere aggiornati tramite le API standard con audit trail.

### 3. DIRITTO ALL'OBLIO (Art. 17)
**Endpoint:** `POST /api/gdpr/cancellazione-dati/:patientId`

Richiede conferma esplicita: `"CONFERMO CANCELLAZIONE DEFINITIVA"`

### 4. DIRITTO DI LIMITAZIONE (Art. 18)
Implementato tramite revoca consenso: `POST /api/gdpr/revoca/:patientId`

### 5. DIRITTO ALLA PORTABILITÀ (Art. 20)
Report trattamento esportabile in JSON.

### 6. DIRITTO DI OPPOSIZIONE (Art. 21)
Revoca consenso per specifiche finalità.

---

## 🔐 Checklist Sicurezza Tecnica

### Infrastructure
- [x] Helmet.js (security headers)
- [x] CORS limitato
- [x] Rate limiting
- [x] JWT authentication
- [x] HTTPS forzato (HSTS)
- [ ] WAF (Web Application Firewall) — consigliato
- [ ] IDS/IPS — consigliato

### Database
- [x] Auth MongoDB (username/password)
- [ ] TLS connection MongoDB — verificare
- [x] Indici query ottimizzati
- [x] TTL per audit log (2 anni)

### File Storage
- [x] Upload limitato (10MB)
- [x] JWT per accesso file
- [ ] Criptazione file a riposo — consigliata

### Password Policy
- [ ] Minimo 12 caratteri — da implementare
- [ ] Complessità (maiuscole, numeri, simboli) — da implementare
- [ ] Scadenza password (90 giorni) — opzionale
- [ ] 2FA per admin — consigliato

---

## ⚠️ Vulnerabilità Conosciute e Mitigazioni

| Rischio | Livello | Mitigazione |
|---------|---------|-------------|
| Brute force login | Medio | Rate limiting implementato |
| SQL/NoSQL Injection | Basso | Mongoose ORM usato |
| XSS | Basso | Helmet + React escaping |
| CSRF | Basso | JWT in header, non cookie |
| Data breach | Medio | Accesso loggato, RBAC |
| Insider threat | Medio | Audit trail completo |

---

## 📞 Procedure Incidente Breach (Art. 33-34)

### Timeline GDPR
- **72 ore:** Notifica al Garante
- **Senza ritardo:** Comunicazione agli interessati

### Contatti
- **Garante Privacy Italia:** https://www.garanteprivacy.it
- **Email breach:** dpo@abbraccio-cure.it

### Passi in caso di breach
1. Contenimento immediato
2. Valutazione impatto (DPIA)
3. Notifica entro 72h
4. Documentazione azioni correttive
5. Revisione misure di sicurezza

---

## 📝 Configurazione Richiesta (.env)

```bash
# Obbligatorio per sicurezza
JWT_SECRET=<chiave-256-bit-minimo>
ENCRYPTION_KEY=<chiave-32-caratteri-aes>
MONGODB_URI=mongodb+srv://user:pass@host/db?tls=true

# Rate limiting (opzionale)
RATE_LIMIT_LOGIN=5
RATE_LIMIT_WINDOW=900000

# Frontend
FRONTEND_URL=https://tuo-dominio.vercel.app

# Email (per notifiche breach)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
```

---

## ✅ Piano d'Azione GDPR

### Priorità Alta (Immediato)
- [x] Audit trail implementato
- [x] Rate limiting attivo
- [x] GDPR endpoints creati
- [ ] Aggiungere ENCRYPTION_KEY a .env
- [ ] Abilitare TLS su MongoDB
- [ ] Configurare backup criptati

### Priorità Media (30 giorni)
- [ ] Implementare password policy forte
- [ ] Aggiungere 2FA per admin
- [ ] Configurare WAF (Cloudflare/ModSecurity)
- [ ] Penetration test esterno
- [ ] Formazione staff GDPR

### Priorità Bassa (90 giorni)
- [ ] Certificazione ISO 27001
- [ ] Data Protection Impact Assessment (DPIA)
- [ ] Contratti con sub-responsabili

---

## 📚 Documentazione Legale Richiesta

1. **Informativa Privacy** (da mostrare a pazienti)
2. **Consenso Informato** (digitale, tracciato)
3. **Registro Trattamenti** (questo documento)
4. **Nomina Responsabili** (incaricati dati)
5. **Contratti con fornitori** (clausole GDPR)

---

## 🔗 Riferimenti Utili

- [Garante Privacy - Toolkit GDPR](https://www.garanteprivacy.it/titolare)
- [GDPR Testo Ufficiale](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Ultimo aggiornamento:** 4 Giugno 2026  
**Versione:** 1.0  
**Prossima revisione:** 4 Settembre 2026
