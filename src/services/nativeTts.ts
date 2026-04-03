const isNative =
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform &&
  (window as any).Capacitor.isNativePlatform();

let nativeTtsPlugin: any | null | undefined;

const loadNativeTtsPlugin = async () => {
  if (nativeTtsPlugin !== undefined) return nativeTtsPlugin;
  if (!isNative) {
    nativeTtsPlugin = null;
    return nativeTtsPlugin;
  }

  try {
    const pluginModuleName = '@capacitor-community/text-to-speech';
    const mod: any = await import(/* @vite-ignore */ pluginModuleName);
    nativeTtsPlugin = mod?.TextToSpeech || mod?.default?.TextToSpeech || mod?.default || null;
    return nativeTtsPlugin;
  } catch (error) {
    nativeTtsPlugin = null;
    return nativeTtsPlugin;
  }
};

const speak = async (text: string, options?: { lang?: string; rate?: number }) => {
  const nativePlugin = await loadNativeTtsPlugin();
  if (isNative && nativePlugin && typeof nativePlugin.speak === 'function') {
    try {
      await nativePlugin.speak({ text, lang: options?.lang || 'en-US', rate: options?.rate || 1.0 });
      return;
    } catch (e) {
      console.warn('Native TTS failed, falling back to Web Speech API', e);
    }
  }

  if ('speechSynthesis' in window) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (options?.lang) u.lang = options.lang;
    u.rate = options?.rate ?? 1.0;
    synth.speak(u);
    return;
  }

  console.warn('No TTS available');
};

export default { speak, isNative };
