import { useState } from 'react';
import api from '../api/api';
import FirmaCanvas from './FirmaCanvas';
import { RelazioneVocaleALL } from './RelazioneVocaleALL';

interface Props {
  patient: { _id: string; firstName: string; lastName: string };
  dataInizioServizio?: string;
  onClose: () => void;
}

const motivi = [
  ['conclusione_programma', 'Conclusione del programma (Obiettivi raggiunti)'],
  ['ricovero_struttura', 'Ricovero in struttura (RSA/Hospice/Ospedale/PS)'],
  ['trasferimento_asl_residenza', 'Trasferimento in altra ASL / Cambio Residenza'],
  ['decesso', 'Decesso'],
  ['dimissione_volontaria_rifiuto', 'Dimissione volontaria / Rifiuto'],
  ['altro', 'Altro'],
];

export function SchedaDimissioneModal({ patient, dataInizioServizio, onClose }: Props) {
  const [dataDimissione, setDataDimissione] = useState(new Date().toISOString().slice(0, 10));
  const [motivazioni, setMotivazioni] = useState<string[]>([]);
  const [altroMotivo, setAltroMotivo] = useState('');
  const [relazione, setRelazione] = useState('');
  const [firmaCoordinatore, setFirmaCoordinatore] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const salva = async () => {
    if (!motivazioni.length || !relazione.trim() || !firmaCoordinatore) { setError('Selezionare almeno una motivazione, completare la relazione e firmare.'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.post('/schede-dimissione', { patientId: patient._id, dataInizioServizio, dataDimissione, motivazioni, altroMotivo, relazioneChiusura: relazione, firmaCoordinatore });
      stampa(res.data.scheda);
      onClose();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore nel salvataggio della scheda.'); }
    finally { setSaving(false); }
  };

  const stampa = (scheda: any) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const data = (d?: string) => d ? new Date(d).toLocaleDateString('it-IT') : '';
    const selezionati = motivi.map(([id, label]) => `<p>☐ ${label}${scheda.motivazioni.includes(id) ? ' <strong>☒</strong>' : ''}${id === 'altro' && scheda.motivazioni.includes(id) ? `: ${scheda.altroMotivo || ''}` : ''}</p>`).join('');
    win.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Scheda dimissione</title><style>body{max-width:760px;margin:auto;padding:28px;font-family:Arial,sans-serif;color:#111}.intestazione{display:grid;grid-template-columns:1fr 1fr;border:1px solid #666}.intestazione>*{padding:8px;border-right:1px solid #666}.intestazione>*:last-child{border:0}.logo{display:flex;align-items:center;gap:8px;color:#6b7280;font-weight:bold;font-size:14px}.logo img{max-height:44px;max-width:130px}.titolo{font-family:Georgia,serif;font-size:19px;color:#777}.riga{border:1px solid #111;padding:5px;margin:0}.blu{color:#3b6ea5;font-size:16px;margin:20px 0 5px}.relazione{min-height:170px;border:1px solid #111;padding:10px;white-space:pre-wrap}.firma{margin-top:28px;border-top:1px solid #333;width:45%;padding-top:8px}.firma img{height:80px;max-width:100%;object-fit:contain}@media print{body{padding:12px}}</style></head><body><div class="intestazione"><div><div class="logo"><img src="${window.location.origin}/logo.png">ABBRACCIO<br>CURE DOMICILIARI</div><small>Rev. 1/2026</small></div><div class="titolo"><small>Firma DS: __________</small></div></div><h3 class="blu">SCHEDA DI DIMISSIONE DELL'UTENTE</h3><div class="riga"><strong>Nome e Cognome:</strong> ${patient.firstName} ${patient.lastName}</div><div class="riga"><strong>Data Inizio Servizio:</strong> ${data(scheda.dataInizioServizio)} &nbsp;&nbsp;&nbsp; <strong>DATA DIMISSIONE:</strong> ${data(scheda.dataDimissione)}</div><h3 class="blu">◢ MOTIVAZIONE DELLA DIMISSIONE</h3>${selezionati}<h3 class="blu">RELAZIONE SINTETICA DI CHIUSURA</h3><p><em>(Risultati raggiunti, stato clinico alla dimissione, eventuali indicazioni post-dimissione)</em></p><div class="relazione">${scheda.relazioneChiusura.replace(/</g, '&lt;')}</div><div class="firma"><strong>Firma coordinatore</strong><br><img src="${scheda.firmaCoordinatore}"><br>${scheda.coordinatoreNome}</div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  const toggle = (id: string) => setMotivazioni(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  return <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.55)', padding: '12px', overflowY: 'auto' }} onClick={onClose}>
    <div style={{ maxWidth: '740px', margin: '18px auto', background: 'white', borderRadius: '14px', padding: '20px' }} onClick={e => e.stopPropagation()}>
      <div style={{ border: '1px solid #94a3b8', display: 'grid', gridTemplateColumns: '1fr 1.2fr', marginBottom: '18px' }}><div style={{ padding: '10px' }}><img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ maxWidth: '140px', maxHeight: '55px' }} /><div style={{ fontSize: '.8rem' }}>Rev. 1/2026</div></div><div style={{ padding: '10px', borderLeft: '1px solid #94a3b8', fontFamily: 'Georgia,serif', color: '#666', fontSize: '18px' }}></div></div>
      <h2 style={{ color: '#3b6ea5', fontSize: '17px', margin: '0 0 12px' }}>SCHEDA DI DIMISSIONE DELL'UTENTE</h2><p><strong>Nome e Cognome:</strong> {patient.firstName} {patient.lastName}</p>
      {error && <p style={{ color: '#b91c1c', background: '#fef2f2', padding: '9px', borderRadius: '6px' }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}><label>Data inizio servizio<input type="date" value={dataInizioServizio?.slice(0, 10) || ''} readOnly style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></label><label>Data dimissione<input type="date" value={dataDimissione} onChange={e => setDataDimissione(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></label></div>
      <h3 style={{ color: '#3b6ea5', fontSize: '15px' }}>◢ MOTIVAZIONE DELLA DIMISSIONE</h3>{motivi.map(([id, label]) => <label key={id} style={{ display: 'block', padding: '7px 0' }}><input type="checkbox" checked={motivazioni.includes(id)} onChange={() => toggle(id)} /> {label}</label>)}{motivazioni.includes('altro') && <input value={altroMotivo} onChange={e => setAltroMotivo(e.target.value)} placeholder="Specificare altra motivazione" style={{ width: '100%', boxSizing: 'border-box', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />}
      <h3 style={{ color: '#3b6ea5', fontSize: '15px', marginBottom: '4px' }}>RELAZIONE SINTETICA DI CHIUSURA</h3><p style={{ marginTop: 0, fontSize: '.84rem' }}>(Risultati raggiunti, stato clinico alla dimissione, eventuali indicazioni post-dimissione)</p><RelazioneVocaleALL contesto={`Relazione sintetica di chiusura per dimissione. Motivazioni selezionate: ${motivazioni.join(', ')}. Altra motivazione: ${altroMotivo}.`} onRelazione={setRelazione} onError={setError} /><textarea value={relazione} onChange={e => setRelazione(e.target.value)} rows={9} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #64748b', borderRadius: '6px' }} />
      <FirmaCanvas label="Firma del coordinatore" sublabel="Firma obbligatoria per archiviare la dimissione" onFirmaCompleta={setFirmaCoordinatore} onCancella={() => setFirmaCoordinatore('')} altezza={135} />
      <div style={{ display: 'flex', gap: '10px' }}><button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '7px' }}>Annulla</button><button type="button" onClick={salva} disabled={saving} style={{ flex: 2, padding: '11px', cursor: 'pointer', border: 0, borderRadius: '7px', background: '#3b6ea5', color: 'white', fontWeight: 700 }}>{saving ? 'Archiviazione...' : 'Archivia e genera PDF'}</button></div>
    </div>
  </div>;
}
