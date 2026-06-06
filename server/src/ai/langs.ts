export interface Lang { code: string; name: string; flag: string; ttsVoice: string; ttsLocale: string; }

export const SUPPORTED_LANGS: Lang[] = [
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', ttsLocale: 'bn-IN', ttsVoice: 'bn-IN-Chirp3-HD-Achernar' },
  { code: 'en', name: 'English', flag: '🇺🇸', ttsLocale: 'en-US', ttsVoice: 'en-US-Chirp3-HD-Achernar' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', ttsLocale: 'hi-IN', ttsVoice: 'hi-IN-Chirp3-HD-Achernar' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', ttsLocale: 'ar-XA', ttsVoice: 'ar-XA-Chirp3-HD-Achernar' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', ttsLocale: 'ur-IN', ttsVoice: 'ur-IN-Standard-A' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', ttsLocale: 'es-US', ttsVoice: 'es-US-Chirp3-HD-Achernar' },
  { code: 'fr', name: 'French', flag: '🇫🇷', ttsLocale: 'fr-FR', ttsVoice: 'fr-FR-Chirp3-HD-Achernar' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', ttsLocale: 'pt-BR', ttsVoice: 'pt-BR-Chirp3-HD-Achernar' },
  { code: 'de', name: 'German', flag: '🇩🇪', ttsLocale: 'de-DE', ttsVoice: 'de-DE-Chirp3-HD-Achernar' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', ttsLocale: 'ru-RU', ttsVoice: 'ru-RU-Chirp3-HD-Achernar' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', ttsLocale: 'cmn-CN', ttsVoice: 'cmn-CN-Chirp3-HD-Achernar' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', ttsLocale: 'ja-JP', ttsVoice: 'ja-JP-Chirp3-HD-Achernar' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', ttsLocale: 'ko-KR', ttsVoice: 'ko-KR-Chirp3-HD-Achernar' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', ttsLocale: 'id-ID', ttsVoice: 'id-ID-Chirp3-HD-Achernar' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', ttsLocale: 'tr-TR', ttsVoice: 'tr-TR-Chirp3-HD-Achernar' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', ttsLocale: 'it-IT', ttsVoice: 'it-IT-Chirp3-HD-Achernar' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', ttsLocale: 'ta-IN', ttsVoice: 'ta-IN-Chirp3-HD-Achernar' },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳', ttsLocale: 'ml-IN', ttsVoice: 'ml-IN-Chirp3-HD-Achernar' },
];

const MAP = new Map(SUPPORTED_LANGS.map((l) => [l.code, l]));
export function isSupportedLang(code: string): boolean { return MAP.has(code); }
export function langName(code: string): string { return MAP.get(code)?.name ?? code; }
export function langOf(code: string): Lang | undefined { return MAP.get(code); }
