/**
 * ElevenLabs TTS Integration — high-quality natural voice synthesis.
 * Uses the ElevenLabs REST API directly (no SDK) to keep the browser bundle lean.
 * Falls back to browser SpeechSynthesisUtterance if no API key is configured.
 */

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

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

export class ElevenLabsTTS {
  private apiKey: string;
  public enabled: boolean = false;
  public selectedVoice: string = '21m00Tcm4TlvDq8ikWAM'; // Rachel

  constructor(apiKey?: string) {
    this.apiKey = apiKey || (typeof process !== 'undefined' ? process.env.ELEVENLABS_API_KEY || '' : '');
    if (!this.apiKey) {
      console.info('[ElevenLabs] No API key configured, falling back to browser TTS');
      this.enabled = false;
      return;
    }
    this.enabled = true;
    console.info('[ElevenLabs] TTS initialized successfully');
  }

  /**
   * Synthesize speech to an audio blob URL via the ElevenLabs REST API.
   * Returns null if ElevenLabs is not available (caller should fall back to browser TTS).
   */
  async speak(text: string, voiceId?: string): Promise<string | null> {
    if (!this.enabled || !this.apiKey) return null;

    try {
      const cleanText = text
        .replace(/<[^>]*>?/gm, '')     // Remove HTML tags
        .replace(/[*_#`]/g, '')         // Remove markdown formatting
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Replace links with text

      const response = await fetch(
        `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId || this.selectedVoice}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('[ElevenLabs] TTS error, falling back to browser', e);
      return null;
    }
  }

  setVoice(voiceId: string) {
    this.selectedVoice = voiceId;
    try { localStorage.setItem('elevenlabs_voice', voiceId); } catch (e) {}
  }

  static loadVoicePreference(): string {
    try { return localStorage.getItem('elevenlabs_voice') || '21m00Tcm4TlvDq8ikWAM'; }
    catch (e) { return '21m00Tcm4TlvDq8ikWAM'; }
  }
}
