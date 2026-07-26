import { ChangeEvent, useState } from 'react';
import api from '../api/api';
import FirmaCanvas from './FirmaCanvas';
import { RelazioneVocaleALL } from './RelazioneVocaleALL';

interface Props {
  patient: { _id: string; firstName: string; lastName: string };
  workPlan?: { _id: string; category?: string; type?: string; task?: string } | null;
  onClose: () => void;
}

interface Allegato { nome: string; tipo: string; dati: string; }
const tipiPrestazione = ['Tutte le prestazioni', 'Infermieristica', 'Assistenziale / OSS', 'Riabilitativa', 'Medico-specialistica', 'Prelievi', 'Esami strumentali'];

export function RiformulazionePAIModal({ patient, workPlan, onClose }: Props) {
  const [tipo, setTipo] = useState<'riformulazione' | 'rinnovo'>('riformulazione');
  const [prestazione, setPrestazione] = useState(workPlan?.category || workPlan?.type || 'Tutte le prestazioni');
  const [motivazioni, setMotivazioni] = useState('');
  const [relazione, setRelazione] = useState('');
  const [allegati, setAllegati] = useState<Allegato[]>([]);
  const [firma, setFirma] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const aggiungiFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      if (file.size > 4 * 1024 * 1024) { setError(`${file.name} supera il limite di 4 MB.`); continue; }
      if (allegati.reduce((totale, allegato) => totale + allegato.dati.length, 0) + Math.ceil(file.size * 1.34) > 8_500_000) { setError('La dimensione complessiva degli allegati non può superare 6 MB.'); continue; }
      const dati = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      setAllegati(prev => prev.length < 5 ? [...prev, { nome: file.name, tipo: file.type || 'application/octet-stream', dati }] : prev);
    }
    event.target.value = '';
  };

  const salva = async () => {
    if (!motivazioni.trim() || !relazione.trim() || !firma) { setError('Compilare motivazioni, relazione e firma del coordinatore.'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.post('/riformulazioni-pai', { patientId: patient._id, workPlanId: workPlan?._id, tipo, tipologiaPrestazione: prestazione, motivazioni, relazioneVerbale: relazione, allegati, firmaCoordinatore: firma });
      stampa(res.data.scheda);
      onClose();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore salvataggio scheda PAI.'); }
    finally { setSaving(false); }
  };

  const stampa = (scheda: any) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const immagini = scheda.allegati.filter((a: Allegato) => a.tipo.startsWith('image/')).map((a: Allegato) => `<div><p>${a.nome}</p><img src="${a.dati}" style="max-width:100%;max-height:450px"></div>`).join('');
    const documenti = scheda.allegati.filter((a: Allegato) => !a.tipo.startsWith('image/')).map((a: Allegato) => `<li>${a.nome}</li>`).join('');
    win.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${scheda.tipo} PAI</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:auto;padding:30px;color:#1f2937}.header{display:flex;align-items:center;gap:20px;border-bottom:2px solid #1e4d8c;padding-bottom:12px}.header img{max-width:140px;max-height:55px}h1{font-size:20px;color:#1e4d8c}h2{font-size:15px;color:#1e4d8c}.box{border:1px solid #94a3b8;border-radius:7px;padding:12px;white-space:pre-wrap}.firma{margin-top:30px;border-top:1px solid #475569;padding-top:7px;width:45%}.firma img{max-width:100%;height:90px;object-fit:contain}@media print{body{padding:12px}}</style></head><body><div class="header"><img src="${window.location.origin}/logo.png"><strong>ABBRACCIO CURE DOMICILIARI</strong></div><h1>${scheda.tipo === 'rinnovo' ? 'SCHEDA RINNOVO PAI' : 'SCHEDA RIFORMULAZIONE PAI'}</h1><p><strong>Paziente:</strong> ${patient.firstName} ${patient.lastName}<br><strong>Data:</strong> ${new Date(scheda.dataScheda).toLocaleDateString('it-IT')}<br><strong>Tipologia prestazione:</strong> ${scheda.tipologiaPrestazione}</p><h2>Motivazioni</h2><div class="box">${scheda.motivazioni.replace(/</g, '&lt;')}</div><h2>Relazione verbale per ASL / Medico di Medicina Generale</h2><div class="box">${scheda.relazioneVerbale.replace(/</g, '&lt;')}</div>${scheda.allegati.length ? `<h2>Allegati</h2><ul>${documenti}</ul>${immagini}` : ''}<div class="firma"><strong>Firma coordinatore</strong><br><img src="${scheda.firmaCoordinatore}"><br>${scheda.coordinatoreNome}</div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  return <div style={{ position: 'fixed', inset: 0, zIndex: 1100, padding: '12px', overflowY: 'auto', background: 'rgba(0,0,0,.55)' }} onClick={onClose}>
    <div style={{ maxWidth: '740px', margin: '18px auto', background: 'white', borderRadius: '14px', padding: '20px' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '2px solid #1e4d8c', paddingBottom: '10px' }}><img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ maxWidth: '130px', maxHeight: '48px' }} /><h2 style={{ color: '#1e4d8c', margin: 0 }}>Riformulazione / Rinnovo PAI</h2></div>
      <p><strong>Paziente:</strong> {patient.firstName} {patient.lastName}</p>{error && <p style={{ color: '#b91c1c', background: '#fef2f2', padding: '9px', borderRadius: '6px' }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}><label>Tipo scheda<select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)} style={{ display: 'block', width: '100%', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }}><option value="riformulazione">Riformulazione PAI</option><option value="rinnovo">Rinnovo PAI</option></select></label><label>Filtro prestazione<select value={prestazione} onChange={e => setPrestazione(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>{tipiPrestazione.map(x => <option key={x}>{x}</option>)}</select></label></div>
      <label style={{ display: 'block', marginTop: '14px', fontWeight: 600 }}>Motivazioni<textarea value={motivazioni} onChange={e => setMotivazioni(e.target.value)} rows={4} placeholder="Indicare variazione clinica, obiettivi, bisogni, frequenza o tipologia della prestazione" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></label>
      <div style={{ marginTop: '14px' }}><strong>Relazione verbale per ASL / Medico di Medicina Generale</strong><div><RelazioneVocaleALL contesto={`Riformulazione o rinnovo PAI. Prestazione: ${prestazione}. Motivazioni: ${motivazioni}.`} onRelazione={setRelazione} onError={setError} /></div><textarea value={relazione} onChange={e => setRelazione(e.target.value)} rows={9} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #64748b', borderRadius: '6px' }} /></div>
      <div style={{ marginTop: '16px', padding: '12px', border: '1px dashed #94a3b8', borderRadius: '7px' }}><strong>Foto e documentazione</strong><p style={{ fontSize: '.82rem', margin: '5px 0' }}>Puoi scattare foto con la fotocamera o allegare fino a cinque file da 4 MB ciascuno.</p><input type="file" accept="image/*" capture="environment" multiple onChange={aggiungiFile} /><input type="file" accept="image/*,application/pdf,.doc,.docx" multiple onChange={aggiungiFile} style={{ marginLeft: '8px' }} />{allegati.length > 0 && <ul>{allegati.map((a, i) => <li key={`${a.nome}-${i}`}>{a.nome} <button type="button" onClick={() => setAllegati(prev => prev.filter((_, n) => n !== i))} style={{ color: '#b91c1c', border: 0, background: 'none', cursor: 'pointer' }}>✕</button></li>)}</ul>}</div>
      <FirmaCanvas label="Firma del coordinatore" sublabel="Firma obbligatoria per archiviare la scheda" onFirmaCompleta={setFirma} onCancella={() => setFirma('')} altezza={135} />
      <div style={{ display: 'flex', gap: '10px' }}><button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '7px' }}>Annulla</button><button type="button" onClick={salva} disabled={saving} style={{ flex: 2, padding: '11px', cursor: 'pointer', border: 0, borderRadius: '7px', color: 'white', background: '#1e4d8c', fontWeight: 700 }}>{saving ? 'Archiviazione...' : 'Archivia e genera PDF'}</button></div>
    </div>
  </div>;
}
