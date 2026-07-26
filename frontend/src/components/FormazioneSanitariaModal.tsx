import { useState } from 'react';
import api from '../api/api';
import FirmaCanvas from './FirmaCanvas';
import { RelazioneVocaleALL } from './RelazioneVocaleALL';

interface Props { patient: { _id: string; firstName: string; lastName: string }; workPlan?: { _id: string; type?: string; category?: string } | null; onClose: () => void; }
const argomenti = ['Nutrizione e idratazione', 'Eliminazione', 'Medicazione', 'Igiene / lavaggio personale', 'Mobilizzazione e prevenzione cadute', 'Terapia farmacologica', 'Gestione presidi sanitari', 'Prevenzione lesioni da pressione', 'Altro'];

export function FormazioneSanitariaModal({ patient, workPlan, onClose }: Props) {
  const [tipoScheda, setTipoScheda] = useState<'formazione_educazione' | 'valutazione_formazione'>('formazione_educazione');
  const [personaFormata, setPersonaFormata] = useState('');
  const [ruolo, setRuolo] = useState<'paziente' | 'caregiver' | 'familiare' | 'altro'>('paziente');
  const [argomento, setArgomento] = useState('');
  const [relazione, setRelazione] = useState('');
  const [dataIntervento, setDataIntervento] = useState(new Date().toISOString().slice(0, 10));
  const [firma, setFirma] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const salva = async () => {
    if (!personaFormata.trim() || !argomento || !relazione.trim() || !firma) { setError('Compilare persona formata, argomento, relazione e firma.'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.post('/formazione-sanitaria', { patientId: patient._id, workPlanId: workPlan?._id, tipoScheda, personaFormata, ruoloPersonaFormata: ruolo, argomento, relazione, dataIntervento, firmaOperatore: firma });
      stampa(res.data.scheda);
      onClose();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore salvataggio scheda.'); }
    finally { setSaving(false); }
  };

  const stampa = (scheda: any) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Formazione sanitaria</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:auto;padding:30px;color:#1f2937}.header{display:flex;gap:16px;align-items:center;border-bottom:2px solid #0e7490;padding-bottom:12px}.header img{max-width:130px;max-height:55px}h1{font-size:20px;color:#0e7490}h2{font-size:15px;color:#0e7490}.box{border:1px solid #94a3b8;border-radius:7px;padding:12px;white-space:pre-wrap}.firma{margin-top:28px;border-top:1px solid #475569;width:45%;padding-top:7px}.firma img{max-width:100%;height:90px;object-fit:contain}@media print{body{padding:12px}}</style></head><body><div class="header"><img src="${window.location.origin}/logo.png"><strong>ABBRACCIO CURE DOMICILIARI</strong></div><h1>${scheda.tipoScheda === 'formazione_educazione' ? 'SCHEDA FORMAZIONE ED EDUCAZIONE SANITARIA' : 'SCHEDA VALUTAZIONE FORMAZIONE SANITARIA'}</h1><p><strong>Paziente:</strong> ${patient.firstName} ${patient.lastName}<br><strong>Data:</strong> ${new Date(scheda.dataIntervento).toLocaleDateString('it-IT')}<br><strong>Persona formata/valutata:</strong> ${scheda.personaFormata} (${scheda.ruoloPersonaFormata})<br><strong>Argomento:</strong> ${scheda.argomento}</p><h2>Relazione</h2><div class="box">${scheda.relazione.replace(/</g, '&lt;')}</div><div class="firma"><strong>Firma operatore</strong><br><img src="${scheda.firmaOperatore}"><br>${scheda.operatoreNome}</div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  return <div style={{ position: 'fixed', inset: 0, zIndex: 1100, padding: '12px', overflowY: 'auto', background: 'rgba(0,0,0,.55)' }} onClick={onClose}>
    <div style={{ maxWidth: '700px', margin: '18px auto', padding: '20px', borderRadius: '14px', background: 'white' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '2px solid #0e7490', paddingBottom: '10px' }}><img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ maxWidth: '125px', maxHeight: '48px' }} /><h2 style={{ margin: 0, color: '#0e7490' }}>Formazione ed educazione sanitaria</h2></div><p><strong>Paziente:</strong> {patient.firstName} {patient.lastName}</p>{error && <p style={{ color: '#b91c1c', background: '#fef2f2', padding: '9px', borderRadius: '6px' }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}><label>Tipo scheda<select value={tipoScheda} onChange={e => setTipoScheda(e.target.value as typeof tipoScheda)} style={{ display: 'block', width: '100%', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }}><option value="formazione_educazione">Formazione / educazione sanitaria</option><option value="valutazione_formazione">Valutazione della formazione</option></select></label><label>Data<input type="date" value={dataIntervento} onChange={e => setDataIntervento(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></label></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}><label>Chi è stato formato / valutato<input value={personaFormata} onChange={e => setPersonaFormata(e.target.value)} placeholder="Nome e cognome" style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></label><label>Ruolo<select value={ruolo} onChange={e => setRuolo(e.target.value as typeof ruolo)} style={{ display: 'block', width: '100%', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }}><option value="paziente">Paziente</option><option value="caregiver">Caregiver</option><option value="familiare">Familiare</option><option value="altro">Altro</option></select></label></div>
      <label style={{ display: 'block', marginTop: '12px', fontWeight: 600 }}>Tipologia di formazione / educazione<select value={argomento} onChange={e => setArgomento(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }}><option value="">Seleziona argomento</option>{argomenti.map(x => <option key={x}>{x}</option>)}</select></label>
      <div style={{ marginTop: '14px' }}><strong>Relazione</strong><div><RelazioneVocaleALL contesto={`${tipoScheda === 'formazione_educazione' ? 'Formazione ed educazione sanitaria' : 'Valutazione della formazione sanitaria'}. Persona: ${personaFormata}. Ruolo: ${ruolo}. Argomento: ${argomento}.`} onRelazione={setRelazione} onError={setError} /></div><textarea value={relazione} onChange={e => setRelazione(e.target.value)} rows={9} placeholder="Descrivere contenuti trattati, comprensione, dimostrazione e eventuali criticità." style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #64748b', borderRadius: '6px' }} /></div>
      <FirmaCanvas label="Firma finale dell’operatore" sublabel="Firma con dito o penna per archiviare la scheda" onFirmaCompleta={setFirma} onCancella={() => setFirma('')} altezza={135} />
      <div style={{ display: 'flex', gap: '10px' }}><button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '7px' }}>Annulla</button><button type="button" onClick={salva} disabled={saving} style={{ flex: 2, padding: '11px', cursor: 'pointer', border: 0, borderRadius: '7px', background: '#0e7490', color: 'white', fontWeight: 700 }}>{saving ? 'Archiviazione...' : 'Archivia e genera PDF'}</button></div>
    </div>
  </div>;
}
