import { useState } from 'react';
import api from '../api/api';
import FirmaCanvas from './FirmaCanvas';

interface Props {
  patient: { _id: string; firstName: string; lastName: string };
  onClose: () => void;
}

const domande = [
  ['cortesiaProfessionalita', 'Cortesia e professionalità del personale'],
  ['puntualitaOrganizzazione', 'Puntualità e organizzazione del servizio'],
  ['chiarezzaInformazioni', 'Chiarezza delle informazioni ricevute'],
  ['qualitaAssistenza', 'Qualità dell’assistenza ricevuta'],
  ['soddisfazioneComplessiva', 'Soddisfazione complessiva'],
] as const;

type Risposte = Record<(typeof domande)[number][0], number>;

export function CustomerSatisfactionModal({ patient, onClose }: Props) {
  const [tipoFirmatario, setTipoFirmatario] = useState<'paziente' | 'caregiver'>('paziente');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [risposte, setRisposte] = useState<Risposte>({ cortesiaProfessionalita: 0, puntualitaOrganizzazione: 0, chiarezzaInformazioni: 0, qualitaAssistenza: 0, soddisfazioneComplessiva: 0 });
  const [suggerimenti, setSuggerimenti] = useState('');
  const [firmaFirmatario, setFirmaFirmatario] = useState('');
  const [firmaCoordinatore, setFirmaCoordinatore] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const salva = async () => {
    if (!nome.trim() || !cognome.trim() || !firmaFirmatario || !firmaCoordinatore || Object.values(risposte).some(v => !v)) {
      setError('Compilare tutte le risposte e raccogliere entrambe le firme.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/customer-satisfaction', { patientId: patient._id, firmatarioTipo: tipoFirmatario, nomeFirmatario: nome, cognomeFirmatario: cognome, risposte, suggerimenti, firmaFirmatario, firmaCoordinatore });
      stampa(res.data.scheda);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel salvataggio del questionario.');
    } finally { setSaving(false); }
  };

  const stampa = (scheda: any) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const data = new Date(scheda.dataCompilazione).toLocaleDateString('it-IT');
    const righe = domande.map(([key, label]) => `<tr><td>${label}</td><td style="text-align:center;font-weight:bold">${scheda.risposte[key]}/5</td></tr>`).join('');
    win.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Customer Satisfaction</title><style>body{font-family:Arial,sans-serif;color:#1f2937;max-width:800px;margin:auto;padding:30px}h1{color:#1e4d8c;text-align:center;font-size:20px}.header{border:1px solid #94a3b8;padding:12px;text-align:center}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{border:1px solid #94a3b8;padding:10px}.firme{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin-top:28px}.firma{border-top:1px solid #64748b;padding-top:8px}.firma img{max-width:100%;height:90px;object-fit:contain}@media print{body{padding:12px}}</style></head><body><div class="header"><strong>ABBRACCIO CURE DOMICILIARI</strong><br>QUESTIONARIO CUSTOMER SATISFACTION</div><h1>Questionario di soddisfazione</h1><p><strong>Paziente:</strong> ${patient.firstName} ${patient.lastName}<br><strong>Firmatario:</strong> ${scheda.nomeFirmatario} ${scheda.cognomeFirmatario} (${scheda.firmatarioTipo})<br><strong>Data:</strong> ${data}</p><table><thead><tr><th>Area valutata</th><th>Valutazione</th></tr></thead><tbody>${righe}</tbody></table><p><strong>Suggerimenti:</strong><br>${(scheda.suggerimenti || 'Nessun suggerimento').replace(/</g, '&lt;')}</p><div class="firme"><div class="firma"><strong>Firma paziente / caregiver</strong><br><img src="${scheda.firmaFirmatario}"></div><div class="firma"><strong>Firma coordinatore</strong><br><img src="${scheda.firmaCoordinatore}"></div></div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  return <div style={{ position: 'fixed', inset: 0, zIndex: 1100, padding: '12px', overflowY: 'auto', background: 'rgba(0,0,0,.55)' }} onClick={onClose}>
    <div style={{ maxWidth: '680px', margin: '20px auto', padding: '20px', borderRadius: '14px', background: 'white' }} onClick={e => e.stopPropagation()}>
      <h2 style={{ color: '#1e4d8c', margin: '0 0 6px' }}>Customer Satisfaction</h2>
      <p style={{ marginTop: 0, color: '#475569' }}>Paziente: <strong>{patient.firstName} {patient.lastName}</strong></p>
      {error && <p style={{ color: '#b91c1c', background: '#fef2f2', padding: '9px', borderRadius: '6px' }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome firmatario" style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '7px' }} /><input value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Cognome firmatario" style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '7px' }} /></div>
      <select value={tipoFirmatario} onChange={e => setTipoFirmatario(e.target.value as 'paziente' | 'caregiver')} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '7px', marginBottom: '14px' }}><option value="paziente">Paziente</option><option value="caregiver">Caregiver</option></select>
      {domande.map(([key, label]) => <div key={key} style={{ borderTop: '1px solid #e2e8f0', padding: '12px 0' }}><strong style={{ fontSize: '.9rem' }}>{label}</strong><div style={{ display: 'flex', gap: '7px', marginTop: '8px' }}>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} onClick={() => setRisposte(prev => ({ ...prev, [key]: n }))} style={{ width: '38px', height: '34px', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${risposte[key] === n ? '#1d4ed8' : '#cbd5e1'}`, color: risposte[key] === n ? 'white' : '#334155', background: risposte[key] === n ? '#2563eb' : 'white' }}>{n}</button>)}</div></div>)}
      <textarea value={suggerimenti} onChange={e => setSuggerimenti(e.target.value)} placeholder="Suggerimenti o osservazioni (facoltativi)" rows={3} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '7px', margin: '10px 0 16px' }} />
      <FirmaCanvas label="Firma paziente / caregiver" onFirmaCompleta={setFirmaFirmatario} onCancella={() => setFirmaFirmatario('')} altezza={130} />
      <FirmaCanvas label="Firma del coordinatore" onFirmaCompleta={setFirmaCoordinatore} onCancella={() => setFirmaCoordinatore('')} altezza={130} />
      <div style={{ display: 'flex', gap: '10px' }}><button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', border: '1px solid #cbd5e1', borderRadius: '7px', cursor: 'pointer' }}>Annulla</button><button type="button" onClick={salva} disabled={saving} style={{ flex: 2, padding: '11px', border: 0, borderRadius: '7px', cursor: 'pointer', color: 'white', background: '#1e4d8c', fontWeight: 700 }}>{saving ? 'Archiviazione...' : 'Archivia, genera PDF'}</button></div>
    </div>
  </div>;
}
