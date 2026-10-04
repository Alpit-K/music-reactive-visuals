// butterchurn 2.6.7 ships no types; only what the engine calls is declared.
declare module 'butterchurn' {
  interface Visualizer {
    connectAudio(node: AudioNode): void;
    loadPreset(preset: object, blendTimeS: number): void;
    setRendererSize(width: number, height: number): void;
    render(): void;
  }
  // The UMD bundle's module.exports is webpack's export object: the API sits on its `default`.
  const butterchurn: { default: { createVisualizer(ctx: AudioContext, canvas: HTMLCanvasElement, opts: { width: number; height: number }): Visualizer } };
  export default butterchurn;
}
declare module 'butterchurn-presets' {
  const presets: { getPresets(): Record<string, object> };
  export default presets;
}
