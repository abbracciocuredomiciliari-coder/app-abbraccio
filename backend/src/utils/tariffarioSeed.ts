export interface VoceTariffarioSeed {
  categoria: 'prestazioni_infermieristiche' | 'assistenza_trasporto' | 'radiologia' | 'ecografia';
  nome: string;
  prezzo: number;
  unitaMisura?: string;
  note?: string;
  ordine: number;
}

// Listino prezzi di default — importato dal tariffario cartaceo fornito.
export const TARIFFARIO_SEED: VoceTariffarioSeed[] = [
  // ─── Prestazioni Infermieristiche ─────────────────────────────────────────
  { categoria: 'prestazioni_infermieristiche', nome: 'Valutazione infermieristica', prezzo: 50, ordine: 1 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Rilevazione parametri vitali', prezzo: 30, ordine: 2 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Iniezione sottocutanee/intramuscolo', prezzo: 25, ordine: 3 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Perfusione / gestione a termine', prezzo: 50, note: 'Accessi successivi € 20,00', ordine: 4 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Perfusione in bolo con prescrizione', prezzo: 45, ordine: 5 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Vaccinazioni con prescrizione', prezzo: 25, ordine: 6 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Posizionamento/sostituzione catetere vescicale', prezzo: 50, note: '+ materiale', ordine: 7 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Irrigazioni o instillazione vescicali', prezzo: 50, ordine: 8 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Posizionamento sondino naso gastrico (SNG)', prezzo: 60, ordine: 9 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Medicazioni', prezzo: 50, note: '+ materiale', ordine: 10 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Medicazione PEG/SNG', prezzo: 50, note: '+ materiale', ordine: 11 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Bruciatura granuloma PEG con matita', prezzo: 50, note: '+ materiale', ordine: 12 },
  { categoria: 'prestazioni_infermieristiche', nome: "Addestramento all'uso di presidi per alimentazione (nutripompa)", prezzo: 50, ordine: 13 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Clistere evacuativo con Sobiclis', prezzo: 50, note: '+ materiale', ordine: 14 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Clistere ad alta pressione', prezzo: 60, note: '+ materiale', ordine: 15 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Estrazione fecalomi', prezzo: 50, ordine: 16 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Gestione stomie/nefrostomie', prezzo: 50, ordine: 17 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Medicazione PICC/Midline/CVC', prezzo: 50, note: '+ materiale', ordine: 18 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Aspirazione secrezioni', prezzo: 50, ordine: 19 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Prelievo ematico ed esame urine (consegnato)', prezzo: 25, ordine: 20 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Raccolta urine sterile con cateterismo estemporaneo', prezzo: 25, ordine: 21 },
  { categoria: 'prestazioni_infermieristiche', nome: 'ECG', prezzo: 60, ordine: 22 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Holter cardiaco', prezzo: 120, ordine: 23 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Holter pressorio', prezzo: 120, ordine: 24 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Spirometria', prezzo: 100, ordine: 25 },
  { categoria: 'prestazioni_infermieristiche', nome: 'Polisonnigrafo', prezzo: 180, ordine: 26 },

  // ─── Assistenza e Trasporto ────────────────────────────────────────────────
  { categoria: 'assistenza_trasporto', nome: 'Ambulanza percorso urbano andata', prezzo: 150, note: 'Tratta urbana', ordine: 1 },
  { categoria: 'assistenza_trasporto', nome: 'Ambulanza andata e ritorno', prezzo: 280, ordine: 2 },
  { categoria: 'assistenza_trasporto', nome: 'Extraurbano', prezzo: 1, unitaMisura: 'a km', ordine: 3 },
  { categoria: 'assistenza_trasporto', nome: 'Urgenza (in 2h)', prezzo: 50, ordine: 4 },
  { categoria: 'assistenza_trasporto', nome: 'Bagno a letto', prezzo: 45, ordine: 5 },
  { categoria: 'assistenza_trasporto', nome: 'Assistenza OSS', prezzo: 23, unitaMisura: 'ora', ordine: 6 },
  { categoria: 'assistenza_trasporto', nome: 'Assistenza notturna (notte h21–h07)', prezzo: 25, unitaMisura: 'ora', note: 'Intera notte forfait € 200,00', ordine: 7 },
  { categoria: 'assistenza_trasporto', nome: 'Assistenza infermieristica', prezzo: 35, unitaMisura: 'ora', ordine: 8 },
  { categoria: 'assistenza_trasporto', nome: 'Assistenza infermieristica notturna (h21–h07)', prezzo: 40, unitaMisura: 'ora', note: 'Intera notte forfait € 250,00', ordine: 9 },

  // ─── Radiologia (RX) ────────────────────────────────────────────────────────
  { categoria: 'radiologia', nome: 'RX cranio e seni paranasali', prezzo: 160, unitaMisura: '1 tratto', ordine: 1 },
  { categoria: 'radiologia', nome: 'RX cervicale', prezzo: 160, unitaMisura: '1 tratto', ordine: 2 },
  { categoria: 'radiologia', nome: 'RX dorsale', prezzo: 160, unitaMisura: '1 tratto', ordine: 3 },
  { categoria: 'radiologia', nome: 'RX lombare', prezzo: 160, unitaMisura: '1 tratto', ordine: 4 },
  { categoria: 'radiologia', nome: 'RX bacino', prezzo: 160, unitaMisura: '1 tratto', ordine: 5 },
  { categoria: 'radiologia', nome: 'RX bacino sotto carico', prezzo: 160, unitaMisura: '1 tratto', ordine: 6 },
  { categoria: 'radiologia', nome: 'RX torace', prezzo: 160, unitaMisura: '1 tratto', ordine: 7 },
  { categoria: 'radiologia', nome: 'RX emitorace', prezzo: 160, unitaMisura: '1 tratto', ordine: 8 },
  { categoria: 'radiologia', nome: 'RX addome', prezzo: 160, unitaMisura: '1 tratto', ordine: 9 },
  { categoria: 'radiologia', nome: 'RX spalla', prezzo: 160, unitaMisura: '1 tratto', ordine: 10 },
  { categoria: 'radiologia', nome: 'RX omero', prezzo: 160, unitaMisura: '1 tratto', ordine: 11 },
  { categoria: 'radiologia', nome: 'RX gomito', prezzo: 160, unitaMisura: '1 tratto', ordine: 12 },
  { categoria: 'radiologia', nome: 'RX avambraccio', prezzo: 160, unitaMisura: '1 tratto', ordine: 13 },
  { categoria: 'radiologia', nome: 'RX polso', prezzo: 160, unitaMisura: '1 tratto', ordine: 14 },
  { categoria: 'radiologia', nome: 'RX mano', prezzo: 160, unitaMisura: '1 tratto', ordine: 15 },
  { categoria: 'radiologia', nome: 'RX anca', prezzo: 160, unitaMisura: '1 tratto', ordine: 16 },
  { categoria: 'radiologia', nome: 'RX femore', prezzo: 160, unitaMisura: '1 tratto', ordine: 17 },
  { categoria: 'radiologia', nome: 'RX ginocchio', prezzo: 160, unitaMisura: '1 tratto', ordine: 18 },
  { categoria: 'radiologia', nome: 'RX ginocchia sotto carico', prezzo: 160, unitaMisura: '1 tratto', ordine: 19 },
  { categoria: 'radiologia', nome: 'RX rotula', prezzo: 160, unitaMisura: '1 tratto', ordine: 20 },
  { categoria: 'radiologia', nome: 'RX gamba', prezzo: 160, unitaMisura: '1 tratto', ordine: 21 },
  { categoria: 'radiologia', nome: 'RX caviglia', prezzo: 130, unitaMisura: '1 tratto', ordine: 22 },
  { categoria: 'radiologia', nome: 'RX piede', prezzo: 160, unitaMisura: '1 tratto', ordine: 23 },
  { categoria: 'radiologia', nome: "RX studio età ossea", prezzo: 160, ordine: 24 },

  // ─── Ecografie / Ecocolordoppler ───────────────────────────────────────────
  { categoria: 'ecografia', nome: 'Ecografia addome completo', prezzo: 210, ordine: 1 },
  { categoria: 'ecografia', nome: 'Ecografia fegato e vie biliari', prezzo: 190, unitaMisura: '1 organo', ordine: 2 },
  { categoria: 'ecografia', nome: 'Ecografia pancreas', prezzo: 190, unitaMisura: '1 organo', ordine: 3 },
  { categoria: 'ecografia', nome: 'Ecografia milza', prezzo: 190, unitaMisura: '1 organo', ordine: 4 },
  { categoria: 'ecografia', nome: 'Ecografia reni e surreni', prezzo: 190, unitaMisura: '1 organo', ordine: 5 },
  { categoria: 'ecografia', nome: 'Ecografia tiroide', prezzo: 190, unitaMisura: '1 organo', ordine: 6 },
  { categoria: 'ecografia', nome: 'Ecografia ghiandole salivari', prezzo: 190, unitaMisura: '1 organo', ordine: 7 },
  { categoria: 'ecografia', nome: 'Ecografia muscolo scheletrica', prezzo: 190, unitaMisura: '1 organo', ordine: 8 },
  { categoria: 'ecografia', nome: 'Ecografia scrotale', prezzo: 190, unitaMisura: '1 organo', ordine: 9 },
  { categoria: 'ecografia', nome: 'Ecografia prostata sovrapubica', prezzo: 190, unitaMisura: '1 organo', ordine: 10 },
  { categoria: 'ecografia', nome: 'Ecografia pelvica', prezzo: 190, unitaMisura: '1 organo', note: 'Maggiorazione € 30 per ogni tratto aggiuntivo richiesto contestualmente', ordine: 11 },
  { categoria: 'ecografia', nome: 'Ecocolordoppler TSA', prezzo: 190, unitaMisura: '1 organo', ordine: 12 },
  { categoria: 'ecografia', nome: 'Ecocolordoppler aorta addominale', prezzo: 190, unitaMisura: '1 organo', ordine: 13 },
  { categoria: 'ecografia', nome: 'Ecocolordoppler arti inferiori arterioso', prezzo: 190, unitaMisura: '1 organo', ordine: 14 },
  { categoria: 'ecografia', nome: 'Ecocolordoppler arti inferiori venoso', prezzo: 190, unitaMisura: '1 organo', ordine: 15 },
  { categoria: 'ecografia', nome: 'Ecocolordoppler arti inferiori arterioso e venoso', prezzo: 230, unitaMisura: '2 organi', ordine: 16 },
  { categoria: 'ecografia', nome: 'Ecocolordoppler fegato', prezzo: 210, unitaMisura: '1 organo', ordine: 17 },
  { categoria: 'ecografia', nome: 'Ecocolordoppler renale', prezzo: 210, unitaMisura: '1 organo', ordine: 18 },
  { categoria: 'ecografia', nome: 'Ecocolordoppler tiroide', prezzo: 210, unitaMisura: '1 organo', ordine: 19 },
];
