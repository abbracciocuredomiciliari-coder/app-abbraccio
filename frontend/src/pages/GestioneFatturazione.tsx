import { useEffect, useState, useMemo, FormEvent } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import { Receipt, Calendar, FileText, Printer, User, Filter, ChevronDown, ChevronUp, Building2, Download, Mail, Eye, Pencil, Trash2, Archive } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  codiceFiscale?: string;
  address?: string;
  email?: string;
}

interface GiornoSettimana {
  giorno: number;
  accessiAlGiorno: number;
  minutiPerAccesso: number;
}

interface WorkPlanItem {
  _id: string;
  type: string;
  task: string;
  date: string;
  dataFine?: string;
  duration?: number;
  compensoTotale?: number;
  costoPrestazione?: number;
  tariffaAsl?: number;
  tipoCompenso?: 'orario' | 'fisso' | 'nessuno';
  tariffa?: number;
  patient: Patient & { tipoGestione?: string; siat?: { asl?: string; npi?: string; codiceAutorizzazione?: string } };
  staff: { firstName: string; lastName: string; role: string };
  giorniSettimana?: GiornoSettimana[];
}

interface RiepilogoAsl {
  asl: string;
  workPlans: WorkPlanItem[];
  totaleTariffe: number;
  totaleCompensoOperatori: number;
  numeroPrestazioni: number;
  numeroPazienti: number;
}

interface RiepilogoPaziente {
  patient: Patient;
  workPlans: WorkPlanItem[];
  totaleFatturato: number;
  totaleCompensoOperatori: number;
  totaleUtile: number;
  numeroPrestazioni: number;
}

interface DocumentoFatturazione {
  _id: string;
  numero: string;
  tipo: 'preventivo' | 'fattura';
  patient: Patient;
  prestazioni: { descrizione: string; quantita: number; prezzoUnitario: number; importo: number; tipo?: string }[];
  totale: number;
  data: string;
  dataPrestazione?: string;
  stato: 'emesso' | 'firmato' | 'annullato' | 'rifiutato';
  motivazioneRifiuto?: string;
  rifiutatoIl?: string;
  note?: string;
  documentoOrigineId?: string;
  firma?: {
    firmato: boolean;
    firmatoIl?: string;
    nome?: string;
    email?: string;
    token?: string;
    rifiutoRegistro?: boolean;
  };
}

interface GestioneFatturazioneProps {
  archivioOnly?: boolean;
}

export default function GestioneFatturazione({ archivioOnly = false }: GestioneFatturazioneProps) {
  const { user } = useAuth();
  const { isConvenzione } = useModalita();
  const [workplans, setWorkplans] = useState<WorkPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [ricercaPaziente, setRicercaPaziente] = useState('');
  const [pazienteEspanso, setPazienteEspanso] = useState<string | null>(null);
  const [aslEspansa, setAslEspansa] = useState<string | null>(null);
  const [showFiltri, setShowFiltri] = useState(true);
  const [documenti, setDocumenti] = useState<DocumentoFatturazione[]>([]);
  const [showDocumenti, setShowDocumenti] = useState(true);
  const [showArchivio, setShowArchivio] = useState(true);
  const [emailModalDoc, setEmailModalDoc] = useState<DocumentoFatturazione | null>(null);
  const [emailDestinatario, setEmailDestinatario] = useState('');
  const [emailNome, setEmailNome] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [numeroModalDoc, setNumeroModalDoc] = useState<DocumentoFatturazione | null>(null);
  const [numeroNuovo, setNumeroNuovo] = useState('');
  const [numeroLoading, setNumeroLoading] = useState(false);

  const [editModalDoc, setEditModalDoc] = useState<DocumentoFatturazione | null>(null);
  const [editPrestazioni, setEditPrestazioni] = useState<{ descrizione: string; quantita: number; prezzoUnitario: number }[]>([]);
  const [editNote, setEditNote] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [preventivoModalWp, setPreventivoModalWp] = useState<WorkPlanItem | null>(null);
  const [preventivoData, setPreventivoData] = useState('');
  const [preventivoTipo, setPreventivoTipo] = useState<'giornaliero' | 'orario' | 'fisso'>('fisso');
  const [preventivoLoading, setPreventivoLoading] = useState(false);
  const [preventivoError, setPreventivoError] = useState('');

  const GIORNI_LABEL = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  useEffect(() => { caricaDati(); caricaDocumenti(); }, []);

  const caricaDati = async () => {
    setLoading(true);
    try {
      const res = await api.get('/workplan');
      setWorkplans(res.data);
    } catch (err) {
      console.error('Errore caricamento dati:', err);
    } finally {
      setLoading(false);
    }
  };

  const caricaDocumenti = async () => {
    try {
      const res = await api.get('/fatturazione-documenti');
      setDocumenti(res.data);
    } catch (err) {
      console.error('Errore caricamento documenti:', err);
    }
  };

  const convertiInFattura = async (doc: DocumentoFatturazione) => {
    if (!confirm(`Confermi la generazione della fattura a partire dal preventivo ${doc.numero}?`)) return;
    try {
      await api.post(`/fatturazione-documenti/${doc._id}/converti-in-fattura`);
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella conversione in fattura');
    }
  };

  const annullaDocumento = async (doc: DocumentoFatturazione) => {
    if (!confirm(`Annullare il documento ${doc.numero}?`)) return;
    try {
      await api.patch(`/fatturazione-documenti/${doc._id}/annulla`);
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Errore nell'annullamento");
    }
  };

  const eliminaDocumento = async (doc: DocumentoFatturazione) => {
    if (!confirm(`Eliminare definitivamente il documento ${doc.numero}?\n\nQuesta azione non può essere annullata.`)) return;
    try {
      await api.delete(`/fatturazione-documenti/${doc._id}`);
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella eliminazione');
    }
  };

  const scaricaDocumentoPDF = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(`/fatturazione-documenti/${doc._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel download del PDF');
    }
  };

  const apriInvioEmail = (doc: DocumentoFatturazione) => {
    setEmailModalDoc(doc);
    setEmailDestinatario(doc.patient?.email || '');
    setEmailNome(`${doc.patient?.firstName || ''} ${doc.patient?.lastName || ''}`.trim());
    setEmailSending(false);
  };

  const chiudiInvioEmail = () => {
    setEmailModalDoc(null);
    setEmailDestinatario('');
    setEmailNome('');
    setEmailSending(false);
  };

  const inviaDocumentoEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModalDoc || !emailDestinatario) return;
    setEmailSending(true);
    try {
      await api.post(`/fatturazione-documenti/${emailModalDoc._id}/invia-email`, {
        email: emailDestinatario,
        nome: emailNome,
      });
      alert('Documento inviato con successo');
      chiudiInvioEmail();
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell\'invio dell\'email');
    } finally {
      setEmailSending(false);
    }
  };

  const scaricaDocumentoFirmato = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(`/fatturazione-documenti/${doc._id}/firmato`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}-firmato.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel download del PDF firmato');
    }
  };

  const anteprimaDocumento = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(`/fatturazione-documenti/${doc._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella generazione anteprima');
    }
  };

  const apriModificaNumero = (doc: DocumentoFatturazione) => {
    setNumeroModalDoc(doc);
    setNumeroNuovo(doc.numero);
  };

  const chiudiModificaNumero = () => {
    setNumeroModalDoc(null);
    setNumeroNuovo('');
    setNumeroLoading(false);
  };

  const salvaNumero = async (e: FormEvent) => {
    e.preventDefault();
    if (!numeroModalDoc || !numeroNuovo.trim()) return;
    setNumeroLoading(true);
    try {
      await api.patch(`/fatturazione-documenti/${numeroModalDoc._id}/numero`, { numero: numeroNuovo.trim() });
      alert('Numero aggiornato');
      chiudiModificaNumero();
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento numero');
    } finally {
      setNumeroLoading(false);
    }
  };

  const apriModificaVoci = (doc: DocumentoFatturazione) => {
    setEditModalDoc(doc);
    setEditPrestazioni(doc.prestazioni.map(p => ({ descrizione: p.descrizione, quantita: p.quantita, prezzoUnitario: p.prezzoUnitario })));
    setEditNote(doc.note || '');
  };

  const chiudiModificaVoci = () => {
    setEditModalDoc(null);
    setEditPrestazioni([]);
    setEditNote('');
    setEditLoading(false);
  };

  const aggiornaVoce = (i: number, field: 'descrizione' | 'quantita' | 'prezzoUnitario', value: string | number) => {
    setEditPrestazioni(prev => prev.map((p, j) => j === i ? { ...p, [field]: value } : p));
  };

  const aggiungiVoce = () => {
    setEditPrestazioni(prev => [...prev, { descrizione: '', quantita: 1, prezzoUnitario: 0 }]);
  };

  const rimuoviVoce = (i: number) => {
    setEditPrestazioni(prev => prev.filter((_, j) => j !== i));
  };

  const totaleEdit = useMemo(() => {
    return Math.round(editPrestazioni.reduce((acc, p) => acc + ((Number(p.quantita) || 0) * (Number(p.prezzoUnitario) || 0)), 0) * 100) / 100;
  }, [editPrestazioni]);

  const salvaVoci = async (e: FormEvent) => {
    e.preventDefault();
    if (!editModalDoc) return;
    if (editPrestazioni.length === 0 || editPrestazioni.some(p => !p.descrizione.trim())) {
      alert('Ogni voce deve avere una descrizione');
      return;
    }
    setEditLoading(true);
    try {
      await api.put(`/fatturazione-documenti/${editModalDoc._id}`, {
        prestazioni: editPrestazioni.map(p => ({ descrizione: p.descrizione.trim(), quantita: Number(p.quantita), prezzoUnitario: Number(p.prezzoUnitario) })),
        note: editNote,
      });
      alert('Documento aggiornato');
      chiudiModificaVoci();
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento voci');
    } finally {
      setEditLoading(false);
    }
  };

  const workplansFiltratiPerData = useMemo(() => {
    return workplans.filter(wp => {
      const dataWp = new Date(wp.date);
      if (dataInizio && dataWp < new Date(dataInizio)) return false;
      if (dataFine) { const fine = new Date(dataFine); fine.setHours(23,59,59,999); if (dataWp > fine) return false; }
      return true;
    });
  }, [workplans, dataInizio, dataFine]);

  // Piani PRIVATI con costoPrestazione > 0
  const pianiPrivati = useMemo(() =>
    workplansFiltratiPerData.filter(wp =>
      (wp.patient?.tipoGestione === 'privato' || !wp.patient?.tipoGestione) &&
      wp.costoPrestazione && wp.costoPrestazione > 0
    ), [workplansFiltratiPerData]);

  // Piani CONVENZIONE con tariffaAsl > 0
  const pianiConvenzione = useMemo(() =>
    workplansFiltratiPerData.filter(wp =>
      wp.patient?.tipoGestione === 'convenzione' &&
      wp.tariffaAsl && wp.tariffaAsl > 0
    ), [workplansFiltratiPerData]);

  // Riepilogo per ASL (convenzione)
  const riepiloghiPerAsl = useMemo(() => {
    const map = new Map<string, RiepilogoAsl>();
    pianiConvenzione.forEach(wp => {
      if (!wp.patient?._id) return;
      const aslKey = wp.patient?.siat?.asl || 'ASL non specificata';
      const existing = map.get(aslKey);
      const compenso = wp.compensoTotale || 0;
      const tariffa = wp.tariffaAsl || 0;
      if (existing) {
        existing.workPlans.push(wp);
        existing.totaleTariffe += tariffa;
        existing.totaleCompensoOperatori += compenso;
        existing.numeroPrestazioni += 1;
        if (!existing.workPlans.slice(0, -1).some(p => p.patient?._id === wp.patient._id))
          existing.numeroPazienti += 1;
      } else {
        map.set(aslKey, { asl: aslKey, workPlans: [wp], totaleTariffe: tariffa, totaleCompensoOperatori: compenso, numeroPrestazioni: 1, numeroPazienti: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totaleTariffe - a.totaleTariffe);
  }, [pianiConvenzione]);

  const totaliAsl = useMemo(() => riepiloghiPerAsl.reduce(
    (acc, r) => ({ totale: acc.totale + r.totaleTariffe, compenso: acc.compenso + r.totaleCompensoOperatori, prestazioni: acc.prestazioni + r.numeroPrestazioni }),
    { totale: 0, compenso: 0, prestazioni: 0 }
  ), [riepiloghiPerAsl]);

  const riepiloghiPerPaziente = useMemo(() => {
    const map = new Map<string, RiepilogoPaziente>();
    pianiPrivati.forEach(wp => {
      if (!wp.patient?._id) return;
      const patientId = wp.patient._id;
      const existing = map.get(patientId);
      const compensoOp = wp.compensoTotale || 0;
      const costo = wp.costoPrestazione || 0;
      const utile = costo - compensoOp;
      if (existing) {
        existing.workPlans.push(wp);
        existing.totaleFatturato += costo;
        existing.totaleCompensoOperatori += compensoOp;
        existing.totaleUtile += utile;
        existing.numeroPrestazioni += 1;
      } else {
        map.set(patientId, {
          patient: wp.patient,
          workPlans: [wp],
          totaleFatturato: costo,
          totaleCompensoOperatori: compensoOp,
          totaleUtile: utile,
          numeroPrestazioni: 1
        });
      }
    });
    return Array.from(map.values()).filter(r => {
      if (!ricercaPaziente) return true;
      const nomeCompleto = `${r.patient.firstName} ${r.patient.lastName}`.toLowerCase();
      return nomeCompleto.includes(ricercaPaziente.toLowerCase()) ||
             r.patient.codiceFiscale?.toLowerCase().includes(ricercaPaziente.toLowerCase());
    }).sort((a, b) => b.totaleFatturato - a.totaleFatturato);
  }, [pianiPrivati, ricercaPaziente]);

  const totaliGenerali = useMemo(() => {
    return riepiloghiPerPaziente.reduce((acc, r) => ({
      totaleFatturato: acc.totaleFatturato + r.totaleFatturato,
      totaleCompenso: acc.totaleCompenso + r.totaleCompensoOperatori,
      totaleUtile: acc.totaleUtile + r.totaleUtile,
      numeroPazienti: acc.numeroPazienti + 1,
      numeroPrestazioni: acc.numeroPrestazioni + r.numeroPrestazioni
    }), { totaleFatturato: 0, totaleCompenso: 0, totaleUtile: 0, numeroPazienti: 0, numeroPrestazioni: 0 });
  }, [riepiloghiPerPaziente]);

  const archivioIds = useMemo(() => {
    const ids = new Set<string>();
    documenti.forEach(d => {
      if (d.tipo === 'fattura' && d.stato === 'firmato') {
        ids.add(d._id);
        if (d.documentoOrigineId) ids.add(d.documentoOrigineId);
      }
    });
    return ids;
  }, [documenti]);

  const documentiAttivi = useMemo(() => documenti.filter(d => !archivioIds.has(d._id) && d.stato !== 'rifiutato'), [documenti, archivioIds]);
  const archivioFatture = useMemo(() => documenti.filter(d => d.tipo === 'fattura' && d.stato === 'firmato'), [documenti]);
  const preventiviRifiutati = useMemo(() => documenti.filter(d => d.tipo === 'preventivo' && d.stato === 'rifiutato'), [documenti]);

  const formatData = (d: string) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatEuro = (n: number) => `€${n.toFixed(2)}`;

  const oreGiorno = (g: GiornoSettimana) => Math.round((g.accessiAlGiorno || 0) * ((g.minutiPerAccesso || 60) / 60) * 2) / 2;
  const oreTotaliSettimana = (wp: WorkPlanItem) => (wp.giorniSettimana || []).reduce((acc, g) => acc + oreGiorno(g), 0);

  // Occorrenze di un giorno della settimana nell'intero periodo del piano (date → dataFine)
  const contaOccorrenzeGiorno = (wp: WorkPlanItem, giorno: number) => {
    if (!wp.date) return 0;
    const start = new Date(wp.date); start.setHours(0, 0, 0, 0);
    const end = wp.dataFine ? new Date(wp.dataFine) : new Date(start.getTime() + 6 * 86400000);
    end.setHours(0, 0, 0, 0);
    if (end < start) return 0;
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === giorno) count++;
    }
    return count;
  };
  // Ore totali del piano su tutto il periodo (non solo una settimana)
  const oreTotaliPeriodo = (wp: WorkPlanItem) => (wp.giorniSettimana || []).reduce((acc, g) => acc + oreGiorno(g) * contaOccorrenzeGiorno(wp, g.giorno), 0);

  const calcolaTariffaOraria = (wp: WorkPlanItem) => {
    if ((wp.tipoCompenso === 'orario' || wp.tipoCompenso === 'nessuno') && (wp.tariffa || 0) > 0) return wp.tariffa!;
    const durataOre = (wp.duration || 60) / 60;
    if (durataOre > 0 && (wp.costoPrestazione || 0) > 0) return Math.round((wp.costoPrestazione! / durataOre) * 100) / 100;
    return 0;
  };

  const apriPreventivoModal = (wp: WorkPlanItem) => {
    setPreventivoModalWp(wp);
    setPreventivoData(wp.date ? new Date(wp.date).toISOString().split('T')[0] : '');
    setPreventivoTipo('fisso');
    setPreventivoError('');
  };

  const chiudiPreventivoModal = () => {
    setPreventivoModalWp(null);
    setPreventivoData('');
    setPreventivoError('');
  };

  const totalePreventivoSelezionato = (wp: WorkPlanItem, tipo: 'giornaliero' | 'orario' | 'fisso'): number => {
    const tariffaOraria = calcolaTariffaOraria(wp);
    if (tipo === 'fisso' || tariffaOraria <= 0) return wp.costoPrestazione || 0;
    if (tipo === 'giornaliero') {
      return (wp.giorniSettimana || [])
        .filter(g => (g.accessiAlGiorno || 0) > 0)
        .reduce((sum, g) => sum + oreGiorno(g) * contaOccorrenzeGiorno(wp, g.giorno) * tariffaOraria, 0);
    }
    return oreTotaliPeriodo(wp) * tariffaOraria;
  };

  const generaPreventivo = async (e: FormEvent) => {
    e.preventDefault();
    if (!preventivoModalWp) return;
    setPreventivoError('');
    setPreventivoLoading(true);
    try {
      const wp = preventivoModalWp;
      let prestazioni: { descrizione: string; quantita: number; prezzoUnitario: number; tipo?: string }[] = [];
      const tariffaOraria = calcolaTariffaOraria(wp);

      if (preventivoTipo === 'fisso' || tariffaOraria <= 0) {
        prestazioni = [{
          descrizione: `${wp.task}`,
          quantita: 1,
          prezzoUnitario: wp.costoPrestazione || 0,
        }];
      } else if (preventivoTipo === 'giornaliero') {
        const giorni = (wp.giorniSettimana || []).filter(g => (g.accessiAlGiorno || 0) > 0);
        if (giorni.length === 0) {
          setPreventivoError('Nessun giorno con accessi configurato.');
          setPreventivoLoading(false);
          return;
        }
        prestazioni = giorni.map(g => {
          const occ = contaOccorrenzeGiorno(wp, g.giorno);
          return {
            descrizione: `${wp.task} — ${GIORNI_LABEL[g.giorno] || ''} ${oreGiorno(g)}h × ${occ} accessi`,
            quantita: Math.round(oreGiorno(g) * occ * 100) / 100,
            prezzoUnitario: tariffaOraria,
            tipo: 'orario',
          };
        });
      } else {
        // compenso orario singolo con totale ore su tutto il periodo
        const totale = oreTotaliPeriodo(wp);
        if (totale <= 0) {
          setPreventivoError('Nessuna ora configurata nel periodo.');
          setPreventivoLoading(false);
          return;
        }
        prestazioni = [{
          descrizione: `${wp.task} — ${Math.round(totale * 100) / 100}h nel periodo`,
          quantita: Math.round(totale * 100) / 100,
          prezzoUnitario: tariffaOraria,
          tipo: 'orario',
        }];
      }

      await api.post('/fatturazione-documenti', {
        tipo: 'preventivo',
        patient: wp.patient._id,
        riferimentoTipo: 'workplan',
        riferimentoId: wp._id,
        dataPrestazione: preventivoData || undefined,
        prestazioni,
      });
      alert('Preventivo generato con successo');
      chiudiPreventivoModal();
      await caricaDati();
      await caricaDocumenti();
    } catch (err: any) {
      setPreventivoError(err?.response?.data?.message || 'Errore nella generazione del preventivo');
    }
    setPreventivoLoading(false);
  };

  const generaHTML = (singolo?: RiepilogoPaziente): string => {
    const periodo = dataInizio && dataFine ? `${formatData(dataInizio)} - ${formatData(dataFine)}` : 'Tutto il periodo';
    if (singolo) {
      const righe = singolo.workPlans.map(wp => {
        const compenso = wp.compensoTotale || 0;
        const costo = wp.costoPrestazione || 0;
        return `<tr><td>${formatData(wp.date)}</td><td>${wp.task}</td><td>${wp.staff.firstName} ${wp.staff.lastName}</td><td style="text-align:right">€${compenso.toFixed(2)}</td><td style="text-align:right;font-weight:700">€${costo.toFixed(2)}</td></tr>`;
      }).join('');
      return `<!DOCTYPE html><html><head><style>body{font-family:Arial;margin:24px;font-size:12px}h1{color:#1e4d8c;font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e4d8c;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #e2e8f0}.header{border-bottom:3px solid #1e4d8c;padding-bottom:14px;margin-bottom:20px}.riepilogo{margin-top:20px;background:#f0fdf4;padding:16px;border-radius:8px;display:flex;justify-content:space-around}</style></head><body><div class="header"><h1>🏥 Abbraccio Cure Domiciliari</h1><h2>Fatturazione - ${singolo.patient.firstName} ${singolo.patient.lastName}</h2><div style="color:#666">Periodo: ${periodo}</div></div><table><thead><tr><th>Data</th><th>Prestazione</th><th>Operatore</th><th style="text-align:right">Compenso Op.</th><th style="text-align:right">Fatturato</th></tr></thead><tbody>${righe}</tbody></table><div class="riepilogo"><div><div style="font-size:11px;color:#666">Compenso Operatori</div><div style="font-size:18px;font-weight:800;color:#7c3aed">€${singolo.totaleCompensoOperatori.toFixed(2)}</div></div><div><div style="font-size:11px;color:#666">Totale Fatturato</div><div style="font-size:18px;font-weight:800;color:#166534">€${singolo.totaleFatturato.toFixed(2)}</div></div><div><div style="font-size:11px;color:#666">Utile</div><div style="font-size:18px;font-weight:800;color:${singolo.totaleUtile >= 0 ? '#166534' : '#dc2626'}">€${singolo.totaleUtile.toFixed(2)}</div></div></div></body></html>`;
    }
    const righe = riepiloghiPerPaziente.map((r, i) => `<tr><td>${i+1}</td><td><strong>${r.patient.firstName} ${r.patient.lastName}</strong></td><td style="text-align:center">${r.numeroPrestazioni}</td><td style="text-align:right">€${r.totaleCompensoOperatori.toFixed(2)}</td><td style="text-align:right;font-weight:600;color:#166534">€${r.totaleFatturato.toFixed(2)}</td><td style="text-align:right;font-weight:700;color:${r.totaleUtile >= 0 ? '#166534' : '#dc2626'}">€${r.totaleUtile.toFixed(2)}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;margin:24px;font-size:12px}h1{color:#1e4d8c;font-size:22px}.header{border-bottom:3px solid #1e4d8c;padding-bottom:14px;margin-bottom:20px}.periodo{background:#f1f5f9;padding:8px 12px;border-radius:6px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e4d8c;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #e2e8f0}.totali{margin-top:20px;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);padding:20px;border-radius:10px;border:2px solid #16a34a;display:flex;justify-content:space-around}.totale-box{text-align:center}</style></head><body><div class="header"><h1>📊 Report Fatturazione Generale</h1><div class="periodo">📅 Periodo: ${periodo}</div></div><div class="totali"><div class="totale-box"><div style="font-size:11px;color:#166534;text-transform:uppercase">Totale Fatturato</div><div style="font-size:24px;font-weight:800;color:#166534">€${totaliGenerali.totaleFatturato.toFixed(2)}</div></div><div class="totale-box"><div style="font-size:11px;color:#7c3aed;text-transform:uppercase">Compensi Operatori</div><div style="font-size:24px;font-weight:800;color:#7c3aed">€${totaliGenerali.totaleCompenso.toFixed(2)}</div></div><div class="totale-box"><div style="font-size:11px;color:${totaliGenerali.totaleUtile >= 0 ? '#166534' : '#dc2626'};text-transform:uppercase">Utile Admin</div><div style="font-size:24px;font-weight:800;color:${totaliGenerali.totaleUtile >= 0 ? '#166534' : '#dc2626'}">€${totaliGenerali.totaleUtile.toFixed(2)}</div></div></div><h2 style="margin-top:30px">📋 Dettaglio per Paziente (${totaliGenerali.numeroPazienti})</h2><table><thead><tr><th style="width:40px">#</th><th>Paziente</th><th style="text-align:center;width:80px">Prestaz.</th><th style="text-align:right">Compenso Op.</th><th style="text-align:right">Fatturato</th><th style="text-align:right">Utile</th></tr></thead><tbody>${righe}</tbody></table></body></html>`;
  };

  const visualizzaPDF = (singolo?: RiepilogoPaziente) => {
    const html = generaHTML(singolo);
    const win = window.open('', '_blank');
    if (!win) { alert('Impossibile aprire la finestra.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const stampaPDF = (singolo?: RiepilogoPaziente) => {
    const html = generaHTML(singolo);
    const win = window.open('', '_blank');
    if (!win) { alert('Impossibile aprire la finestra.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const stampaRiepilogoAsl = () => {
    const periodo = dataInizio && dataFine ? `${formatData(dataInizio)} - ${formatData(dataFine)}` : 'Tutto il periodo';
    const righe = pianiConvenzione.map(wp => `<tr><td>${formatData(wp.date)}</td><td>${wp.patient.firstName} ${wp.patient.lastName}</td><td>${wp.task}</td><td>${wp.staff.firstName} ${wp.staff.lastName}</td><td>${wp.patient.siat?.asl || ''}</td><td style="text-align:right;font-weight:700;color:#0369a1">€${(wp.tariffaAsl||0).toFixed(2)}</td><td style="text-align:right">€${(wp.compensoTotale||0).toFixed(2)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><style>body{font-family:Arial;margin:24px;font-size:12px}h1{color:#0369a1}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0369a1;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #e2e8f0}.totali{margin-top:20px;background:#eff6ff;padding:16px;border-radius:8px;display:flex;gap:40px}</style></head><body><h1>🏥 Tariffa da Fatturare all'ASL — Convenzione SIAT</h1><div style="color:#666;margin-bottom:16px">Periodo: ${periodo}</div><div class="totali"><div><div style="font-size:11px;color:#0369a1">TOTALE DA FATTURARE ALL'ASL</div><div style="font-size:24px;font-weight:800;color:#0369a1">€${totaliAsl.totale.toFixed(2)}</div></div><div><div style="font-size:11px;color:#7c3aed">COMPENSI OPERATORI</div><div style="font-size:24px;font-weight:800;color:#7c3aed">€${totaliAsl.compenso.toFixed(2)}</div></div><div><div style="font-size:11px;color:#374151">PRESTAZIONI</div><div style="font-size:24px;font-weight:800">${totaliAsl.prestazioni}</div></div></div><table style="margin-top:24px"><thead><tr><th>Data</th><th>Paziente</th><th>Prestazione</th><th>Operatore</th><th>ASL</th><th style="text-align:right">Tariffa ASL</th><th style="text-align:right">Comp. Op.</th></tr></thead><tbody>${righe}</tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <section className="fade-in section-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: isConvenzione ? '#0369a1' : '#1e4d8c' }}>
          {archivioOnly ? <Archive size={28} /> : (isConvenzione ? <Building2 size={28} /> : <Receipt size={28} />)}
          {archivioOnly ? 'Archivio Fatture' : (isConvenzione ? 'Tariffa da Fatturare all\u2019ASL' : 'Fatturazione Pazienti Privati')}
        </h1>
        {!archivioOnly && (
          <div style={{ display: 'flex', gap: '10px' }}>
            {isConvenzione ? (
              <Button variant="primary" onClick={stampaRiepilogoAsl} icon={<Printer size={18} />}>
                Stampa Report ASL
              </Button>
            ) : (
              <>
                <Button variant="primary" onClick={() => visualizzaPDF()} icon={<FileText size={18} />}>
                  Visualizza Report
                </Button>
                <Button variant="secondary" onClick={() => stampaPDF()} icon={<Printer size={18} />}>
                  Stampa Report
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filtri */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        <div onClick={() => setShowFiltri(!showFiltri)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
            <Filter size={20} />Filtri di Ricerca
          </h3>
          {showFiltri ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {showFiltri && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}><Calendar size={14} style={{ display: 'inline' }} /> Data Inizio</label>
              <input type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}><Calendar size={14} style={{ display: 'inline' }} /> Data Fine</label>
              <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}><User size={14} style={{ display: 'inline' }} /> Cerca Paziente</label>
              <input type="text" placeholder="Nome, cognome o CF..." value={ricercaPaziente} onChange={(e) => setRicercaPaziente(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════ VISTA CONVENZIONE ASL ══════════════════════ */}
      {isConvenzione && !loading && (
        <div>
          {/* Totali ASL */}
          {totaliAsl.prestazioni > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'linear-gradient(135deg, #0369a1, #0284c7)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatEuro(totaliAsl.totale)}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>🏛 Totale da fatturare all'ASL</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatEuro(totaliAsl.compenso)}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>👤 Compensi Operatori</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #059669, #047857)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatEuro(totaliAsl.totale - totaliAsl.compenso)}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>📈 Margine</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #475569, #334155)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{totaliAsl.prestazioni}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>🩺 Prestazioni</div>
              </div>
            </div>
          )}

          {/* Riepilogo per ASL */}
          {riepiloghiPerAsl.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
              <Building2 size={48} style={{ color: '#0284c7', marginBottom: '16px', opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 8px', color: '#0369a1' }}>Nessuna tariffa ASL registrata</h3>
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Aggiungi il campo "Tariffa ASL" ai piani di lavoro dei pazienti in convenzione</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {riepiloghiPerAsl.map((r) => {
                const espanso = aslEspansa === r.asl;
                return (
                  <div key={r.asl} style={{ background: 'white', borderRadius: '12px', border: '1px solid #bae6fd', overflow: 'hidden' }}>
                    <div onClick={() => setAslEspansa(espanso ? null : r.asl)} style={{ padding: '20px', background: '#eff6ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369a1' }}>
                          <Building2 size={24} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0369a1' }}>{r.asl}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{r.numeroPrestazioni} prestazioni · {r.numeroPazienti} pazienti</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Tariffa ASL / Compenso Op.</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                            <span style={{ color: '#0369a1' }}>{formatEuro(r.totaleTariffe)}</span>
                            <span style={{ color: '#9ca3af', margin: '0 8px' }}>/</span>
                            <span style={{ color: '#7c3aed' }}>{formatEuro(r.totaleCompensoOperatori)}</span>
                          </div>
                        </div>
                        {espanso ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                    {espanso && (
                      <div style={{ padding: '20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                              <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem' }}>Data</th>
                              <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem' }}>Paziente</th>
                              <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem' }}>Prestazione</th>
                              <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem' }}>Operatore</th>
                              <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.875rem' }}>Tariffa ASL</th>
                              <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.875rem' }}>Comp. Op.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.workPlans.map((wp) => (
                              <tr key={wp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 8px' }}>{formatData(wp.date)}</td>
                                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{wp.patient.firstName} {wp.patient.lastName}</td>
                                <td style={{ padding: '10px 8px' }}>{wp.task}</td>
                                <td style={{ padding: '10px 8px' }}>{wp.staff ? `${wp.staff.firstName} ${wp.staff.lastName}` : '—'}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>{formatEuro(wp.tariffaAsl || 0)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#7c3aed' }}>{formatEuro(wp.compensoTotale || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ VISTA PRIVATI ══════════════════════ */}
      {!isConvenzione && !loading && totaliGenerali.numeroPazienti > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #166534 0%, #14532d 100%)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatEuro(totaliGenerali.totaleFatturato)}</div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>💰 Totale Fatturato</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatEuro(totaliGenerali.totaleCompenso)}</div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>👤 Compensi Operatori</div>
          </div>
          <div style={{ background: totaliGenerali.totaleUtile >= 0 ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatEuro(totaliGenerali.totaleUtile)}</div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>📈 Utile Admin</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{totaliGenerali.numeroPazienti}</div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>🧑‍⚕️ Pazienti</div>
          </div>
        </div>
      )}

      {/* ══════════════════════ DOCUMENTI FISCALI (Preventivi/Fatture) ══════════ */}
      {!isConvenzione && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div onClick={() => setShowDocumenti(!showDocumenti)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
              <FileText size={20} />Documenti Fiscali — Preventivi e Fatture
              <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{documentiAttivi.length}</span>
            </h3>
            {showDocumenti ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {showDocumenti && (
            documentiAttivi.length === 0 ? (
              <p style={{ color: '#9ca3af', marginTop: '14px', marginBottom: 0 }}>Nessun documento attivo. Verranno creati dal Centro Prenotazioni.</p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>N.</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Tipo</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Paziente</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Data doc.</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Data prest.</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Totale</th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>Stato</th>
                      <th style={{ padding: '8px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {documentiAttivi.map(doc => (
                      <tr key={doc._id} style={{ borderBottom: '1px solid #f1f5f9', opacity: doc.stato === 'annullato' ? 0.5 : 1 }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{doc.numero}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, background: doc.tipo === 'preventivo' ? '#fef3c7' : '#dcfce7', color: doc.tipo === 'preventivo' ? '#92400e' : '#166534' }}>
                            {doc.tipo === 'preventivo' ? '📄 Preventivo' : '🧾 Fattura'}
                          </span>
                        </td>
                        <td style={{ padding: '8px' }}>{doc.patient?.firstName} {doc.patient?.lastName}</td>
                        <td style={{ padding: '8px' }}>{formatData(doc.data)}</td>
                        <td style={{ padding: '8px' }}>{doc.dataPrestazione ? formatData(doc.dataPrestazione) : '-'}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{formatEuro(doc.totale)}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {doc.stato === 'annullato' ? '❌ Annullato' : doc.stato === 'firmato' ? `✍️ Firmato${doc.firma?.rifiutoRegistro ? ' (rifiuto)' : ''}` : '✅ Emesso'}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => anteprimaDocumento(doc)} title="Anteprima PDF" style={{ background: '#f0f9ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0ea5e9' }}><Eye size={14} /></button>
                            <button onClick={() => scaricaDocumentoPDF(doc)} title="Scarica PDF" style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}><Download size={14} /></button>
                            {doc.firma?.firmato && (
                              <button onClick={() => scaricaDocumentoFirmato(doc)} title="Scarica PDF firmato" style={{ background: '#dcfce7', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#166534' }}><Download size={14} /></button>
                            )}
                            <button onClick={() => apriInvioEmail(doc)} title="Invia via email" style={{ background: '#f0fdf4', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#16a34a' }}><Mail size={14} /></button>
                            {doc.stato === 'emesso' && !doc.firma?.email && !doc.firma?.token && (
                              <button onClick={() => apriModificaVoci(doc)} title="Modifica voci" style={{ background: '#e0f2fe', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0284c7' }}><Pencil size={14} /></button>
                            )}
                            <button onClick={() => apriModificaNumero(doc)} title="Modifica numero" style={{ background: '#fefce8', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#ca8a04' }}><Pencil size={14} /></button>
                            {doc.tipo === 'preventivo' && (doc.stato === 'emesso' || doc.stato === 'firmato') && (
                              <button onClick={() => convertiInFattura(doc)} title="Genera fattura da questo preventivo" style={{ background: '#dcfce7', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#166534', fontSize: '0.78rem', fontWeight: 600 }}>→ Fattura</button>
                            )}
                            {(doc.stato === 'emesso' || doc.stato === 'firmato') && (
                              <button onClick={() => annullaDocumento(doc)} title="Annulla" style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                            )}
                            {user?.role === 'admin' && (
                              <button onClick={() => eliminaDocumento(doc)} title="Elimina definitivamente" style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* ══════════════════════ PREVENTIVI RIFIUTATI ══════════ */}
      {!isConvenzione && preventiviRifiutati.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #fecaca' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
            🚫 Preventivi rifiutati
            <span style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{preventiviRifiutati.length}</span>
          </h3>
          <div style={{ overflowX: 'auto', marginTop: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #fecaca' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>N.</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Paziente</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Data doc.</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Rifiutato il</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Totale</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Motivazione</th>
                  <th style={{ padding: '8px' }} />
                </tr>
              </thead>
              <tbody>
                {preventiviRifiutati.map(doc => (
                  <tr key={doc._id} style={{ borderBottom: '1px solid #fef2f2' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{doc.numero}</td>
                    <td style={{ padding: '8px' }}>{doc.patient?.firstName} {doc.patient?.lastName}</td>
                    <td style={{ padding: '8px' }}>{formatData(doc.data)}</td>
                    <td style={{ padding: '8px' }}>{doc.rifiutatoIl ? formatData(doc.rifiutatoIl) : '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#b91c1c' }}>{formatEuro(doc.totale)}</td>
                    <td style={{ padding: '8px', maxWidth: '320px' }}>
                      <span style={{ display: 'block', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '6px 10px', fontSize: '0.85rem', color: '#7f1d1d', whiteSpace: 'pre-wrap' }}>
                        {doc.motivazioneRifiuto || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button onClick={() => anteprimaDocumento(doc)} title="Anteprima PDF" style={{ background: '#f0f9ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0ea5e9' }}><Eye size={14} /></button>
                        <button onClick={() => scaricaDocumentoPDF(doc)} title="Scarica PDF" style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}><Download size={14} /></button>
                        {user?.role === 'admin' && (
                          <button onClick={() => eliminaDocumento(doc)} title="Elimina definitivamente" style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════ ARCHIVIO FATTURE FIRMATE ══════════ */}
      {!isConvenzione && archivioFatture.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div onClick={() => setShowArchivio(!showArchivio)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
              <FileText size={20} />Archivio Fatture Firmate
              <span style={{ background: '#f3e8ff', color: '#7e22ce', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{archivioFatture.length}</span>
            </h3>
            {showArchivio ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {showArchivio && (
            <div style={{ overflowX: 'auto', marginTop: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Fattura</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Preventivo collegato</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Paziente</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>Totale</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Data</th>
                    <th style={{ padding: '8px' }} />
                  </tr>
                </thead>
                <tbody>
                  {archivioFatture.map(fattura => {
                    const preventivo = documenti.find(d => d._id === fattura.documentoOrigineId);
                    return (
                      <tr key={fattura._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{fattura.numero}</td>
                        <td style={{ padding: '8px' }}>{preventivo ? preventivo.numero : '-'}</td>
                        <td style={{ padding: '8px' }}>{fattura.patient?.firstName} {fattura.patient?.lastName}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{formatEuro(fattura.totale)}</td>
                        <td style={{ padding: '8px' }}>{formatData(fattura.data)}</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => anteprimaDocumento(fattura)} title="Anteprima fattura" style={{ background: '#f0f9ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0ea5e9' }}><Eye size={14} /></button>
                            <button onClick={() => scaricaDocumentoPDF(fattura)} title="Scarica fattura" style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}><Download size={14} /></button>
                            {fattura.firma?.firmato && (
                              <button onClick={() => scaricaDocumentoFirmato(fattura)} title="Scarica fattura firmata" style={{ background: '#dcfce7', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#166534' }}><Download size={14} /></button>
                            )}
                            {preventivo && (
                              <>
                                <button onClick={() => anteprimaDocumento(preventivo)} title="Anteprima preventivo" style={{ background: '#fefce8', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#ca8a04' }}><Eye size={14} /></button>
                                <button onClick={() => scaricaDocumentoPDF(preventivo)} title="Scarica preventivo" style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#92400e' }}><Download size={14} /></button>
                              </>
                            )}
                            {user?.role === 'admin' && (
                              <button onClick={() => annullaDocumento(fattura)} title="Annulla" style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Lista pazienti PRIVATI */}
      {!isConvenzione && (loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><p>Caricamento...</p></div>
      ) : riepiloghiPerPaziente.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f9fafb', borderRadius: '12px' }}>
          <Receipt size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#4b5563' }}>Nessuna fatturazione trovata</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {riepiloghiPerPaziente.map((r) => {
            const espanso = pazienteEspanso === r.patient._id;
            return (
              <div key={r.patient._id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div onClick={() => setPazienteEspanso(espanso ? null : r.patient._id)} style={{ padding: '20px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e4d8c' }}>
                      <User size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e4d8c' }}>{r.patient.firstName} {r.patient.lastName}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{r.numeroPrestazioni} prestazioni</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Fatturato / Compenso / Utile</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                        <span style={{ color: '#166534' }}>{formatEuro(r.totaleFatturato)}</span>
                        <span style={{ color: '#9ca3af', margin: '0 8px' }}>/</span>
                        <span style={{ color: '#7c3aed' }}>{formatEuro(r.totaleCompensoOperatori)}</span>
                        <span style={{ color: '#9ca3af', margin: '0 8px' }}>/</span>
                        <span style={{ color: r.totaleUtile >= 0 ? '#059669' : '#dc2626' }}>{formatEuro(r.totaleUtile)}</span>
                      </div>
                    </div>
                    {espanso ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
                {espanso && (
                  <div style={{ padding: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem' }}>Data</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem' }}>Prestazione</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem' }}>Operatore</th>
                          <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.875rem' }}>Compenso Op.</th>
                          <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.875rem' }}>Fatturato</th>
                          <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.875rem' }}>Utile</th>
                          <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.875rem' }}>Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.workPlans.map((wp) => {
                          const compenso = wp.compensoTotale || 0;
                          const costo = wp.costoPrestazione || 0;
                          const utile = costo - compenso;
                          return (
                            <tr key={wp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 8px' }}>{formatData(wp.date)}</td>
                              <td style={{ padding: '10px 8px' }}>{wp.task}</td>
                              <td style={{ padding: '10px 8px' }}>{wp.staff ? `${wp.staff.firstName} ${wp.staff.lastName}` : '—'}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#7c3aed' }}>{formatEuro(compenso)}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#166534' }}>{formatEuro(costo)}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: utile >= 0 ? '#059669' : '#dc2626' }}>{formatEuro(utile)}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => apriPreventivoModal(wp)}
                                  title="Genera preventivo"
                                  style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#92400e', fontSize: '0.75rem', fontWeight: 700 }}
                                >
                                  📄 Preventivo
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
                      <Button variant="primary" size="sm" onClick={() => visualizzaPDF(r)} icon={<FileText size={16} />}>
                        Visualizza PDF
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => stampaPDF(r)} icon={<Printer size={16} />}>
                        Stampa PDF
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Modal invio email documento */}
      {emailModalDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 1200 }} onClick={chiudiInvioEmail}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1.1rem', fontWeight: 700 }}>
              Invia {emailModalDoc.tipo === 'fattura' ? 'Fattura' : 'Preventivo'} via email
            </h3>
            <form onSubmit={inviaDocumentoEmail}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Email destinatario</label>
                <input
                  type="email"
                  required
                  value={emailDestinatario}
                  onChange={(e) => setEmailDestinatario(e.target.value)}
                  placeholder="paziente o caregiver"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Nome destinatario (opzionale)</label>
                <input
                  type="text"
                  value={emailNome}
                  onChange={(e) => setEmailNome(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => emailModalDoc && anteprimaDocumento(emailModalDoc)} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#0ea5e9', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Anteprima</button>
                <button type="button" onClick={chiudiInvioEmail} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 600 }}>Annulla</button>
                <button type="submit" disabled={emailSending} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{emailSending ? 'Invio...' : 'Invia'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal modifica numero */}
      {numeroModalDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 1200 }} onClick={chiudiModificaNumero}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1.1rem', fontWeight: 700 }}>
              Modifica numero
            </h3>
            <form onSubmit={salvaNumero}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Numero {numeroModalDoc.tipo === 'fattura' ? 'fattura' : 'preventivo'}</label>
                <input
                  type="text"
                  required
                  value={numeroNuovo}
                  onChange={(e) => setNumeroNuovo(e.target.value)}
                  placeholder="Es. FATT-2026-12345"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px' }}>Puoi usare il numero interno o quello della tua contabilità esterna.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={chiudiModificaNumero} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 600 }}>Annulla</button>
                <button type="submit" disabled={numeroLoading} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#ca8a04', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{numeroLoading ? 'Salvataggio...' : 'Salva'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal rigenerazione preventivo */}
      {preventivoModalWp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 1200 }} onClick={chiudiPreventivoModal}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1.1rem', fontWeight: 700 }}>
              📄 Rigenera preventivo
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#6b7280' }}>
              {preventivoModalWp.patient.firstName} {preventivoModalWp.patient.lastName} — {preventivoModalWp.task}
            </p>
            <form onSubmit={generaPreventivo}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Data prestazione</label>
                <input type="date" value={preventivoData} onChange={e => setPreventivoData(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Modalità di fatturazione</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${preventivoTipo === 'fisso' ? '#1e4d8c' : '#e2e8f0'}`, cursor: 'pointer' }}>
                    <input type="radio" name="preventivoTipo" value="fisso" checked={preventivoTipo === 'fisso'} onChange={() => setPreventivoTipo('fisso')} />
                    <span style={{ fontSize: '0.875rem' }}>Importo fisso: {formatEuro(preventivoModalWp.costoPrestazione || 0)}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${preventivoTipo === 'orario' ? '#1e4d8c' : '#e2e8f0'}`, cursor: 'pointer' }}>
                    <input type="radio" name="preventivoTipo" value="orario" checked={preventivoTipo === 'orario'} onChange={() => setPreventivoTipo('orario')} />
                    <span style={{ fontSize: '0.875rem' }}>Compenso orario: {Math.round(oreTotaliPeriodo(preventivoModalWp) * 100) / 100}h nel periodo × {formatEuro(calcolaTariffaOraria(preventivoModalWp))}/h = {formatEuro(oreTotaliPeriodo(preventivoModalWp) * calcolaTariffaOraria(preventivoModalWp))}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${preventivoTipo === 'giornaliero' ? '#1e4d8c' : '#e2e8f0'}`, cursor: 'pointer' }}>
                    <input type="radio" name="preventivoTipo" value="giornaliero" checked={preventivoTipo === 'giornaliero'} onChange={() => setPreventivoTipo('giornaliero')} />
                    <span style={{ fontSize: '0.875rem' }}>Ore giornaliere</span>
                  </label>
                </div>
              </div>
              {(() => {
                const tot = totalePreventivoSelezionato(preventivoModalWp, preventivoTipo);
                if (tot <= 0) return null;
                const FRANCHIGIA = 129.11;
                const base = Math.max(0, tot - FRANCHIGIA);
                const detrazione = Math.round(base * 0.19 * 100) / 100;
                return (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', fontSize: '0.82rem', color: '#166534', marginBottom: '16px', lineHeight: 1.5 }}>
                    💶 <strong>Detraibile al 19%</strong> in dichiarazione dei redditi: <strong>{formatEuro(detrazione)}</strong> = 19% di {formatEuro(base)} ({formatEuro(tot)} − {formatEuro(FRANCHIGIA)} di franchigia).
                  </div>
                );
              })()}
              {preventivoError && <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '14px' }}>{preventivoError}</div>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={chiudiPreventivoModal} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 600 }}>Annulla</button>
                <button type="submit" disabled={preventivoLoading} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1e4d8c', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{preventivoLoading ? 'Generazione...' : 'Genera preventivo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal modifica voci */}
      {editModalDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 1200 }} onClick={chiudiModificaVoci}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '640px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1.1rem', fontWeight: 700 }}>
              Modifica voci — {editModalDoc.numero}
            </h3>
            <form onSubmit={salvaVoci}>
              <div style={{ marginBottom: '16px' }}>
                {editPrestazioni.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'flex-end' }}>
                    <input type="text" required value={p.descrizione} onChange={e => aggiornaVoce(i, 'descrizione', e.target.value)} placeholder="Descrizione" style={{ flex: 2, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                    <input type="number" min={0.01} step={0.01} required value={p.quantita} onChange={e => aggiornaVoce(i, 'quantita', Number(e.target.value))} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                    <input type="number" min={0} step={0.01} required value={p.prezzoUnitario} onChange={e => aggiornaVoce(i, 'prezzoUnitario', Number(e.target.value))} style={{ width: '100px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                    <button type="button" onClick={() => rimuoviVoce(i)} style={{ padding: '8px 10px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={aggiungiVoce} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 600 }}>+ Aggiungi voce</button>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>Note</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={2} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>Totale: {formatEuro(totaleEdit)}</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={chiudiModificaVoci} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 600 }}>Annulla</button>
                <button type="submit" disabled={editLoading} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1e4d8c', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{editLoading ? 'Salvataggio...' : 'Salva'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  );
}
