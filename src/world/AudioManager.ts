export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private natureGain: GainNode | null = null;
  private windNode: AudioBufferSourceNode | null = null;
  private started = false;
  private windFilter: BiquadFilterNode | null = null;
  private windFilter2: BiquadFilterNode | null = null;
  private reverbNode: ConvolverNode | null = null;

  start() {
    if (this.started) return;
    this.started = true;

    try {
      this.audioContext = new AudioContext();
      
      // Master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5;
      
      // Create reverb
      this.reverbNode = this.createReverb();
      const reverbGain = this.audioContext.createGain();
      reverbGain.gain.value = 0.15;
      
      this.masterGain.connect(this.audioContext.destination);
      this.reverbNode.connect(reverbGain);
      reverbGain.connect(this.audioContext.destination);

      // Wind sound - multi-layered
      this.windGain = this.audioContext.createGain();
      this.windGain.gain.value = 0.25;
      
      this.windFilter = this.audioContext.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 600;
      this.windFilter.Q.value = 0.8;
      
      this.windFilter2 = this.audioContext.createBiquadFilter();
      this.windFilter2.type = 'peaking';
      this.windFilter2.frequency.value = 300;
      this.windFilter2.Q.value = 1;
      this.windFilter2.gain.value = 3;
      
      this.windGain.connect(this.windFilter);
      this.windFilter.connect(this.windFilter2);
      this.windFilter2.connect(this.masterGain);
      this.windFilter2.connect(this.reverbNode);

      // Generate layered wind sounds
      this.createWindSound();

      // Nature sounds
      this.natureGain = this.audioContext.createGain();
      this.natureGain.gain.value = 0.12;
      this.natureGain.connect(this.masterGain);
      this.natureGain.connect(this.reverbNode);
      
      this.createNatureSounds();
      
      // Ambient drone
      this.createAmbientDrone();
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }

  private createReverb(): ConvolverNode {
    if (!this.audioContext) throw new Error('No audio context');
    
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 3;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (sampleRate * 0.8));
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    
    const convolver = this.audioContext.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  private createWindSound() {
    if (!this.audioContext || !this.windGain) return;

    // Layer 1: Deep brown noise (base wind)
    const bufferSize = this.audioContext.sampleRate * 5;
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0;
      let lastOut2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Double-filtered brown noise for smoother wind
        lastOut = (lastOut + 0.02 * white) / 1.02;
        lastOut2 = (lastOut2 + 0.01 * lastOut) / 1.01;
        data[i] = lastOut2 * 5;
        
        // Natural gust modulation
        const gust1 = Math.sin(i * 0.0002) * 0.3 + 0.7;
        const gust2 = Math.sin(i * 0.0008 + 1.5) * 0.2 + 0.8;
        const gust3 = Math.sin(i * 0.00005) * 0.4 + 0.6;
        data[i] *= gust1 * gust2 * gust3;
      }
    }

    this.windNode = this.audioContext.createBufferSource();
    this.windNode.buffer = buffer;
    this.windNode.loop = true;
    this.windNode.connect(this.windGain);
    this.windNode.start();

    // Layer 2: Higher frequency whoosh
    const highGain = this.audioContext.createGain();
    highGain.gain.value = 0.06;
    
    const highFilter = this.audioContext.createBiquadFilter();
    highFilter.type = 'bandpass';
    highFilter.frequency.value = 1800;
    highFilter.Q.value = 0.4;
    
    highGain.connect(highFilter);
    highFilter.connect(this.masterGain!);

    const highBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const highData = highBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      highData[i] = (Math.random() * 2 - 1) * 0.4;
      // Whooshing modulation
      highData[i] *= 0.3 + 0.7 * Math.pow(Math.sin(i * 0.0003), 2);
      highData[i] *= 0.5 + 0.5 * Math.sin(i * 0.00007);
    }

    const highNode: AudioBufferSourceNode = this.audioContext.createBufferSource();
    highNode.buffer = highBuffer;
    highNode.loop = true;
    highNode.connect(highGain);
    highNode.start();

    // Layer 3: Leaf rustle
    const rustleGain = this.audioContext.createGain();
    rustleGain.gain.value = 0.03;
    
    const rustleFilter = this.audioContext.createBiquadFilter();
    rustleFilter.type = 'highpass';
    rustleFilter.frequency.value = 3000;
    
    rustleGain.connect(rustleFilter);
    rustleFilter.connect(this.masterGain!);

    const rustleBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const rustleData = rustleBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Intermittent rustling
      const burst = Math.sin(i * 0.001) > 0.7 ? 1 : 0;
      rustleData[i] = (Math.random() * 2 - 1) * 0.3 * burst;
    }

    const rustleNode: AudioBufferSourceNode = this.audioContext.createBufferSource();
    rustleNode.buffer = rustleBuffer;
    rustleNode.loop = true;
    rustleNode.connect(rustleGain);
    rustleNode.start();
  }

  private createNatureSounds() {
    if (!this.audioContext || !this.natureGain) return;

    // Bird chirps with more variety
    const scheduleBird = () => {
      if (!this.audioContext || !this.natureGain) return;
      const delay = 3 + Math.random() * 10;
      setTimeout(() => {
        this.playBirdChirp();
        scheduleBird();
      }, delay * 1000);
    };
    scheduleBird();

    // Water ambience
    this.createWaterAmbience();
    
    // Occasional distant bird call
    const scheduleDistantBird = () => {
      if (!this.audioContext || !this.natureGain) return;
      const delay = 15 + Math.random() * 30;
      setTimeout(() => {
        this.playDistantCall();
        scheduleDistantBird();
      }, delay * 1000);
    };
    scheduleDistantBird();
  }

  private playBirdChirp() {
    if (!this.audioContext || !this.natureGain) return;

    const now = this.audioContext.currentTime;
    const numNotes = 2 + Math.floor(Math.random() * 4);
    
    for (let n = 0; n < numNotes; n++) {
      const noteTime = now + n * (0.08 + Math.random() * 0.12);
      
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      filter.type = 'bandpass';
      const baseFreq = 2000 + Math.random() * 4000;
      filter.frequency.value = baseFreq;
      filter.Q.value = 8;

      osc.type = 'sine';
      const freq = baseFreq * (0.8 + Math.random() * 0.6);
      osc.frequency.setValueAtTime(freq, noteTime);
      osc.frequency.exponentialRampToValueAtTime(freq * (1 + Math.random() * 0.5), noteTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, noteTime + 0.12);

      const vol = 0.04 + Math.random() * 0.04;
      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(vol, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.natureGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    }
  }

  private playDistantCall() {
    if (!this.audioContext || !this.natureGain) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    filter.Q.value = 2;

    osc.type = 'sine';
    const baseFreq = 600 + Math.random() * 400;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.7, now + 0.8);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.9, now + 1.2);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.02, now + 0.1);
    gain.gain.linearRampToValueAtTime(0.015, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.natureGain);

    osc.start(now);
    osc.stop(now + 1.6);
  }

  private createWaterAmbience() {
    if (!this.audioContext || !this.natureGain) return;

    const bufferSize = this.audioContext.sampleRate * 4;
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.08 * white) / 1.08;
        data[i] = lastOut * 2.5;
        // Gentle lapping rhythm
        data[i] *= 0.4 + 0.6 * Math.pow(Math.sin(i * 0.0004 + ch), 2);
      }
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.06;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.natureGain);
    source.start();
  }

  private createAmbientDrone() {
    if (!this.audioContext || !this.masterGain) return;

    // Very subtle ambient pad
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.value = 80;
    osc2.type = 'sine';
    osc2.frequency.value = 120;

    filter.type = 'lowpass';
    filter.frequency.value = 200;

    gain.gain.value = 0.02;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();

    // Slowly modulate
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 0.01;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
  }

  update(windStrength: number) {
    if (!this.audioContext || !this.windGain || !this.windFilter) return;

    const now = this.audioContext.currentTime;
    
    // Modulate wind volume
    const targetGain = 0.15 + windStrength * 0.35;
    this.windGain.gain.linearRampToValueAtTime(targetGain, now + 0.2);

    // Modulate filter frequency
    const targetFreq = 300 + windStrength * 600;
    this.windFilter.frequency.linearRampToValueAtTime(targetFreq, now + 0.2);
  }

  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
