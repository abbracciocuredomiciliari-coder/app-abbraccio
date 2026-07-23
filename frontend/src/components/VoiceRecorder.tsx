import { useRef, useState, useCallback } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui';
import api from '../api/api';

interface VoiceRecorderProps {
  workPlanId: string;
  onResult: (data: {
    testo: string;
    parametriVitali?: Record<string, number>;
    scaleValutazione?: Record<string, number>;
    terapiaFarmacologica?: Array<{
      farmaco: string;
      dosaggio: string;
      mattina?: boolean;
      pomeriggio?: boolean;
      sera?: boolean;
      notte?: boolean;
    }>;
  }) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ workPlanId, onResult, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        await sendAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.onerror = () => {
        setError('Errore durante la registrazione audio');
        stopTimer();
        setIsRecording(false);
      };

      recorder.start(200);
      setIsRecording(true);
      startTimer();
    } catch (err: any) {
      console.error('[VoiceRecorder] Errore avvio:', err);
      setError(err.name === 'NotAllowedError'
        ? 'Permesso microfono negato. Abilita il microfono nelle impostazioni del browser.'
        : 'Impossibile avviare il microfono.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await api.post(`/diario/${workPlanId}/voice`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });

      onResult({
        testo: response.data.extracted?.testo || response.data.entry?.testo || '',
        parametriVitali: response.data.extracted?.parametriVitali,
        scaleValutazione: response.data.extracted?.scaleValutazione,
        terapiaFarmacologica: response.data.extracted?.terapiaFarmacologica,
      });
    } catch (err: any) {
      console.error('[VoiceRecorder] Errore invio:', err);
      const msg = err.response?.data?.message || err.message || 'Errore sconosciuto';
      setError(`Errore elaborazione audio: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {!isRecording ? (
          <Button
            type="button"
            onClick={startRecording}
            disabled={disabled || isProcessing}
            variant="primary"
            icon={<Mic size={18} />}
          >
            {isProcessing ? 'Elaborazione...' : 'Dettatura vocale'}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={stopRecording}
            variant="danger"
            icon={<Square size={18} />}
          >
            Ferma ({formatTime(seconds)})
          </Button>
        )}

        {isProcessing && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#0d9488' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Trascrizione in corso...
          </span>
        )}
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px', borderRadius: '6px',
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
          fontSize: '0.85rem'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}
    </div>
  );
}
