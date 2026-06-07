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
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>Consenso - ${p.firstName} ${p.lastName}</title><style>body{font-family:Arial;padding:40px;line-height:1.6}h1{color:#1e4d8c;border-bottom:2px solid #1e4d8c}.box{border:1px solid #ccc;padding:15px;margin:15px 0;border-radius:5px}.signature{border:2px dashed #999;padding:60px 20px 20px;text-align:center;margin-top:40px}</style></head><body><h1>CONSENSO INFORMATO AL TRATTAMENTO DATI</h1><p><strong>Paziente:</strong> ${p.firstName} ${p.lastName}</p><p><strong>Data firma:</strong> ${formatDate(c.dataFirma)}</p><div class="box"><strong>Finalità:</strong> ${Object.entries(c.finalita).filter(([,v])=>v).map(([k])=>k).join(', ')}</div><div class="box"><strong>Dati sensibili:</strong> ${Object.entries(c.datiSensibili).filter(([,v])=>v).map(([k])=>k).join(', ')}</div><div class="signature"><p>Firma di ${c.firmatoDa}: ${c.nomeFirmatario} ${c.cognomeFirmatario}</p></div></body></html>`);
      win.document.close(); win.focus();
    }
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
