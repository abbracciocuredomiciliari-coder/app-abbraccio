import { useEffect, useState } from 'react';
import api from '../api/api';
import { Button } from './ui/Button';
import { UserCheck, XCircle, Paperclip, Smartphone, UserPlus, CheckCircle, AlertTriangle, Send, MessageCircle, Mail } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// CANDIDATURE INTERMEDIAZIONE — sezione in Gestione Utenti con le iscrizioni
// rapide da /iscriviti-intermediazione (badanti, colf, assistenti familiari).
// Accetta → crea lo Staff di sola Intermediazione (niente account/contratto).
// ═════════════════════════════════════════════════════════════════════════════

interface Candidato {
  _id: string;
  nome: string;
  cognome: string;
  ruolo: 'badante' | 'colf' | 'assistente_familiare' | 'oss' | 'infermiere' | 'medico' | 'fisioterapista';
  albo?: string;
  nazionalita?: string;
  dataNascita?: string;
  extraUe?: boolean;
  permessoSoggiorno?: string;
  codiceFiscale?: string;
  telefono?: string;
  email?: string;
  regioneResidenza?: string;
  cittaResidenza?: string;
  regioneInteresse?: string;
  cittaInteresse?: string;
  disponibilita?: 'diurno' | 'notturno' | 'h24';
  residenzaPressoFamiglia?: boolean;
  certificato?: boolean;
  esperienze?: string;
  note?: string;
  documentoNome?: string;
  stato: 'in_attesa' | 'accettato' | 'rifiutato';
  richiesteDati?: { at: string; campi: string[]; canale: 'email' | 'whatsapp' }[];
  createdAt: string;
}

const RUOLO_LABEL: Record<string, string> = { badante: '🧓 Badante', colf: '🧹 Colf', assistente_familiare: '👨‍👩‍👧 Assistente familiare', oss: '🩺 OSS', infermiere: '💉 Infermiere', medico: '👨‍⚕️ Medico', fisioterapista: '🦴 Fisioterapista' };
const PERMESSO_LABEL: Record<string, string> = { valido: '✅ Permesso valido', in_scadenza: '⏳ In scadenza/rinnovo', documenti_validi: '📄 Documenti validi', assente: '⚠️ Nessun documento valido' };
const DISP_LABEL: Record<string, string> = { diurno: '☀️ Diurno', notturno: '🌙 Solo notturno', h24: '🕐 h24' };

const fmtData = (d?: string) => d ? new Date(d).toLocaleDateString('it-IT') : '';
const fmtOra = (d?: string) => d ? new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// Dati fondamentali: se mancano, prima di accettare si può chiedere l'integrazione
const DATI_FONDAMENTALI: { label: string; manca: (c: Candidato) => boolean }[] = [
  { label: 'Telefono', manca: c => !c.telefono },
  { label: 'Email', manca: c => !c.email },
  { label: 'Data di nascita', manca: c => !c.dataNascita },
  { label: 'Codice fiscale', manca: c => !c.codiceFiscale },
  { label: 'Zona di lavoro (città/regione)', manca: c => !(c.cittaInteresse || c.regioneInteresse || c.cittaResidenza) },
  { label: 'Disponibilità oraria', manca: c => !c.disponibilita },
  { label: 'Documento allegato (identità/CV)', manca: c => !c.documentoNome },
  { label: 'Permesso di soggiorno', manca: c => !!c.extraUe && !c.permessoSoggiorno },
];
const datiMancanti = (c: Candidato) => DATI_FONDAMENTALI.filter(d => d.manca(c)).map(d => d.label);
// Numero WhatsApp: toglie spazi/simboli e aggiunge il prefisso Italia se manca
const waNumber = (t?: string) => {
  const d = (t || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('39')) return d;
  return d.startsWith('3') && d.length >= 9 ? '39' + d : d;
};

export default function CandidatureIntermediazione({ onToast }: { onToast: (msg: string, tipo: 'ok' | 'err') => void }) {
  const [candidati, setCandidati] = useState<Candidato[]>([]);
  const [filtro, setFiltro] = useState<'in_attesa' | 'accettato' | 'rifiutato' | 'tutti'>('in_attesa');
  const [apertoId, setApertoId] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [richiediId, setRichiediId] = useState<string | null>(null);
  const [selCampi, setSelCampi] = useState<string[]>([]);

  const carica = async () => {
    try {
      const res = await api.get('/candidati-intermediazione', { params: { stato: 'tutti' } });
      setCandidati(res.data || []);
    } catch { /* noop */ }
  };

  useEffect(() => { carica(); const id = setInterval(carica, 30000); return () => clearInterval(id); }, []);

  const accetta = async (c: Candidato) => {
    setBusy(c._id);
    try {
      const res = await api.patch(`/candidati-intermediazione/${c._id}/accetta`);
      onToast(`✅ ${res.data?.message || 'Candidato accettato'}`, 'ok');
      await carica();
    } catch (err: any) {
      onToast(err?.response?.data?.message || 'Errore accettazione', 'err');
    } finally { setBusy(''); }
  };

  const rifiuta = async (c: Candidato) => {
    if (!window.confirm(`Rifiutare la candidatura di ${c.nome} ${c.cognome}?`)) return;
    setBusy(c._id);
    try {
      await api.patch(`/candidati-intermediazione/${c._id}/rifiuta`);
      onToast('Candidatura rifiutata.', 'ok');
      await carica();
    } catch (err: any) {
      onToast(err?.response?.data?.message || 'Errore rifiuto', 'err');
    } finally { setBusy(''); }
  };

  // ── Richiesta dati mancanti (email dal server / WhatsApp via wa.me) ──
  const apriRichiesta = (c: Candidato) => {
    setRichiediId(richiediId === c._id ? null : c._id);
    setSelCampi(datiMancanti(c));
  };
  const toggleCampo = (m: string) =>
    setSelCampi(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const inviaRichiesta = async (c: Candidato, canale: 'email' | 'whatsapp') => {
    if (!selCampi.length) return;
    setBusy(c._id);
    try {
      if (canale === 'whatsapp') {
        const num = waNumber(c.telefono);
        if (!num) { onToast('Il candidato non ha lasciato un telefono', 'err'); setBusy(''); return; }
        const ruolo = (RUOLO_LABEL[c.ruolo] || c.ruolo).replace(/^\S+\s+/, '');
        const msg = `Ciao ${c.nome}, sono Abbraccio Cure Domiciliari. Per completare la tua iscrizione come ${ruolo} ci mancano ancora: ${selCampi.join(', ')}. Rispondi a questo messaggio con i dati (per il documento va bene anche una foto). Grazie!`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      const res = await api.post(`/candidati-intermediazione/${c._id}/richiedi-dati`, { campi: selCampi, canale });
      onToast(`✅ ${res.data?.message || 'Richiesta inviata'}`, 'ok');
      setRichiediId(null);
      await carica();
    } catch (err: any) {
      onToast(err?.response?.data?.message || 'Errore invio richiesta', 'err');
    } finally { setBusy(''); }
  };

  const apriDocumento = async (c: Candidato) => {
    try {
      const res = await api.get(`/candidati-intermediazione/${c._id}/documento`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank');
    } catch {
      onToast('Documento non disponibile', 'err');
    }
  };

  const filtrati = candidati.filter(c => filtro === 'tutti' ? true : c.stato === filtro);
  const nAttesa = candidati.filter(c => c.stato === 'in_attesa').length;

  const linkIscrizione = `${window.location.origin}/iscriviti-intermediazione`;
  const msgIscrizione = `Iscriviti come operatore Abbraccio (badante, colf, assistente familiare): ${linkIscrizione}`;
  const shareBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#1e4d8c', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', padding: 0 };

  return (
    <div style={{ marginBottom: '28px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '14px', padding: '18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={19} /> Candidature Intermediazioni — badanti, colf, assistenti familiari
            {nAttesa > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: '999px', padding: '2px 9px', fontSize: '0.75rem', fontWeight: 800 }}>{nAttesa} nuove</span>}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#78716c' }}>
            Iscrizioni rapide dal link esterno — accettate finiscono in <strong>Personale Intermediazioni</strong> e nella mappa (solo badanti/colf/assistenti familiari).
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#57534e', background: '#fff', border: '1px dashed #fdba74', borderRadius: '8px', padding: '6px 10px' }}>
          <Smartphone size={14} />
          <code style={{ color: '#1e4d8c', fontWeight: 700 }}>/iscriviti-intermediazione</code>
          <button type="button"
            onClick={() => { navigator.clipboard?.writeText(linkIscrizione); onToast('Link copiato negli appunti.', 'ok'); }}
            style={shareBtn}>
            📋 Copia
          </button>
          <button type="button"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msgIscrizione)}`, '_blank')}
            style={{ ...shareBtn, color: '#15803d' }}>
            💬 WhatsApp
          </button>
          <button type="button"
            onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent('Iscrizione operatore Abbraccio')}&body=${encodeURIComponent(msgIscrizione)}`; }}
            style={shareBtn}>
            ✉️ Email
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {(['in_attesa', 'accettato', 'rifiutato', 'tutti'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFiltro(f)}
            style={{ background: filtro === f ? '#c2410c' : '#fff', color: filtro === f ? '#fff' : '#57534e', border: '1px solid #fdba74', borderRadius: '6px', padding: '5px 12px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: filtro === f ? 700 : 400 }}>
            {f === 'in_attesa' ? `⏳ In attesa (${nAttesa})` : f === 'accettato' ? '✅ Accettati' : f === 'rifiutato' ? '❌ Rifiutati' : '📋 Tutti'}
          </button>
        ))}
      </div>

      {filtrati.length === 0 ? (
        <p style={{ margin: 0, color: '#a8a29e', fontSize: '0.88rem' }}>Nessuna candidatura in questo stato.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrati.map(c => {
            const aperto = apertoId === c._id;
            const manc = datiMancanti(c);
            return (
              <div key={c._id} style={{ background: '#fff', border: '1px solid #fde8d0', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ color: '#292524', fontSize: '0.95rem' }}>{c.nome} {c.cognome}</strong>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#ffedd5', color: '#9a3412', borderRadius: '999px', padding: '2px 8px' }}>{RUOLO_LABEL[c.ruolo]}</span>
                  {c.stato === 'accettato' && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}><CheckCircle size={12} style={{ verticalAlign: '-2px' }} /> Accettato</span>}
                  {c.stato === 'rifiutato' && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c' }}>❌ Rifiutato</span>}
                  {c.stato === 'in_attesa' && manc.length > 0 && (
                    <span title={manc.join(', ')} style={{ fontSize: '0.75rem', fontWeight: 700, background: '#fef3c7', color: '#b45309', borderRadius: '999px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'help' }}>
                      <AlertTriangle size={11} /> {manc.length} dati mancanti
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#a8a29e' }}>{fmtOra(c.createdAt)}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.8rem', color: '#57534e', marginTop: '6px' }}>
                  {c.telefono && <span>📞 {c.telefono}</span>}
                  {c.nazionalita && <span>🌍 {c.nazionalita}{c.extraUe ? ` · ${PERMESSO_LABEL[c.permessoSoggiorno || ''] || 'permesso?'}` : ''}</span>}
                  {(c.cittaInteresse || c.regioneInteresse) && <span>📍 {[c.cittaInteresse, c.regioneInteresse].filter(Boolean).join(', ')}</span>}
                  {c.disponibilita && <span>{DISP_LABEL[c.disponibilita]}{c.disponibilita === 'h24' && c.residenzaPressoFamiglia ? ' + residenza' : ''}</span>}
                  {c.certificato && <span>🎓 Certificato</span>}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                  <Button size="sm" variant="secondary" onClick={() => setApertoId(aperto ? null : c._id)}>
                    {aperto ? 'Chiudi dettagli' : 'Dettagli'}
                  </Button>
                  {c.documentoNome && (
                    <Button size="sm" variant="secondary" onClick={() => apriDocumento(c)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Paperclip size={13} /> {c.documentoNome}
                    </Button>
                  )}
                  {c.stato === 'in_attesa' && (
                    <>
                      {manc.length > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => apriRichiesta(c)} style={{ display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#fbbf24', color: '#b45309' }}>
                          <Send size={13} /> {richiediId === c._id ? 'Chiudi richiesta' : 'Richiedi dati'}
                        </Button>
                      )}
                      <Button size="sm" onClick={() => accetta(c)} disabled={busy === c._id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <UserCheck size={14} /> {busy === c._id ? 'Attendere…' : 'Accetta → Personale'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => rifiuta(c)} disabled={busy === c._id} style={{ display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#fca5a5', color: '#b91c1c' }}>
                        <XCircle size={14} /> Rifiuta
                      </Button>
                    </>
                  )}
                </div>

                {richiediId === c._id && (
                  <div style={{ marginTop: '10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>
                      ⚠️ Dati mancanti da richiedere a {c.nome}:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {manc.map(m => (
                        <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', background: selCampi.includes(m) ? '#fef3c7' : '#fff', border: '1px solid #fbbf24', borderRadius: '999px', padding: '4px 10px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={selCampi.includes(m)} onChange={() => toggleCampo(m)} /> {m}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Button size="sm" variant="secondary" disabled={!c.email || busy === c._id || !selCampi.length} onClick={() => inviaRichiesta(c, 'email')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail size={13} /> {c.email ? `Email a ${c.email}` : 'Email — non presente'}
                      </Button>
                      <Button size="sm" disabled={!c.telefono || busy === c._id || !selCampi.length} onClick={() => inviaRichiesta(c, 'whatsapp')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#16a34a', borderColor: '#16a34a' }}>
                        <MessageCircle size={13} /> {c.telefono ? 'WhatsApp' : 'WhatsApp — non presente'}
                      </Button>
                    </div>
                    {!c.email && !c.telefono && (
                      <p style={{ fontSize: '0.76rem', color: '#b91c1c', margin: '6px 0 0' }}>Nessun recapito registrato: non è possibile ricontattare il candidato.</p>
                    )}
                    {!!c.richiesteDati?.length && (
                      <p style={{ fontSize: '0.72rem', color: '#a8a29e', margin: '6px 0 0' }}>
                        Ultima richiesta: {fmtOra(c.richiesteDati[c.richiesteDati.length - 1].at)} — {c.richiesteDati.length} totali
                      </p>
                    )}
                  </div>
                )}

                {aperto && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid #fde8d0', paddingTop: '10px', fontSize: '0.82rem', color: '#44403c', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '6px 16px' }}>
                    {c.dataNascita && <span><strong>Nato/a:</strong> {fmtData(c.dataNascita)}</span>}
                    {c.email && <span><strong>Email:</strong> {c.email}</span>}
                    {c.codiceFiscale && <span><strong>CF:</strong> {c.codiceFiscale}</span>}
                    {c.albo && <span><strong>Ordine/Albo:</strong> {c.albo}</span>}
                    {(c.cittaResidenza || c.regioneResidenza) && <span><strong>Residenza:</strong> {[c.cittaResidenza, c.regioneResidenza].filter(Boolean).join(', ')}</span>}
                    {c.esperienze && <span style={{ gridColumn: '1/-1' }}><strong>Esperienze:</strong> {c.esperienze}</span>}
                    {c.note && <span style={{ gridColumn: '1/-1' }}><strong>Note:</strong> {c.note}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
