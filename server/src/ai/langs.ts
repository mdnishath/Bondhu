export interface Lang { code: string; name: string; ttsVoice: string; ttsLocale: string; }

export const SUPPORTED_LANGS: Lang[] = [
  { code: 'bn', name: 'Bengali', ttsLocale: 'bn-IN', ttsVoice: 'bn-IN-Chirp3-HD-Achernar' },
  { code: 'en', name: 'English', ttsLocale: 'en-US', ttsVoice: 'en-US-Chirp3-HD-Achernar' },
  { code: 'hi', name: 'Hindi', ttsLocale: 'hi-IN', ttsVoice: 'hi-IN-Chirp3-HD-Achernar' },
  { code: 'ar', name: 'Arabic', ttsLocale: 'ar-XA', ttsVoice: 'ar-XA-Chirp3-HD-Achernar' },
  { code: 'ur', name: 'Urdu', ttsLocale: 'ur-IN', ttsVoice: 'ur-IN-Standard-A' },
  { code: 'es', name: 'Spanish', ttsLocale: 'es-US', ttsVoice: 'es-US-Chirp3-HD-Achernar' },
  { code: 'fr', name: 'French', ttsLocale: 'fr-FR', ttsVoice: 'fr-FR-Chirp3-HD-Achernar' },
  { code: 'pt', name: 'Portuguese', ttsLocale: 'pt-BR', ttsVoice: 'pt-BR-Chirp3-HD-Achernar' },
  { code: 'de', name: 'German', ttsLocale: 'de-DE', ttsVoice: 'de-DE-Chirp3-HD-Achernar' },
  { code: 'ru', name: 'Russian', ttsLocale: 'ru-RU', ttsVoice: 'ru-RU-Chirp3-HD-Achernar' },
  { code: 'zh', name: 'Chinese', ttsLocale: 'cmn-CN', ttsVoice: 'cmn-CN-Chirp3-HD-Achernar' },
  { code: 'ja', name: 'Japanese', ttsLocale: 'ja-JP', ttsVoice: 'ja-JP-Chirp3-HD-Achernar' },
  { code: 'ko', name: 'Korean', ttsLocale: 'ko-KR', ttsVoice: 'ko-KR-Chirp3-HD-Achernar' },
  { code: 'id', name: 'Indonesian', ttsLocale: 'id-ID', ttsVoice: 'id-ID-Chirp3-HD-Achernar' },
  { code: 'tr', name: 'Turkish', ttsLocale: 'tr-TR', ttsVoice: 'tr-TR-Chirp3-HD-Achernar' },
  { code: 'it', name: 'Italian', ttsLocale: 'it-IT', ttsVoice: 'it-IT-Chirp3-HD-Achernar' },
  { code: 'ta', name: 'Tamil', ttsLocale: 'ta-IN', ttsVoice: 'ta-IN-Chirp3-HD-Achernar' },
  { code: 'ml', name: 'Malayalam', ttsLocale: 'ml-IN', ttsVoice: 'ml-IN-Chirp3-HD-Achernar' },
];

const MAP = new Map(SUPPORTED_LANGS.map((l) => [l.code, l]));
export function isSupportedLang(code: string): boolean { return MAP.has(code); }
export function langName(code: string): string { return MAP.get(code)?.name ?? code; }
export function langOf(code: string): Lang | undefined { return MAP.get(code); }
