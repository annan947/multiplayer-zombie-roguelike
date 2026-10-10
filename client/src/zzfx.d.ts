declare module 'zzfx' {
  export const ZZFX: {
    volume: number;
    audioContext: AudioContext;
    buildSamples: (...p: (number | undefined)[]) => number[];
    playSamples: (
      channels: number[][],
      volume?: number,
      rate?: number,
      pan?: number,
      loop?: boolean,
    ) => AudioBufferSourceNode;
  };
}
