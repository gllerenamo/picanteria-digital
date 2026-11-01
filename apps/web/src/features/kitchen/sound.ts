import { useState } from 'react';

/**
 * Sonido de la cocina (research.md §8): un tono corto con la Web Audio API, sin archivos. El
 * interruptor "Silenciar" se guarda por dispositivo en localStorage.
 */

const MUTED_KEY = 'picanteria.cocina.silenciada';

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window.AudioContext === 'undefined') return null;
  context ??= new window.AudioContext();
  return context;
}

/** Suena un tono de 0,25 s si el navegador lo permite. */
export function playTone(): void {
  const audio = audioContext();
  if (audio?.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.3, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.25);
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Sin almacenamiento, la preferencia dura solo mientras la pantalla esté abierta.
  }
}

/** El navegador bloquea el audio hasta un toque en la página (por ejemplo, tras recargarla). */
function audioBlocked(): boolean {
  return audioContext()?.state === 'suspended';
}

export interface SoundSettings {
  muted: boolean;
  toggleMuted: () => void;
  /** Mostrar "Toca para activar el sonido". */
  blocked: boolean;
  unlock: () => void;
}

export function useSoundSettings(): SoundSettings {
  const [muted, setMuted] = useState(readMuted);
  const [blocked, setBlocked] = useState(audioBlocked);
  return {
    muted,
    toggleMuted: () => {
      writeMuted(!muted);
      setMuted(!muted);
    },
    blocked,
    unlock: () => {
      void audioContext()
        ?.resume()
        .then(() => {
          setBlocked(audioBlocked());
        });
    },
  };
}
