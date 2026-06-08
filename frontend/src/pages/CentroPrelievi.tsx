import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { useModalita } from '../context/ModalitaContext';
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar, Clock, User, Syringe,
  CheckCircle, Trash2, ChevronDown, ChevronUp, FileText, Building2,
  Printer, UserCheck, ClipboardList, Eye,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

// ─── Interfacce ───────────────────────────────────────────────────────────────
interface Paziente {
  _id: string;
  firstName: string;
  lastName: string;
  tipoGestione?: string;
  siat?: { asl?: string; npi?: string };
}

interface StaffMember {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
}

interface DiariaEntry {
  _id: string;
  autore: string;
  ruoloAutore?: string;
  testo: string;
  data: string;
  firmato: boolean;
  dataFirma?: string;
}

interface Prelievo {
  _id: string;
  patient: Paziente;
  staff: { _id: string; firstName: string; lastName: string; role: string };
  dataPrelievo: string;
  orario?: string;
  tipoPrelievo: string;
  note?: string;
  status: 'pianificato' | 'eseguito' | 'annullato';
  tipoGestione: 'privato' | 'convenzione';
  dataEsecuzione?: string;
  eseguitoDa?: string;
  noteEsecuzione?: string;
  diaria: DiariaEntry[];
  allegati: any[];
  firmaOperatore?: string;
  firmaPaziente?: string;
  nomeFirmatarioPaziente?: string;
  ruoloFirmatario?: 'paziente' | 'caregiver';
}

const TIPI_PRELIEVO = [
  'Emocromo completo', 'Glicemia', 'Coagulazione (PT/INR/aPTT)', 'Elettroliti',
  'Funzionalità epatica', 'Funzionalità renale (creatinina/azoto)', 'Profilo lipidico',
  'Ormoni tiroidei (TSH/fT4)', 'PCR / VES', 'Esame urine', 'Emogasanalisi',
  'Altro (specificare nelle note)',
];

// ─── Helpers calendario ────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
              'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

// ─── Componente principale ────────────────────────────────────────────────────
export default function CentroPrelievi() {
  const { isConvenzione, modalita } = useModalita();
  const { user } = useAuth();
  const puoCreaPrelievo = user && ['admin', 'coordinator'].includes(user.role);

  const oggi = new Date();
  const [tab, setTab] = useState<'prenotazioni' | 'assegnazione'>('prenotazioni');

  // ── Stato calendario
  const [annoCorrente, setAnnoCorrente] = useState(oggi.getFullYear());
  const [meseCorrente, setMeseCorrente] = useState(oggi.getMonth());
  const [giornoSelezionato, setGiornoSelezionato] = useState(toISODate(oggi));

  const [prelievi, setPrelievi] = useState<Prelievo[]>([]);
  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Form nuovo prelievo
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patient: '',
    staff: '',
    dataPrelievo: giornoSelezionato,
    orario: '',
    tipoPrelievo: '',
    note: '',
  });
  const [salvando, setSalvando] = useState(false);

  // ── Dettaglio prelievo aperto (tab prenotazioni)
  const [prelievoAperto, setPrelievoAperto] = useState<Prelievo | null>(null);
  const [testoDiaria, setTestoDiaria] = useState('');
  const [salvandoDiaria, setSalvandoDiaria] = useState(false);
  const [diariaEspansa, setDiariaEspansa] = useState(false);

  // ── Assegnazione multipla (tab assegnazione)
  const [assAnno, setAssAnno] = useState(oggi.getFullYear());
  const [assMese, setAssMese] = useState(oggi.getMonth());
  const [assGiorno, setAssGiorno] = useState(toISODate(oggi));
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set());
  const [operatoreAssegna, setOperatoreAssegna] = useState('');
  const [assegnando, setAssegnando] = useState(false);
  const [assMsg, setAssMsg] = useState('');

  // ─── Caricamento dati ──────────────────────────────────────────────────────
  const caricaPrelievi = async () => {
    try {
      const res = await api.get('/prelievi', { params: { tipoGestione: modalita } });
      setPrelievi(res.data);
    } catch { /* noop */ }
  };

  useEffect(() => {
    const caricaTutto = async () => {
      setLoading(true);
      try {
        const [pazRes, staffRes] = await Promise.all([
          api.get('/patients'),
          api.get('/staff', { params: { active: true } }),
        ]);
        const filtrati = pazRes.data.filter((p: Paziente) =>
          isConvenzione ? p.tipoGestione === 'convenzione' : (p.tipoGestione === 'privato' || !p.tipoGestione)
        );
        setPazienti(filtrati);
        setStaff(staffRes.data.filter((s: StaffMember) => s.active));
      } catch { /* noop */ }
      await caricaPrelievi();
      setLoading(false);
    };
    caricaTutto();
  }, [modalita]);

  // ─── Prelievi per giorno (mappa) ───────────────────────────────────────────
  const prelieviPerGiorno = useMemo(() => {
    const map = new Map<string, Prelievo[]>();
    prelievi.forEach(p => {
      const k = toISODate(new Date(p.dataPrelievo));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return map;
  }, [prelievi]);

  const prelieviGiornoSel = useMemo(
    () => (prelieviPerGiorno.get(giornoSelezionato) || []).sort((a, b) => (a.orario || '').localeCompare(b.orario || '')),
    [prelieviPerGiorno, giornoSelezionato]
  );

  const prelieviAssGiorno = useMemo(
    () => (prelieviPerGiorno.get(assGiorno) || [])
      .filter(p => p.status === 'pianificato')
      .sort((a, b) => (a.orario || '').localeCompare(b.orario || '')),
    [prelieviPerGiorno, assGiorno]
  );

  // ─── Navigazione calendario ────────────────────────────────────────────────
  const mesePrecedente = () => {
    if (meseCorrente === 0) { setMeseCorrente(11); setAnnoCorrente(a => a - 1); }
    else setMeseCorrente(m => m - 1);
  };
  const meseSuccessivo = () => {
    if (meseCorrente === 11) { setMeseCorrente(0); setAnnoCorrente(a => a + 1); }
    else setMeseCorrente(m => m + 1);
  };
  const assMesePrecedente = () => {
    if (assMese === 0) { setAssMese(11); setAssAnno(a => a - 1); }
    else setAssMese(m => m - 1);
  };
  const assMeseSuccessivo = () => {
    if (assMese === 11) { setAssMese(0); setAssAnno(a => a + 1); }
    else setAssMese(m => m + 1);
  };

  // ─── Crea prelievo ─────────────────────────────────────────────────────────
  const creaPrelievo = async () => {
    if (!form.patient || !form.tipoPrelievo) return;
    setSalvando(true);
    try {
      await api.post('/prelievi', { ...form, staff: form.staff || undefined });
      setShowForm(false);
      setForm({ patient: '', staff: '', dataPrelievo: giornoSelezionato, orario: '', tipoPrelievo: '', note: '' });
      await caricaPrelievi();
    } catch { /* noop */ }
    setSalvando(false);
  };

  // ─── Elimina prelievo ──────────────────────────────────────────────────────
  const eliminaPrelievo = async (id: string) => {
    if (!confirm('Eliminare questo prelievo?')) return;
    try {
      await api.delete(`/prelievi/${id}`);
      if (prelievoAperto?._id === id) setPrelievoAperto(null);
      await caricaPrelievi();
    } catch { /* noop */ }
  };

  // ─── Genera HTML per PDF prelievo ───────────────────────────────────────────
  const generaHTMLPrelievo = (p: Prelievo) => {
    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Verbale Prelievo - ${p.patient?.firstName || 'N/D'} ${p.patient?.lastName || ''}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px; }
    .info { margin: 15px 0; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; }
    .box { border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .status-eseguito { background: #f0fdf4; border-left: 4px solid #059669; }
    .firma { margin-top: 10px; }
    .firma img { max-width: 300px; max-height: 150px; border: 1px solid #ccc; border-radius: 4px; }
    .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <h1>📋 Verbale Prelievo</h1>
  <div class="box status-eseguito">
    <div class="info"><span class="label">Stato:</span> <span class="value">✅ ESEGUITO</span></div>
    <div class="info"><span class="label">Data prelievo:</span> <span class="value">${new Date(p.dataPrelievo).toLocaleDateString('it-IT')}</span></div>
    ${p.orario ? `<div class="info"><span class="label">Orario:</span> <span class="value">${p.orario}</span></div>` : ''}
  </div>
  
  <div class="box">
    <h3>👤 Paziente</h3>
    <div class="info"><span class="label">Nome:</span> <span class="value">${p.patient?.firstName || 'N/D'} ${p.patient?.lastName || ''}</span></div>
    <div class="info"><span class="label">Tipo gestione:</span> <span class="value">${p.patient.tipoGestione === 'convenzione' ? 'Convenzione' : 'Privato'}</span></div>
  </div>
  
  <div class="box">
    <h3>💉 Dettagli Prelievo</h3>
    <div class="info"><span class="label">Tipi prelievo:</span> <span class="value">${p.tipoPrelievo}</span></div>
    ${p.note ? `<div class="info"><span class="label">Note:</span> <span class="value">${p.note}</span></div>` : ''}
  </div>
  
  <div class="box">
    <h3>✍️ Esecuzione</h3>
    <div class="info"><span class="label">Eseguito da:</span> <span class="value">${p.eseguitoDa || 'N/A'}</span></div>
    <div class="info"><span class="label">Data esecuzione:</span> <span class="value">${p.dataEsecuzione ? new Date(p.dataEsecuzione).toLocaleDateString('it-IT') : 'N/A'}</span></div>
    ${p.noteEsecuzione ? `<div class="info"><span class="label">Note esecuzione:</span> <span class="value">${p.noteEsecuzione}</span></div>` : ''}
  </div>
  
  ${p.firmaOperatore ? `<div class="box firma">
    <h3>✍️ Firma Operatore</h3>
    <img src="${p.firmaOperatore}" alt="Firma operatore" />
  </div>` : ''}
  
  ${p.firmaPaziente ? `<div class="box firma">
    <h3>✍️ Firma ${p.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'} ${p.nomeFirmatarioPaziente ? `(${p.nomeFirmatarioPaziente})` : ''}</h3>
    <img src="${p.firmaPaziente}" alt="Firma paziente" />
  </div>` : ''}
  
  <div class="footer">
    Documento generato da App Abbraccio - ${new Date().toLocaleString('it-IT')}
  </div>
</body>
</html>`;
  };

  // ─── Stampa PDF prelievo ────────────────────────────────────────────────────
  const stampaPrelievoPDF = (p: Prelievo) => {
    const html = generaHTMLPrelievo(p);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  // ─── Visualizza PDF prelievo ────────────────────────────────────────────────
  const visualizzaPrelievoPDF = (p: Prelievo) => {
    const html = generaHTMLPrelievo(p);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  // ─── Aggiungi diaria ───────────────────────────────────────────────────────
  const aggiungiDiaria = async () => {
    if (!prelievoAperto || !testoDiaria.trim()) return;
    setSalvandoDiaria(true);
    try {
      await api.post(`/prelievi/${prelievoAperto._id}/diaria`, { testo: testoDiaria });
      setTestoDiaria('');
      const res = await api.get(`/prelievi/${prelievoAperto._id}`);
      setPrelievoAperto(res.data);
      await caricaPrelievi();
    } catch { /* noop */ }
    setSalvandoDiaria(false);
  };

  // ─── Assegnazione multipla ─────────────────────────────────────────────────
  const toggleSelezionato = (id: string) => {
    setSelezionati(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selezionaTutti = () => {
    if (selezionati.size === prelieviAssGiorno.length) {
      setSelezionati(new Set());
    } else {
      setSelezionati(new Set(prelieviAssGiorno.map(p => p._id)));
    }
  };

  const assegnaOperatore = async () => {
    if (!operatoreAssegna || selezionati.size === 0) return;
    setAssegnando(true);
    setAssMsg('');
    try {
      await Promise.all(
        Array.from(selezionati).map(id =>
          api.put(`/prelievi/${id}`, { staff: operatoreAssegna })
        )
      );
      setAssMsg(`✅ ${selezionati.size} prelievi assegnati con successo.`);
      setSelezionati(new Set());
      setOperatoreAssegna('');
      await caricaPrelievi();
    } catch {
      setAssMsg('❌ Errore durante l\'assegnazione. Riprova.');
    }
    setAssegnando(false);
  };

  // ─── Stampa foglio firma ───────────────────────────────────────────────────
  const stampaFoglioFirma = () => {
    const dataLabel = new Date(giornoSelezionato + 'T12:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const perOperatore = new Map<string, { nome: string; prelievi: Prelievo[] }>();
    prelieviGiornoSel.forEach(p => {
      const key = p.staff._id;
      if (!perOperatore.has(key)) {
        perOperatore.set(key, { nome: `${p.staff?.firstName || 'N/D'} ${p.staff?.lastName || ''}`, prelievi: [] });
      }
      perOperatore.get(key)!.prelievi.push(p);
    });
    const tipoLabel = isConvenzione ? 'Convenzione SIAT' : 'Gestione Privata';
    const righe = Array.from(perOperatore.values()).map(op => `
      <div style="margin-bottom:32px;page-break-inside:avoid;">
        <div style="background:#f1f5f9;border-radius:6px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:700;">Operatore incaricato</div>
            <div style="font-size:1rem;font-weight:800;color:#1e293b;margin-top:2px;">${op.nome}</div>
          </div>
          <div style="font-size:0.85rem;color:#64748b;">Prelievi: <strong>${op.prelievi.length}</strong></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
          <thead><tr style="background:#e2e8f0;">
            <th style="padding:8px 10px;border:1px solid #cbd5e1;width:60px;">Orario</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;">Paziente</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;">Tipo prelievo</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;width:80px;">Stato</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;width:100px;text-align:center;">Firma Op.</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;width:100px;text-align:center;">Controfirma Paz.</th>
          </tr></thead>
          <tbody>${op.prelievi.map((p, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
              <td style="padding:10px;border:1px solid #e2e8f0;text-align:center;font-weight:600;">${p.orario || '—'}</td>
              <td style="padding:10px;border:1px solid #e2e8f0;"><div style="font-weight:700;">${p.patient?.firstName || 'N/D'} ${p.patient?.lastName || ''}</div>${p.patient?.siat?.asl ? `<div style="font-size:0.75rem;color:#64748b;">ASL: ${p.patient.siat.asl}</div>` : ''}</td>
              <td style="padding:10px;border:1px solid #e2e8f0;">${p.tipoPrelievo}${p.note ? `<div style="font-size:0.75rem;color:#64748b;">${p.note}</div>` : ''}</td>
              <td style="padding:10px;border:1px solid #e2e8f0;text-align:center;"><span style="font-size:0.75rem;font-weight:700;padding:2px 6px;border-radius:4px;background:${p.status === 'eseguito' ? '#dcfce7' : '#dbeafe'};color:${p.status === 'eseguito' ? '#166534' : '#1e40af'};">${p.status === 'eseguito' ? '✓ Eseguito' : 'Pianificato'}</span></td>
              <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center;">${p.firmaOperatore ? `<img src="${p.firmaOperatore}" style="max-width:88px;max-height:44px;display:block;margin:auto;"/>` : '<div style="height:44px;"></div>'}</td>
              <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center;">${p.firmaPaziente ? `<div style="font-size:0.7rem;color:#64748b;">${p.nomeFirmatarioPaziente || 'Paziente'}</div><img src="${p.firmaPaziente}" style="max-width:88px;max-height:44px;display:block;margin:auto;"/>` : '<div style="height:44px;"></div>'}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`).join('<hr style="border:none;border-top:2px dashed #e2e8f0;margin:24px 0;">');

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Foglio Prelievi — ${dataLabel}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px 32px;color:#1e293b;}@media print{body{padding:16px 20px;}}</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #1e293b;padding-bottom:12px;">
        <div><h1 style="font-size:1.2rem;margin:0 0 4px;">📋 Foglio Prelievi Giornaliero</h1>
          <div style="font-size:0.9rem;color:#475569;">${dataLabel}</div>
          <div style="display:inline-block;padding:2px 10px;border-radius:4px;background:${isConvenzione ? '#dbeafe' : '#dcfce7'};color:${isConvenzione ? '#1e40af' : '#166534'};font-weight:700;font-size:0.8rem;margin-top:4px;">${tipoLabel}</div>
        </div>
        <div style="text-align:right;font-size:0.8rem;color:#64748b;">Totale: <strong>${prelieviGiornoSel.length}</strong><br/>Stampato: ${new Date().toLocaleString('it-IT')}</div>
      </div>
      ${righe}
      <div style="margin-top:40px;font-size:0.72rem;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;">Abbraccio Cure Domiciliari — Documento riservato uso interno</div>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  // ─── Calendario helper ─────────────────────────────────────────────────────
  const renderCalendario = (
    anno: number, mese: number,
    onPrev: () => void, onNext: () => void,
    giornoSel: string, onGiorno: (iso: string) => void,
    colore: string
  ) => {
    const numeroCelle = getDaysInMonth(anno, mese);
    const primoGiorno = getFirstDayOfMonth(anno, mese);
    const celle = Array.from({ length: primoGiorno + numeroCelle }, (_, i) => i < primoGiorno ? null : i - primoGiorno + 1);
    return (
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button onClick={onPrev} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}><ChevronLeft size={18} /></button>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>{MESI[mese]} {anno}</span>
          <button onClick={onNext} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}><ChevronRight size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
          {GIORNI.map(g => <div key={g} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>{g}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {celle.map((giorno, idx) => {
            if (!giorno) return <div key={`e-${idx}`} />;
            const iso = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
            const num = prelieviPerGiorno.get(iso)?.length || 0;
            const isOggi = iso === toISODate(new Date());
            const isSel = iso === giornoSel;
            return (
              <button key={iso} onClick={() => onGiorno(iso)} style={{
                border: 'none', borderRadius: '8px', padding: '6px 4px', cursor: 'pointer', textAlign: 'center',
                background: isSel ? colore : isOggi ? '#f1f5f9' : 'transparent',
                color: isSel ? 'white' : isOggi ? colore : '#374151',
                fontWeight: isOggi || isSel ? 700 : 400, position: 'relative', minHeight: '42px',
              }}>
                <div style={{ fontSize: '0.85rem' }}>{giorno}</div>
                {num > 0 && (
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.35)' : colore, color: 'white', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0' }}>{num}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── UI ────────────────────────────────────────────────────────────────────
  if (loading) return <section><p>Caricamento...</p></section>;

  const colore = isConvenzione ? '#0369a1' : '#1e4d8c';
  const badgeModalita = isConvenzione
    ? <span style={{ background: '#eff6ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '6px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}><Building2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Convenzione SIAT</span>
    : <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}>👤 Privati</span>;

  return (
    <section className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: colore }}>
            <Syringe size={26} />
            Centro Prenotazioni Prelievi
          </h1>
          <div style={{ marginTop: '6px' }}>{badgeModalita}</div>
        </div>
        {puoCreaPrelievo && (
          <button
            onClick={() => { setForm(f => ({ ...f, dataPrelievo: giornoSelezionato })); setShowForm(true); }}
            style={{ background: colore, color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
          >
            <Plus size={18} />Nuova Prenotazione
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {([['prenotazioni', <ClipboardList size={16} />, 'Prenotazioni'] , ['assegnazione', <UserCheck size={16} />, 'Assegnazione Operatori']] as const).map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: '6px',
              background: tab === key ? colore : 'transparent',
              color: tab === key ? 'white' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB PRENOTAZIONI                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'prenotazioni' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          {renderCalendario(annoCorrente, meseCorrente, mesePrecedente, meseSuccessivo, giornoSelezionato, setGiornoSelezionato, colore)}

          {/* Lista giornaliera */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Calendar size={18} style={{ color: colore }} />
              {new Date(giornoSelezionato + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              <span style={{ background: '#f1f5f9', borderRadius: '12px', padding: '2px 10px', fontSize: '0.8rem', color: '#64748b' }}>
                {prelieviGiornoSel.length} prelievi
              </span>
              {prelieviGiornoSel.length > 0 && (
                <button
                  onClick={stampaFoglioFirma}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: colore, color: 'white', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                >
                  <Printer size={15} />Stampa
                </button>
              )}
            </div>

            {prelieviGiornoSel.length === 0 ? (
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '32px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                <Syringe size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                <p style={{ color: '#94a3b8', margin: 0 }}>Nessun prelievo prenotato</p>
                <p style={{ color: '#cbd5e1', margin: '6px 0 0', fontSize: '0.85rem' }}>Clicca "Nuova Prenotazione" per aggiungerne uno</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {prelieviGiornoSel.map(p => (
                  <div key={p._id} style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: `4px solid ${p.status === 'eseguito' ? '#059669' : p.status === 'annullato' ? '#dc2626' : colore}`, overflow: 'hidden' }}>
                    <div onClick={() => setPrelievoAperto(prelievoAperto?._id === p._id ? null : p)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {p.orario && <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', color: '#475569' }}><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{p.orario}</span>}
                          {p.patient?.firstName || 'N/D'} {p.patient?.lastName || ''}
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: p.status === 'eseguito' ? '#f0fdf4' : p.status === 'annullato' ? '#fef2f2' : '#eff6ff', color: p.status === 'eseguito' ? '#059669' : p.status === 'annullato' ? '#dc2626' : colore }}>
                            {p.status === 'eseguito' ? '✅ Eseguito' : p.status === 'annullato' ? '❌ Annullato' : '🔵 Pianificato'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.83rem', color: '#64748b', marginTop: '4px' }}>
                          💉 {p.tipoPrelievo}
                          {p.staff?.firstName && <span> · 👤 {p.staff.firstName} {p.staff?.lastName || ''}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        {puoCreaPrelievo && <button onClick={e => { e.stopPropagation(); eliminaPrelievo(p._id); }} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={14} /></button>}
                        {prelievoAperto?._id === p._id ? <ChevronUp size={16} style={{ color: '#94a3b8' }} /> : <ChevronDown size={16} style={{ color: '#94a3b8' }} />}
                      </div>
                    </div>

                    {prelievoAperto?._id === p._id && (
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px' }}>
                        {p.note && <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '12px' }}>📝 {p.note}</p>}
                        {p.status === 'eseguito' && (
                          <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '0.85rem', color: '#166534' }}>
                            ✅ Eseguito da <strong>{p.eseguitoDa}</strong> il {new Date(p.dataEsecuzione!).toLocaleDateString('it-IT')}
                            {p.noteEsecuzione && <div style={{ marginTop: '4px', color: '#374151' }}>{p.noteEsecuzione}</div>}
                          </div>
                        )}

                        {/* Firme */}
                        {p.status === 'eseguito' && (p.firmaOperatore || p.firmaPaziente) && (
                          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#374151', marginBottom: '10px' }}>✍️ Firme</div>
                            {p.firmaOperatore && (
                              <div style={{ marginBottom: '10px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Firma Operatore:</div>
                                <img src={p.firmaOperatore} alt="Firma operatore" style={{ maxWidth: '200px', maxHeight: '100px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white' }} />
                              </div>
                            )}
                            {p.firmaPaziente && (
                              <div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                                  Firma {p.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'} {p.nomeFirmatarioPaziente && `(${p.nomeFirmatarioPaziente})`}:
                                </div>
                                <img src={p.firmaPaziente} alt="Firma paziente" style={{ maxWidth: '200px', maxHeight: '100px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white' }} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Pulsanti PDF per prelievo eseguito */}
                        {p.status === 'eseguito' && (
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <button
                              onClick={() => stampaPrelievoPDF(p)}
                              style={{ flex: 1, background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Printer size={14} /> Stampa PDF
                            </button>
                            <button
                              onClick={() => visualizzaPrelievoPDF(p)}
                              style={{ flex: 1, background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Eye size={14} /> Visualizza PDF
                            </button>
                          </div>
                        )}
                        {/* Diaria */}
                        <div>
                          <button onClick={() => setDiariaEspansa(!diariaEspansa)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 0 8px' }}>
                            <FileText size={16} />Diaria Clinica ({p.diaria.length}){diariaEspansa ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          {diariaEspansa && (
                            <div>
                              {p.diaria.length === 0 && <p style={{ fontSize: '0.83rem', color: '#94a3b8' }}>Nessuna voce</p>}
                              {p.diaria.map(d => (
                                <div key={d._id} style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px 10px', marginBottom: '6px', fontSize: '0.83rem' }}>
                                  <div style={{ fontWeight: 600, color: '#374151' }}>{d.autore} · {new Date(d.data).toLocaleString('it-IT')}</div>
                                  <div style={{ color: '#475569', marginTop: '2px' }}>{d.testo}</div>
                                </div>
                              ))}
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <textarea value={testoDiaria} onChange={e => setTestoDiaria(e.target.value)} placeholder="Aggiungi nota clinica..." rows={2} style={{ flex: 1, borderRadius: '6px', border: '1px solid #d1d5db', padding: '8px', fontSize: '0.85rem', resize: 'vertical' }} />
                                <Button
                                  onClick={aggiungiDiaria}
                                  loading={salvandoDiaria}
                                  disabled={!testoDiaria.trim()}
                                  variant="primary"
                                  size="sm"
                                >
                                  Salva
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB ASSEGNAZIONE                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'assegnazione' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '24px', alignItems: 'start' }}>
          {renderCalendario(assAnno, assMese, assMesePrecedente, assMeseSuccessivo, assGiorno, (iso) => { setAssGiorno(iso); setSelezionati(new Set()); setAssMsg(''); }, colore)}

          {/* Pannello assegnazione */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#374151', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <UserCheck size={18} style={{ color: colore }} />
              {new Date(assGiorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              <span style={{ background: '#f1f5f9', borderRadius: '12px', padding: '2px 10px', fontSize: '0.8rem', color: '#64748b' }}>
                {prelieviAssGiorno.length} da assegnare
              </span>
            </div>

            {prelieviAssGiorno.length === 0 ? (
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '32px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                <CheckCircle size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                <p style={{ color: '#94a3b8', margin: 0 }}>Nessun prelievo pianificato in questo giorno</p>
              </div>
            ) : (
              <>
                {/* Seleziona tutti */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={selezionati.size === prelieviAssGiorno.length && prelieviAssGiorno.length > 0}
                      onChange={selezionaTutti}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    Seleziona tutti ({prelieviAssGiorno.length})
                  </label>
                  {selezionati.size > 0 && (
                    <span style={{ background: colore, color: 'white', borderRadius: '12px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}>
                      {selezionati.size} selezionati
                    </span>
                  )}
                </div>

                {/* Lista prelievi selezionabili */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto', marginBottom: '16px' }}>
                  {prelieviAssGiorno.map(p => {
                    const sel = selezionati.has(p._id);
                    return (
                      <div
                        key={p._id}
                        onClick={() => toggleSelezionato(p._id)}
                        style={{ background: sel ? (isConvenzione ? '#eff6ff' : '#f0fdf4') : 'white', border: `2px solid ${sel ? colore : '#e2e8f0'}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s' }}
                      >
                        <input type="checkbox" checked={sel} onChange={() => toggleSelezionato(p._id)} onClick={e => e.stopPropagation()} style={{ width: '17px', height: '17px', cursor: 'pointer', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {p.orario && <span style={{ background: '#f1f5f9', padding: '1px 7px', borderRadius: '5px', fontSize: '0.75rem', color: '#475569' }}>{p.orario}</span>}
                            {p.patient?.firstName || 'N/D'} {p.patient?.lastName || ''}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                            💉 {p.tipoPrelievo}
                            {p.staff?.firstName
                              ? <span style={{ marginLeft: '8px', color: '#0369a1', fontWeight: 600 }}>→ {p.staff?.firstName} {p.staff?.lastName || ''}</span>
                              : <span style={{ marginLeft: '8px', color: '#f59e0b', fontWeight: 600 }}>⚠ Non assegnato</span>
                            }
                          </div>
                        </div>
                        <User size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>

                {/* Pannello assegna */}
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={16} style={{ color: colore }} />
                    Assegna i prelievi selezionati a:
                  </div>
                  <select
                    value={operatoreAssegna}
                    onChange={e => setOperatoreAssegna(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '12px', fontSize: '0.875rem' }}
                  >
                    <option value="">Seleziona operatore...</option>
                    {staff.map(s => (
                      <option key={s._id} value={s._id}>{s?.firstName || 'N/D'} {s?.lastName || ''} — {s?.role || 'N/D'}</option>
                    ))}
                  </select>
                  <button
                    onClick={assegnaOperatore}
                    disabled={assegnando || selezionati.size === 0 || !operatoreAssegna}
                    style={{
                      width: '100%', padding: '11px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '0.9rem',
                      cursor: (selezionati.size > 0 && operatoreAssegna) ? 'pointer' : 'not-allowed',
                      background: (selezionati.size > 0 && operatoreAssegna) ? colore : '#e2e8f0',
                      color: (selezionati.size > 0 && operatoreAssegna) ? 'white' : '#94a3b8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                  >
                    <UserCheck size={18} />
                    {assegnando ? 'Assegnazione in corso...' : `Assegna ${selezionati.size > 0 ? selezionati.size : ''} prelievo${selezionati.size !== 1 ? 'i' : ''}`}
                  </button>
                  {assMsg && (
                    <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', background: assMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: assMsg.startsWith('✅') ? '#166534' : '#dc2626', fontSize: '0.875rem', fontWeight: 600 }}>
                      {assMsg}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ FORM NUOVA PRENOTAZIONE ════════════════════════════════════════ */}
      {showForm && puoCreaPrelievo && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: colore }}>
                <Syringe size={20} />Nuova Prenotazione Prelievo
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                <X size={20} />
              </Button>
            </div>
            <div style={{ display: 'grid', gap: '14px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Paziente *
                <select value={form.patient} onChange={e => setForm(f => ({ ...f, patient: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                  <option value="">Seleziona paziente...</option>
                  {pazienti.map(p => <option key={p._id} value={p._id}>{p?.firstName || 'N/D'} {p?.lastName || ''}{p?.siat?.asl ? ` — ${p.siat.asl}` : ''}</option>)}
                </select>
              </label>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Operatore (opzionale — si può assegnare dopo)
                <select value={form.staff} onChange={e => setForm(f => ({ ...f, staff: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                  <option value="">Da assegnare in seguito...</option>
                  {staff.map(s => <option key={s._id} value={s._id}>{s?.firstName || 'N/D'} {s?.lastName || ''} — {s?.role || 'N/D'}</option>)}
                </select>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  Data *
                  <input type="date" value={form.dataPrelievo} onChange={e => setForm(f => ({ ...f, dataPrelievo: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  Orario
                  <input type="time" value={form.orario} onChange={e => setForm(f => ({ ...f, orario: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </label>
              </div>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Tipo prelievo *
                <select value={form.tipoPrelievo} onChange={e => setForm(f => ({ ...f, tipoPrelievo: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                  <option value="">Seleziona tipo...</option>
                  {TIPI_PRELIEVO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Note / Prestazione
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="Es: impegnativa n°..., preparazione richiesta..." style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Annulla
              </Button>
              <Button
                variant="primary"
                loading={salvando}
                disabled={!form.patient || !form.tipoPrelievo}
                icon={<CheckCircle size={16} />}
              >
                Salva Prenotazione
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
