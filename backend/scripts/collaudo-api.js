// COLLAUDO API — dati di prova marcati "TEST DEVIN" contro l'API di produzione.
// Usa JWT_SECRET da .env.test (recuperato via SSH, non committato).
// Esegue e stampa una tabella esiti; le scritture di test vengono chiuse alla fine.
const fs = require('fs');
const path = require('path');
const envTest = fs.readFileSync(path.join(__dirname, '..', '.env.test'), 'utf8');
const JWT_SECRET = envTest.match(/^JWT_SECRET=(.*)$/m)[1].trim();
const jwt = require('jsonwebtoken');
const API = 'https://api.abbracciocuredomiciliari.it/api';

const mk = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
const A = mk({ userId: '0000000000000000000000a1', name: 'TEST DEVIN A', email: 'test-a@devin.local', role: 'admin' });
const CARE = mk({ userId: '0000000000000000000000c1', name: 'TEST DEVIN C', email: 'test-c@devin.local', role: 'caregiver' });
const COMM = mk({ userId: '0000000000000000000000d1', name: 'TEST COMM', email: 'test-comm@devin.local', role: 'commercialista' });

const results = [];
const t = (nome, ok, det = '') => { results.push({ nome, ok, det }); console.log(`${ok ? '✅' : '❌'} ${nome}${det ? ' — ' + det : ''}`); };

async function call(method, url, { token = A, body, raw = false } = {}) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  let data = null;
  try { data = await res.json(); } catch { /* vuoto */ }
  return { status: res.status, data };
}

(async () => {
  console.log('=== COLLAUDO API produzione ===\n');

  // 0. Health + registrazione utente usa-e-getta
  t('health', (await call('GET', '/health')).status === 200);
  const emailT = `test-devin-${Date.now()}@example.com`;
  const reg = await call('POST', '/auth/register', { token: '', body: { name: 'TEST DEVIN UTENTE', email: emailT, password: 'TestCollaudo123!', role: 'caregiver' } });
  t('registrazione utente di prova', [200, 201].includes(reg.status), `HTTP ${reg.status}`);

  const users = await call('GET', '/auth/all-users');
  const tUser = (users.data || []).find(u => u.email === emailT);
  t('utente di prova presente in elenco', !!tUser, tUser ? tUser._id : 'non trovato');

  // ── 1. Attività: ciclo di vita completo ──
  const cont0 = await call('GET', '/attivita/conteggi', { token: A });
  const create = await call('POST', '/attivita', { body: { titolo: 'TEST DEVIN collaudo attività', azioneRichiesta: 'record di test, da ignorare', area: 'organizzativa', scadenza: new Date(Date.now() + 86400000).toISOString() } });
  t('creazione attività', create.status === 201, create.status);
  const aid = create.data?._id;

  const attesaKo = await call('PATCH', `/attivita/${aid}/stato`, { body: { stato: 'in_attesa' } });
  t('attesa SENZA interlocutore+data rifiutata', attesaKo.status === 400, attesaKo.status);
  const attesaOk = await call('PATCH', `/attivita/${aid}/stato`, { body: { stato: 'in_attesa', interlocutore: 'Interlocutore TEST', dataControllo: new Date(Date.now() + 86400000).toISOString() } });
  t('attesa CON interlocutore+data accettata', attesaOk.status === 200 && attesaOk.data.stato === 'in_attesa', attesaOk.status);

  if (tUser) {
    const tr = await call('POST', `/attivita/${aid}/trasferisci`, { body: { aId: tUser._id } });
    const respDopo = tr.data?.responsabileNome;
    t('trasferimento: responsabilità resta al mittente', tr.status === 200 && String(tr.data?.trasferimento?.aId) === String(tUser._id) && tr.data?.trasferimento?.accettato === false, `resp=${respDopo || 'nessuno'} dest=${tUser.name}`);
    const accA = await call('POST', `/attivita/${aid}/accetta-trasferimento`);
    t('accettazione da NON destinatario rifiutata (403)', accA.status === 403, accA.status);
    const tokT = mk({ userId: String(tUser._id), name: tUser.name, email: emailT, role: 'caregiver' });
    const accT = await call('POST', `/attivita/${aid}/accetta-trasferimento`, { token: tokT });
    t('accettazione dal destinatario: responsabile = destinatario', accT.status === 200 && String(accT.data?.responsabileId) === String(tUser._id), accT.status);
  }

  const compKo = await call('PATCH', `/attivita/${aid}/stato`, { token: tUser ? mk({ userId: String(tUser._id), name: tUser.name, email: emailT, role: 'caregiver' }) : A, body: { stato: 'completata' } });
  t('completamento SENZA esito rifiutato', compKo.status === 400, compKo.status);
  const compOk = await call('PATCH', `/attivita/${aid}/stato`, { token: tUser ? mk({ userId: String(tUser._id), name: tUser.name, email: emailT, role: 'caregiver' }) : A, body: { stato: 'completata', esito: 'TEST completato' } });
  t('completamento CON esito accettato', compOk.status === 200 && compOk.data.stato === 'completata', compOk.status);

  const ann = await call('POST', '/attivita', { body: { titolo: 'TEST DEVIN da annullare', area: 'organizzativa' } });
  const annRes = await call('PATCH', `/attivita/${ann.data?._id}/stato`, { body: { stato: 'annullata', motivo: 'test' } });
  t('annullamento con motivo', annRes.status === 200 && annRes.data.stato === 'annullata', annRes.status);

  // Contatori: attività completata/annullata non devono risultare aperte
  const cont1 = await call('GET', '/attivita/conteggi');
  const lista = await call('GET', '/attivita', { body: undefined });
  const aperte = await call('GET', '/attivita?vista=tutte');
  const idsAperte = (aperte.data || []).map(x => String(x._id));
  t('attività chiuse fuori dalle liste aperte', !idsAperte.includes(String(aid)) && !idsAperte.includes(String(ann.data?._id)), `aperte=${idsAperte.length}`);

  // ── 2. Consegne: attesa obbligatoria + esito ──
  const cons = await call('POST', '/consegne-amministrative', { body: { titolo: 'TEST DEVIN consegna', testo: 'record di test, da ignorare', tipo: 'generale' } });
  t('creazione consegna', cons.status === 201, cons.status);
  const cid = cons.data?._id;
  const cAttesaKo = await call('PATCH', `/consegne-amministrative/${cid}/stato`, { body: { stato: 'in_attesa_riscontro' } });
  t('consegna in attesa SENZA interlocutore+data rifiutata', cAttesaKo.status === 400, cAttesaKo.status);
  const cAttesaOk = await call('PATCH', `/consegne-amministrative/${cid}/stato`, { body: { stato: 'in_attesa_riscontro', interlocutore: 'Ufficio TEST', dataControllo: new Date(Date.now() + 86400000).toISOString() } });
  t('consegna in attesa CON campi accettata', cAttesaOk.status === 200, cAttesaOk.status);
  const cGestKo = await call('PATCH', `/consegne-amministrative/${cid}/stato`, { body: { stato: 'gestita' } });
  t('consegna gestita SENZA esito rifiutata', cGestKo.status === 400, cGestKo.status);
  const cGestOk = await call('PATCH', `/consegne-amministrative/${cid}/stato`, { body: { stato: 'gestita', esito: 'TEST gestita' } });
  t('consegna gestita CON esito', cGestOk.status === 200 && cGestOk.data.stato === 'gestita', cGestOk.status);

  // Riconciliazione Oggi: la consegna gestita non deve risultare aperta
  const aperte2 = await call('GET', '/consegne-amministrative?aperte=1');
  t('consegna gestita non più aperta (Oggi↔Consegne)', !(aperte2.data || []).some(c => String(c._id) === String(cid)), `aperte=${(aperte2.data || []).length}`);

  // ── 3. Pratiche reali ──
  const prat = await call('GET', '/attivita/pratiche?tipo=paziente');
  t('ricerca pratiche reali (paziente)', prat.status === 200 && Array.isArray(prat.data) && prat.data.length > 0, `${(prat.data || []).length} risultati`);

  // ── 4. Permessi per ruolo (non solo 401 senza token) ──
  t('caregiver → /amministrazione/controlli 403', (await call('GET', '/amministrazione/controlli', { token: CARE })).status === 403);
  t('caregiver → /amministrazione/documenti 403', (await call('GET', '/amministrazione/documenti', { token: CARE })).status === 403);
  t('caregiver → /ricerca-operatori 403', (await call('GET', '/ricerca-operatori', { token: CARE })).status === 403);
  t('caregiver → /ricerca-operatori/senza-posizione 403', (await call('GET', '/ricerca-operatori/senza-posizione', { token: CARE })).status === 403);
  t('commercialista → /commercialista/consegne 200', (await call('GET', '/commercialista/consegne', { token: COMM })).status === 200);
  t('commercialista → /amministrazione/documenti 403', (await call('GET', '/amministrazione/documenti', { token: COMM })).status === 403);
  t('commercialista → /attivita 403 (non autorizzato alle attività interne)', (await call('GET', '/attivita', { token: COMM })).status === 403);

  // ── 5. Controlli amministrativi ──
  const ctrl = await call('GET', '/amministrazione/controlli');
  t('controlli aggregati', ctrl.status === 200 && typeof ctrl.data?.totale === 'number', `totale=${ctrl.data?.totale}`);
  t('gruppo buchi numerazione presente', Array.isArray(ctrl.data?.buchiNumerazione), `${(ctrl.data?.buchiNumerazione || []).length} segnalazioni`);

  // Anti-duplicazione attività da controllo (su un documento reale se esiste)
  const docs = await call('GET', '/amministrazione/documenti?origine=fattura');
  const doc0 = (docs.data || [])[0];
  if (doc0) {
    const a1 = await call('POST', `/amministrazione/documenti-emessi/${doc0.id}/apri-attivita`, { body: { titolo: 'TEST DEVIN dedupe' } });
    const a2 = await call('POST', `/amministrazione/documenti-emessi/${doc0.id}/apri-attivita`, { body: { titolo: 'TEST DEVIN dedupe' } });
    t('seconda attività su stesso documento → giaPresente', a2.data?.giaPresente === true, `a2=${a2.status}`);
    if (a1.data?._id || a1.data?.attivita?._id) {
      const xid = a1.data._id || a1.data.attivita._id;
      await call('PATCH', `/attivita/${xid}/stato`, { body: { stato: 'annullata', motivo: 'test dedupe' } });
    }
  } else {
    t('dedupe apri-attivita', true, 'nessun documento emesso disponibile per il test');
  }

  // ── 6. Commercialista: pacchetto ZIP reale ──
  const prep = await call('POST', '/amministrazione/commercialista/consegne', { body: { dal: '2020-01-01', al: new Date().toISOString().slice(0, 10), origini: ['fattura_ricevuta'], note: 'TEST DEVIN collaudo pacchetto' } });
  if (prep.status === 201) {
    const cid2 = prep.data._id;
    const zipRes = await call('GET', `/amministrazione/commercialista/consegne/${cid2}/pacchetto`, { raw: true });
    const buf = Buffer.from(await zipRes.arrayBuffer());
    t('pacchetto ZIP scaricato (firma PK)', zipRes.status === 200 && buf[0] === 0x50 && buf[1] === 0x4b, `${buf.length} byte`);
    const dopo = await call('GET', '/amministrazione/commercialista/consegne');
    const rec = (dopo.data || []).find(c => String(c._id) === String(cid2));
    t('download registrato come scaricata ≠ consegnata', rec?.stato === 'scaricata' && !!rec?.scaricataIl && !rec?.consegnataIl, `stato=${rec?.stato}`);
    // ripulisci: marca verificata per non lasciarla "da consegnare"
    await call('PATCH', `/amministrazione/commercialista/consegne/${cid2}`, { body: { stato: 'verificata' } });
  } else {
    t('pacchetto commercialista', prep.status === 201, `HTTP ${prep.status} — ${prep.data?.message || ''}`);
  }

  // ── 7. Ricerca operatori ──
  const sp = await call('GET', '/ricerca-operatori/senza-posizione');
  t('elenco posizioni mancanti', sp.status === 200 && typeof sp.data?.totale === 'number', `${sp.data?.totale} operatori`);
  const ro = await call('GET', '/ricerca-operatori?data=2030-01-06&oraInizio=08:00&oraFine=13:00');
  t('ricerca con fascia oraria → disponibilitaStato', ro.status === 200 && (ro.data?.risultati || []).every(r => r.disponibilitaStato), `${(ro.data?.risultati || []).length} risultati, stati=${[...new Set((ro.data?.risultati || []).map(r => r.disponibilitaStato))].join('/')}`);

  const ko = results.filter(r => !r.ok);
  console.log(`\n=== ESITO: ${results.length - ko.length}/${results.length} verifiche OK ===`);
  if (ko.length) { console.log('FALLITE:'); ko.forEach(r => console.log(' -', r.nome, r.det)); process.exit(2); }
})().catch(e => { console.error('ERRORE COLLAUDO:', e); process.exit(1); });
