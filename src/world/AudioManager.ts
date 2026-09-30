export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private natureGain: GainNode | null = null;
  private windNode: AudioBufferSourceNode | null = null;
  private started = false;
  private windFilter: BiquadFilterNode | null = null;

  start() {
    if (this.started) return;
    this.started = true;

    try {
      this.audioContext = new AudioContext();
      
      // Master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.audioContext.destination);

      // Wind sound
      this.windGain = this.audioContext.createGain();
      this.windGain.gain.value = 0.3;
      
      this.windFilter = this.audioContext.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 800;
      this.windFilter.Q.value = 1;
      
      this.windGain.connect(this.windFilter);
      this.windFilter.connect(this.masterGain);

      // Generate wind noise
      this.createWindSound();

      // Nature sounds (birds, crickets)
      this.natureGain = this.audioContext.createGain();
      this.natureGain.gain.value = 0.15;
      this.natureGain.connect(this.masterGain);
      
      this.createNatureSounds();
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }

  private createWindSound() {
    if (!this.audioContext || !this.windGain) return;

    const bufferSize = this.audioContext.sampleRate * 4;
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    // Brown noise for wind (more natural than white noise)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise approximation
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
        
        // Add some variation for gusts
        const gustFreq = 0.001 + Math.random() * 0.0005;
        data[i] *= 0.7 + 0.3 * Math.sin(i * gustFreq);
      }
    }

    this.windNode = this.audioContext.createBufferSource();
    this.windNode.buffer = buffer;
    this.windNode.loop = true;
    
    // Add a second layer with different characteristics
    const highWindGain = this.audioContext.createGain();
    highWindGain.gain.value = 0.1;
    
    const highFilter = this.audioContext.createBiquadFilter();
    highFilter.type = 'bandpass';
    highFilter.frequency.value = 2000;
    highFilter.Q.value = 0.5;
    
    highWindGain.connect(highFilter);
    highFilter.connect(this.masterGain!);

    const highBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const highData = highBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      highData[i] = (Math.random() * 2 - 1) * 0.5;
      // Modulate for whooshing effect
      highData[i] *= 0.5 + 0.5 * Math.sin(i * 0.0003);
    }

    const highNode: AudioBufferSourceNode = this.audioContext.createBufferSource();
    highNode.buffer = highBuffer;
    highNode.loop = true;
    highNode.connect(highWindGain);
    highNode.start();

    this.windNode.connect(this.windGain);
    this.windNode.start();
  }

  private createNatureSounds() {
    if (!this.audioContext || !this.natureGain) return;

    // Periodic bird chirps
    const scheduleBird = () => {
      if (!this.audioContext || !this.natureGain) return;
      
      const delay = 2 + Math.random() * 8;
      setTimeout(() => {
        this.playBirdChirp();
        scheduleBird();
      }, delay * 1000);
    };
    scheduleBird();

    // Subtle water ambience
    this.createWaterAmbience();
  }

  private playBirdChirp() {
    if (!this.audioContext || !this.natureGain) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.value = 2000 + Math.random() * 3000;
    filter.Q.value = 5;

    osc.type = 'sine';
    const baseFreq = 1500 + Math.random() * 2000;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.15);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.natureGain);

    osc.start(now);
    osc.stop(now + 0.3);

    // Sometimes do a double chirp
    if (Math.random() > 0.5) {
      const osc2 = this.audioContext.createOscillator();
      const gain2 = this.audioContext.createGain();
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 1.2, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.2);
      
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.17);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc2.connect(filter);
      filter.connect(gain2);
      gain2.connect(this.natureGain);

      osc2.start(now + 0.15);
      osc2.stop(now + 0.4);
    }
  }

  private createWaterAmbience() {
    if (!this.audioContext || !this.natureGain) return;

    const bufferSize = this.audioContext.sampleRate * 3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Gentle water-like noise
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.1 * white) / 1.1;
      data[i] = lastOut * 2;
      // Add gentle lapping rhythm
      data[i] *= 0.5 + 0.5 * Math.sin(i * 0.0005);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.08;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.natureGain);
    source.start();
  }

  update(windStrength: number) {
    if (!this.windGain || !this.windFilter || !this.audioContext) return;

    // Modulate wind volume and filter based on wind strength
    const targetGain = 0.2 + windStrength * 0.4;
    this.windGain.gain.linearRampToValueAtTime(
      targetGain,
      this.audioContext.currentTime + 0.1
    );

    const targetFreq = 400 + windStrength * 800;
    this.windFilter.frequency.linearRampToValueAtTime(
      targetFreq,
      this.audioContext.currentTime + 0.1
    );
  }

  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
