export class AmbientSynthesizer {
  private ctx: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private masterGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private isPlaying = false;
  
  private baseFreq = 110; // A2
  
  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(this.ctx.destination);
    
    // Create base oscillators for a chord
    const ratios = [1, 1.25, 1.5, 2.0]; // Major 7th chord approximation
    
    ratios.forEach((ratio, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = this.baseFreq * ratio;
      
      // Pan left/right for binaural effect
      const panner = this.ctx!.createStereoPanner();
      panner.pan.value = (i % 2 === 0 ? -1 : 1) * 0.5;
      
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain!);
      
      gain.gain.value = 0; // Starts silent
      
      this.oscillators.push(osc);
      this.gainNodes.push(gain);
    });
    
    // LFO for tempo/pulsing
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.1; // 0.1 Hz (slow)
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.2;
    this.lfo.connect(lfoGain);
    
    this.gainNodes.forEach(g => {
      lfoGain.connect(g.gain);
    });
    
    this.oscillators.forEach(o => o.start());
    this.lfo.start();
  }

  public start() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.isPlaying && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.15, this.ctx!.currentTime, 2);
      this.isPlaying = true;
    }
  }

  public stop() {
    if (this.isPlaying && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 2);
      this.isPlaying = false;
    }
  }

  /**
   * Modulate the synth based on affective state and system health
   * @param anomalyScore 0.0 (perfect) to 1.0 (chaos/anomaly)
   * @param convergence 0.0 (chaos) to 1.0 (converged/stable)
   */
  public modulate(anomalyScore: number, convergence: number) {
    if (!this.ctx || !this.isPlaying) return;
    
    const now = this.ctx.currentTime;
    
    // 1. If converged -> deep alpha wave (binaural beat ~10Hz diff, base ~85Hz)
    // 2. If anomaly -> dissonant chords, higher freq
    
    const targetBase = 85 + (anomalyScore * 150); // Shifts base freq up during high anomaly
    this.baseFreq = targetBase;
    
    // Ratios transition from consonant (major/perfect) to dissonant
    const consonant = [1, 1.25, 1.5, 2.0];
    const dissonant = [1, 1.15, 1.45, 2.1]; 
    
    this.oscillators.forEach((osc, i) => {
      const currentRatio = consonant[i] * (1 - anomalyScore) + dissonant[i] * anomalyScore;
      
      // If highly converged, make it a binaural beat (slight freq offset)
      let freq = this.baseFreq * currentRatio;
      if (convergence > 0.8 && i === 1) {
         // Create alpha wave binaural beat (~8-12Hz difference)
         freq = (this.baseFreq * consonant[0]) + 10;
      }
      
      osc.frequency.setTargetAtTime(freq, now, 1.0);
    });
    
    // Tempo increases with anomaly
    if (this.lfo) {
      const targetLfoRate = 0.1 + (anomalyScore * 4.0); // 0.1Hz to 4.1Hz
      this.lfo.frequency.setTargetAtTime(targetLfoRate, now, 1.0);
    }
  }
}

export const ambientSynth = new AmbientSynthesizer();
