/**
 * ElevenLabs TTS Integration — high-quality natural voice synthesis.
 * Falls back to browser SpeechSynthesisUtterance if no API key is configured.
 */
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export interface VoiceOption {
  id: string;
  name: string;
  description?: string;
}

// Curated default voices available on ElevenLabs
export const DEFAULT_VOICES: VoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, conversational' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong, warm' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Soft, friendly' },
  { id: 'ErXwobaYiN0zPZRPgfh4', name: 'Adam', description: 'Deep, authoritative' },
  { id: 'MF3mGyOyZMPLqVo6Y0Qk', name: 'Michael', description: 'Casual, natural' },
  { id: 'pNInz6obbgDjOH6Yj5b6', name: 'Gigi', description: 'Young, expressive' },
];

export class ElevenLabsTTS {
  private client: ElevenLabsClient | null = null;
  private apiKey: string;
  public enabled: boolean = false;
  public selectedVoice: string = '21m00Tcm4TlvDq8ikWAM'; // Rachel

  constructor(apiKey?: string) {
    this.apiKey = apiKey || (typeof process !== 'undefined' ? process.env.ELEVENLABS_API_KEY || '' : '');
    this.init();
  }

  private init() {
    if (!this.apiKey) {
      console.info('[ElevenLabs] No API key configured, falling back to browser TTS');
      this.enabled = false;
      return;
    }
    try {
      this.client = new ElevenLabsClient({ apiKey: this.apiKey });
      this.enabled = true;
      console.info('[ElevenLabs] TTS initialized successfully');
    } catch (e) {
      console.warn('[ElevenLabs] Failed to initialize, using browser TTS', e);
      this.enabled = false;
    }
  }

  /**
   * Synthesize speech to an audio blob URL.
   * Returns null if ElevenLabs is not available (caller should fall back to browser TTS).
   */
  async speak(text: string, voiceId?: string): Promise<string | null> {
    if (!this.enabled || !this.client) return null;

    try {
      const cleanText = text
        .replace(/<[^>]*>?/gm, '')     // Remove HTML tags
        .replace(/[*_#`]/g, '')         // Remove markdown formatting
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Replace links with text

      const audio = await this.client.textToSpeech.convert(voiceId || this.selectedVoice, {
        text: cleanText,
        modelId: 'eleven_turbo_v2_5',
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.0,
          useSpeakerBoost: true,
        },
      });

      // Collect the stream into a blob
      const chunks: ArrayBuffer[] = [];
      for await (const chunk of audio) {
        chunks.push(chunk instanceof ArrayBuffer ? chunk : chunk.buffer instanceof ArrayBuffer ? chunk.buffer : new Uint8Array(chunk as any).buffer as ArrayBuffer);
      }
      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('[ElevenLabs] TTS error, falling back to browser', e);
      return null;
    }
  }

  setVoice(voiceId: string) {
    this.selectedVoice = voiceId;
    localStorage.setItem('elevenlabs_voice', voiceId);
  }

  static loadVoicePreference(): string {
    return localStorage.getItem('elevenlabs_voice') || '21m00Tcm4TlvDq8ikWAM';
  }
}
