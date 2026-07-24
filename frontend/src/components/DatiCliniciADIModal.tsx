import { useEffect, useState } from 'react';
import api from '../api/api';

interface PatientRef { _id: string; firstName: string; lastName: string; }
interface ClinicalForm { codiceFiscale: string; diagnosiAmmissione: string; comorbilita: string; allergie: string; caregiverRiferimento: string; caregiverTelefono: string; }

const emptyForm: ClinicalForm = { codiceFiscale: '', diagnosiAmmissione: '', comorbilita: '', allergie: '', caregiverRiferimento: '', caregiverTelefono: '' };

export function DatiCliniciADIModal({ patient, onClose, onSaved }: { patient: PatientRef; onClose: () => void; onSaved?: (patient: any) => void }) {
  const [form, setForm] = useState<ClinicalForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/patients/${patient._id}`).then(res => {
      const p = res.data;
      setForm({ codiceFiscale: p.codiceFiscale || '', diagnosiAmmissione: p.diagnosiAmmissione || '', comorbilita: p.comorbilita || '', allergie: p.allergie || '', caregiverRiferimento: p.caregiverRiferimento || '', caregiverTelefono: p.caregiverTelefono || '' });
    }).catch(err => setError(err.response?.data?.message || 'Errore nel caricamento dei dati clinici.')).finally(() => setLoading(false));
  }, [patient._id]);

  const salva = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.patch(`/patients/${patient._id}/dati-clinici`, form);
      onSaved?.(res.data);
      onClose();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore nel salvataggio dei dati clinici.'); }
    finally { setSaving(false); }
  };

  const input = (key: keyof ClinicalForm, label: string, opts: { area?: boolean; warning?: boolean; placeholder?: string } = {}) => <div><label style={{ fontWeight: 600, fontSize: '.85rem', color: opts.warning ? '#dc2626' : '#374151', display: 'block', marginBottom: '4px' }}>{opts.warning ? '⚠️ ' : ''}{label}</label>{opts.area ? <textarea value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={opts.placeholder} rows={key === 'allergie' ? 2 : 3} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${opts.warning ? '#fca5a5' : '#d1d5db'}`, background: opts.warning ? '#fff7f7' : 'white', resize: 'vertical' }} /> : <input type={key === 'caregiverTelefono' ? 'tel' : 'text'} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: key === 'codiceFiscale' ? e.target.value.toUpperCase() : e.target.value }))} placeholder={opts.placeholder} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontFamily: key === 'codiceFiscale' ? 'monospace' : 'inherit' }} />}</div>;

  return <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: 'rgba(0,0,0,.55)' }} onClick={onClose}>
    <div style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '600px', maxHeight: '92vh', overflowY: 'auto', padding: '20px' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}><div><h2 style={{ margin: 0, color: '#0369a1', fontSize: '20px' }}>🩺 Dati Clinici ADI</h2><p style={{ margin: '4px 0 0', color: '#64748b' }}>{patient.firstName} {patient.lastName}</p></div><button type="button" onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: '22px' }}>✕</button></div>
      {error && <p style={{ color: '#b91c1c', background: '#fef2f2', padding: '9px', borderRadius: '6px' }}>{error}</p>}
      {loading ? <p style={{ textAlign: 'center', color: '#64748b' }}>Caricamento dati clinici...</p> : <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {input('codiceFiscale', 'Codice Fiscale', { placeholder: 'es. RSSMRA80A01H501Z' })}
        {input('diagnosiAmmissione', 'Diagnosi di ammissione / Patologia principale', { area: true, placeholder: 'es. Scompenso cardiaco cronico, BPCO, ...' })}
        {input('comorbilita', 'Comorbilità / Patologie associate', { area: true, placeholder: 'es. Diabete mellito tipo 2, Ipertensione arteriosa, ...' })}
        {input('allergie', 'Allergie / Intolleranze farmacologiche', { area: true, warning: true, placeholder: 'es. Penicillina, FANS, lattice, ... (NESSUNA se assenti)' })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>{input('caregiverRiferimento', 'Caregiver / Familiare di riferimento', { placeholder: 'Nome e cognome' })}{input('caregiverTelefono', 'Telefono caregiver', { placeholder: 'es. 3331234567' })}</div>
        <p style={{ margin: 0, fontSize: '.8rem', color: '#64748b' }}>I dati salvati sono parte della cartella clinica e vengono inclusi nelle esportazioni.</p>
        <div style={{ display: 'flex', gap: '10px' }}><button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer' }}>Annulla</button><button type="button" onClick={salva} disabled={saving} style={{ flex: 2, padding: '12px', border: 0, borderRadius: '8px', background: '#0369a1', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Salvataggio...' : '✓ Salva dati clinici ADI'}</button></div>
      </div>}
    </div>
  </div>;
}
