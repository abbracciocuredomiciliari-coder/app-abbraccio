import { useState, useEffect } from 'react';
import api from '../api/api';
import { Shield, FileText, CheckCircle, XCircle, AlertCircle, Search, User, Calendar, Printer, Save, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

interface Consenso {
  _id: string; patientId: string; pazienteAnonimoId: string;
  finalita: { prestazioneSanitaria: boolean; fatturazione: boolean; auditInterno: boolean; ricercaScientifica: boolean };
  datiSensibili: { datiSanitari: boolean; datiEconomici: boolean; immagini: boolean };
  comunicazioneTerzi: { mediciSpecialisti: boolean; struttureSanitarie: boolean; familiari: boolean; assicurazioni: boolean };
  firmatoDa: 'paziente' | 'tutore' | 'rappresentanteLegale';
  nomeFirmatario: string; cognomeFirmatario: string; dataFirma: string;
  versioneInformativa: string; revocato: boolean; dataRevoca?: string; operatoreEmail: string;
}

interface Patient { _id: string; firstName: string; lastName: string; birthDate?: string; }

export default function GestioneConsensiGDPR() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [consensi, setConsensi] = useState<Consenso[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(''); const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
    datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
    comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false },
    firmatoDa: 'paziente' as const, nomeFirmatario: '', cognomeFirmatario: '', versioneInformativa: 'v2024.1',
  });

  useEffect(() => { loadPatients(); }, []);
  useEffect(() => { if (selectedPatient) loadConsenso(selectedPatient._id); }, [selectedPatient]);

  const loadPatients = async () => { try { const res = await api.get('/patients'); setPatients(res.data); } catch (e) { console.error(e); } };
  const loadConsenso = async (id: string) => { setLoading(true); try { const res = await api.get(`/gdpr/consenso/${id}`); setConsensi([res.data.consenso]); } catch { setConsensi([]); } finally { setLoading(false); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedPatient) return;
    setSaving(true);
    try {
      await api.post('/gdpr/consenso', { patientId: selectedPatient._id, ...formData });
      setMessage('Consenso registrato!'); setShowForm(false); loadConsenso(selectedPatient._id);
      setFormData({ finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false }, datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false }, comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false }, firmatoDa: 'paziente', nomeFirmatario: '', cognomeFirmatario: '', versioneInformativa: 'v2024.1' });
    } catch (e: any) { setMessage(`Errore: ${e.response?.data?.message || e.message}`); } finally { setSaving(false); }
  };

  const revocaConsenso = async (patientId: string) => {
    if (!confirm('Revocare il consenso? Il paziente dovrà firmare nuovamente.')) return;
    try { await api.post(`/gdpr/revoca/${patientId}`, { motivoRevoca: 'Richiesta paziente' }); setMessage('Consenso revocato!'); loadConsenso(patientId); } catch (e: any) { setMessage(`Errore: ${e.response?.data?.message}`); }
  };

  const filteredPatients = patients.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const formatDate = (d: string) => new Date(d).toLocaleDateString('it-IT');

  const stampaConsenso = (c: Consenso, p: Patient) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const dataFirmaFmt = formatDate(c.dataFirma);
    const nascitaFmt = p.birthDate ? new Date(p.birthDate).toLocaleDateString('it-IT') : '_______________';
    win.document.write(`<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<title>Informativa Privacy e Consenso - ${p.firstName} ${p.lastName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:10pt;line-height:1.6;color:#111;padding:28px 36px}
  .header{text-align:center;border-bottom:2px solid #1e4d8c;padding-bottom:14px;margin-bottom:18px}
  .header h1{color:#1e4d8c;font-size:12pt;text-transform:uppercase;letter-spacing:0.4px}
  .header p{font-size:9pt;color:#555;margin-top:4px}
  .paziente-box{background:#f0f4ff;border:1px solid #c7d7f0;border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:9.5pt}
  .paziente-box strong{color:#1e4d8c}
  h2{font-size:9.5pt;color:#1e4d8c;text-transform:uppercase;background:#f0f4ff;border-left:3px solid #1e4d8c;padding:5px 10px;margin:14px 0 8px}
  p{margin-bottom:8px;font-size:9.5pt}
  ul{margin:4px 0 10px 20px}
  ul li{font-size:9.5pt;margin-bottom:4px}
  .highlight{background:#fef3c7;border-left:3px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}
  .consenso-box{border:2px solid #1e4d8c;border-radius:6px;padding:16px 20px;margin-top:20px;background:#fafbff}
  .consenso-box h3{color:#1e4d8c;font-size:10pt;margin-bottom:10px}
  .consenso-row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e5e7eb;gap:20px}
  .cb-group{display:flex;gap:28px;flex-shrink:0;font-size:9pt}
  .cb-group label{display:flex;align-items:center;gap:4px}
  .firma-grid{display:grid;grid-template-columns:1fr 1fr 2fr;gap:16px;margin-top:20px;border-top:1px dashed #aaa;padding-top:16px}
  .firma-field label{display:block;font-size:8pt;color:#666;font-weight:bold;text-transform:uppercase;margin-bottom:5px}
  .firma-field .line{border-bottom:1px solid #333;min-height:28px}
  .footer{text-align:center;font-size:8pt;color:#999;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb}
  @media print{body{padding:16px}}
</style></head><body>

<div class="header">
  <h1>Informativa sul trattamento dei dati personali<br>e di categoria particolare per l'erogazione dei servizi</h1>
  <p>Ai sensi del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003</p>
</div>

<div class="paziente-box">
  <strong>Paziente:</strong> ${p.firstName} ${p.lastName} &nbsp;|&nbsp;
  <strong>Nato/a il:</strong> ${nascitaFmt} &nbsp;|&nbsp;
  <strong>Data firma:</strong> ${dataFirmaFmt} &nbsp;|&nbsp;
  <strong>Firmatario:</strong> ${c.nomeFirmatario} ${c.cognomeFirmatario} (${c.firmatoDa})
</div>

<p>Gent. Sig.ra / Egr. Sig. <strong>${p.firstName} ${p.lastName}</strong>,<br>
con la presente desideriamo comunicarLe che per l'instaurazione e la gestione del Servizio di assistenza domiciliare integrata, la nostra Società, <strong>Abbraccio Cure Domiciliari</strong>, con sede legale in Roma, Via Di Santa Maria Ausiliatrice 4b, tratterà i Suoi Dati Personali in qualità di Responsabile del trattamento, ai sensi del Regolamento (UE) 2016/679 (GDPR).</p>

<h2>1. Oggetto del Trattamento</h2>
<p>Al fine di poterLe fornire i Servizi, la Società tratterà i seguenti dati:</p>
<ul>
  <li><strong>Dati comuni identificativi:</strong> nome, cognome, indirizzo, telefono, e-mail, residenza, ecc.</li>
  <li><strong>Categorie particolari di dati (art. 9 GDPR):</strong> dati idonei a rivelare lo stato di salute (documentazione sanitaria, cartelle cliniche).</li>
</ul>

<h2>2. Base Giuridica e Finalità del Trattamento</h2>
<p>I Dati saranno trattati, senza necessità di consenso, ai sensi di: art. 6 c.1 lett. b) e c) GDPR; art. 9 c.2 lett. b), h) e j) GDPR. Le finalità sono:</p>
<ul>
  <li>Puntuale adempimento del Servizio affidatoci;</li>
  <li>Adempimento di obblighi di legge connessi al Servizio;</li>
  <li>Gestione del contenzioso ed esercizio dei diritti in sede giudiziaria;</li>
  <li>Collaborazione con pubbliche autorità, prevenzione di atti illeciti.</li>
</ul>
<div class="highlight">Per finalità diverse sarà richiesto un Suo esplicito ulteriore consenso.</div>

<h2>3. Modalità del Trattamento</h2>
<p>Il trattamento potrà avvenire mediante supporto cartaceo, informatico o telematico, nel rispetto dei principi di liceità, correttezza e trasparenza, con misure adeguate di sicurezza (pseudonimizzazione, crittografia, controllo accessi).</p>

<h2>4. Comunicazione dei Dati</h2>
<p>I dati potranno essere comunicati a: enti pubblici (ASL, Ospedali, INAIL, INPS ecc.); farmacie, medici specialisti, professionisti sanitari; società di manutenzione tecnica; aziende di credito/assicurazione; consulenti legali, fiscali, amministrativi.</p>

<h2>5. Conservazione</h2>
<p>I dati saranno conservati <strong>non oltre 10 anni dalla cessazione del Servizio</strong>, ai sensi degli obblighi di legge vigenti. A fini statistici e storici, ai sensi dell'art. 89 par. 1 GDPR, con adeguate misure di pseudonimizzazione.</p>

<h2>6. I Suoi Diritti (artt. 15–21 GDPR)</h2>
<ul>
  <li><strong>Accesso (art. 15):</strong> ottenere conferma e copia dei dati trattati;</li>
  <li><strong>Rettifica (art. 16):</strong> correggere dati inesatti o incompleti;</li>
  <li><strong>Cancellazione / Oblio (art. 17):</strong> richiedere cancellazione o anonimizzazione;</li>
  <li><strong>Limitazione (art. 18):</strong> limitare il trattamento nei casi previsti;</li>
  <li><strong>Portabilità (art. 20):</strong> ricevere i dati in formato strutturato e leggibile;</li>
  <li><strong>Opposizione (art. 21):</strong> opporsi al trattamento per motivi legittimi;</li>
  <li><strong>Revoca del consenso:</strong> in qualsiasi momento, senza pregiudizio per il trattamento pregresso.</li>
</ul>

<h2>7. Contatti per Esercitare i Diritti e Reclamo al Garante</h2>
<ul>
  <li><strong>Abbraccio Cure Domiciliari:</strong> abbracciocuredomiciliari@gmail.com — Tel. 351 417 5117</li>
  <li><strong>Garante Privacy:</strong> Piazza di Monte Citorio 121, 00186 Roma — garante@gpdp.it — Fax 06-696773785</li>
  <li>Sito web: www.garanteprivacy.it</li>
</ul>

<div class="consenso-box">
  <h3>📋 CONSENSO AL TRATTAMENTO DEI DATI PERSONALI</h3>
  <p style="font-size:9pt;color:#555;margin-bottom:12px;">Preso atto dell'informativa sul trattamento dei dati personali e di categoria particolare per l'erogazione dei servizi sopra indicata:</p>

  <div class="consenso-row">
    <div style="flex:1;font-size:9.5pt">
      Acconsento al trattamento dei miei Dati Personali per le finalità di cui al paragrafo 2 dell'informativa, connesse alla corretta esecuzione del/i Servizio/i richiesto/i.
    </div>
    <div class="cb-group">
      <label><input type="checkbox" ${c.finalita.prestazioneSanitaria ? 'checked' : ''} disabled /> Acconsento</label>
      <label><input type="checkbox" ${!c.finalita.prestazioneSanitaria ? 'checked' : ''} disabled /> Non acconsento</label>
    </div>
  </div>

  <div class="firma-grid">
    <div class="firma-field"><label>Luogo</label><div class="line"></div></div>
    <div class="firma-field"><label>Data</label><div class="line">${dataFirmaFmt}</div></div>
    <div class="firma-field"><label>Firma dell'interessato</label><div class="line">${c.nomeFirmatario} ${c.cognomeFirmatario}</div></div>
  </div>
</div>

<div class="footer">
  Abbraccio Cure Domiciliari — Roma, Via Di Santa Maria Ausiliatrice 4b — Tel. 351 417 5117 — abbracciocuredomiciliari@gmail.com<br>
  Versione informativa: ${c.versioneInformativa} — Documento generato il ${new Date().toLocaleDateString('it-IT')}
</div>

<script>window.onload=function(){window.print()}</script>
</body></html>`);
    win.document.close();
    win.focus();
  };

  return (
    <section>
      <h2><Shield size={28} /> Gestione Consensi GDPR</h2>
      {message && (
        <Alert type={message.includes('successo') ? 'success' : 'error'} onClose={() => setMessage('')} style={{ marginBottom: '16px' }}>
          {message}
        </Alert>
      )}

      <div style={{ background: 'var(--gray-50)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}><Search size={20} /> Cerca Paziente</h3>
        <input type="text" placeholder="Nome o cognome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-300)' }} />
        {searchTerm && <div style={{ marginTop: '16px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: '8px' }}>
          {filteredPatients.map(p => <button key={p._id} onClick={() => { setSelectedPatient(p); setSearchTerm(''); setConsensi([]); }} style={{ width: '100%', padding: '12px', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--gray-100)', background: selectedPatient?._id === p._id ? '#dbeafe' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}><User size={20} color="#6b7280" /><div><div style={{ fontWeight: '600' }}>{p.firstName} {p.lastName}</div><div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{p.birthDate ? new Date(p.birthDate).toLocaleDateString('it-IT') : 'N/D'}</div></div></button>)}
        </div>}
      </div>

      {selectedPatient && <div style={{ background: 'linear-gradient(135deg, #1e4d8c 0%, #3b82f6 100%)', padding: '20px', borderRadius: '12px', color: 'white', marginBottom: '24px' }}><h3><User size={20} /> Paziente: {selectedPatient.firstName} {selectedPatient.lastName}</h3></div>}

      {selectedPatient && !loading && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3><FileText size={20} /> Consensi ({consensi.length})</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => loadConsenso(selectedPatient._id)} style={{ background: '#6b7280' }}><RefreshCw size={16} /> Aggiorna</button>
            <button onClick={() => setShowForm(!showForm)} style={{ background: consensi.some(c => !c.revocato) ? '#6b7280' : '#10b981' }}><Save size={16} /> {showForm ? 'Chiudi' : consensi.some(c => !c.revocato) ? 'Nuovo' : 'Registra'}</button>
          </div>
        </div>

        {consensi.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', background: '#fef3c7', borderRadius: '8px' }}><AlertCircle size={32} /><p>Nessun consenso registrato.</p></div> : consensi.map(c => <div key={c._id} style={{ padding: '20px', borderRadius: '12px', border: '2px solid', borderColor: c.revocato ? '#ef4444' : '#10b981', background: c.revocato ? '#fee2e2' : '#f0fdf4', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>{c.revocato ? <span style={{ color: '#dc2626', fontWeight: '600' }}><XCircle size={20} style={{ display: 'inline' }} /> REVOCATO</span> : <span style={{ color: '#059669', fontWeight: '600' }}><CheckCircle size={20} style={{ display: 'inline' }} /> ATTIVO</span>}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>ID: {c.pazienteAnonimoId.slice(0, 8)}...</div>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>Firmato da: {c.nomeFirmatario} {c.cognomeFirmatario} il {formatDate(c.dataFirma)}</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => stampaConsenso(c, selectedPatient)} style={{ background: '#3b82f6' }}><Printer size={16} /> Stampa</button>
            {!c.revocato && <button onClick={() => revocaConsenso(c.patientId)} style={{ background: '#ef4444' }}><Trash2 size={16} /> Revoca</button>}
          </div>
        </div>)}
      </>}

      {loading && <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 size={32} className="spin" /><p>Caricamento...</p></div>}

      {showForm && selectedPatient && <form onSubmit={handleSubmit} style={{ background: 'var(--gray-50)', padding: '24px', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '20px' }}><Shield size={20} /> Nuovo Consenso</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div><label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Firmato da *</label><select value={formData.firmatoDa} onChange={(e) => setFormData({ ...formData, firmatoDa: e.target.value as any })} style={{ width: '100%', padding: '10px', borderRadius: '6px' }}><option value="paziente">Paziente</option><option value="tutore">Tutore</option><option value="rappresentanteLegale">Rappresentante Legale</option></select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Nome *</label><input type="text" value={formData.nomeFirmatario} onChange={(e) => setFormData({ ...formData, nomeFirmatario: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px' }} required /></div>
            <div><label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Cognome *</label><input type="text" value={formData.cognomeFirmatario} onChange={(e) => setFormData({ ...formData, cognomeFirmatario: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px' }} required /></div>
          </div>
          <div><label style={{ display: 'block', fontWeight: '600', marginBottom: '12px' }}>Finalità</label><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {Object.entries(formData.finalita).map(([k, v]) => <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'white', borderRadius: '8px' }}><input type="checkbox" checked={v} onChange={(e) => setFormData({ ...formData, finalita: { ...formData.finalita, [k]: e.target.checked } })} />{k === 'prestazioneSanitaria' ? 'Prestazione Sanitaria' : k === 'fatturazione' ? 'Fatturazione' : k === 'auditInterno' ? 'Audit Interno' : 'Ricerca Scientifica'}</label>)}
          </div></div>
          <div><label style={{ display: 'block', fontWeight: '600', marginBottom: '12px' }}>Dati sensibili</label><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {Object.entries(formData.datiSensibili).map(([k, v]) => <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'white', borderRadius: '8px' }}><input type="checkbox" checked={v} onChange={(e) => setFormData({ ...formData, datiSensibili: { ...formData.datiSensibili, [k]: e.target.checked } })} />{k === 'datiSanitari' ? 'Dati Sanitari' : k === 'datiEconomici' ? 'Dati Economici' : 'Immagini'}</label>)}
          </div></div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <a href="/informativa-privacy.html" target="_blank" style={{ color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={16} /> Leggi informativa completa</a>
          </div>
          <button type="submit" disabled={saving} style={{ marginTop: '16px', opacity: saving ? 0.7 : 1 }}>{saving ? <><Loader2 size={16} className="spin" /> Salvataggio...</> : <><Save size={16} /> Registra Consenso</>}</button>
        </div>
      </form>}
    </section>
  );
}
