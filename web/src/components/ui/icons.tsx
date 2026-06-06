// Minimal inline SVG icon set matching the Bondhu design.
type P = { className?: string };
const S = (props: any) => <svg viewBox="0 0 24 24" {...props} />;

export const LogoIcon = ({ className }: P) => (
  <S fill="none" className={className}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v3A2.5 2.5 0 0 1 13.5 12H8l-4 3z" fill="#fff" opacity=".95" />
    <path d="M11 13.5A2.5 2.5 0 0 1 13.5 11H18a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 1 18 19v2l-2.5-2.2H13.5A2.5 2.5 0 0 1 11 16.3z" fill="#06291f" opacity=".55" />
  </S>
);
export const PlusIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}><path d="M12 5v14M5 12h14" /></S>
);
export const GearIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </S>
);
export const LogoutIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></S>
);
export const SearchIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></S>
);
export const GlobeIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></S>
);
export const DotsIcon = ({ className }: P) => (
  <S fill="currentColor" className={className}><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></S>
);
export const SendIcon = ({ className }: P) => (
  <S fill="currentColor" className={className}><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></S>
);
export const MicIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" /></S>
);
export const SpeakerIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></S>
);
export const PlayIcon = ({ className }: P) => (
  <S fill="currentColor" className={className}><path d="M8 5v14l11-7z" /></S>
);
export const PencilIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></S>
);
export const BackIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 12H5M12 19l-7-7 7-7" /></S>
);
export const ChevronDownIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6" /></S>
);
export const ReplyIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 17 4 12l5-5" /><path d="M20 18a6 6 0 0 0-6-6H4" /></S>
);
export const ForwardIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 17 5-5-5-5" /><path d="M4 18a6 6 0 0 1 6-6h10" /></S>
);
export const TrashIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></S>
);
export const CopyIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></S>
);
export const SmileIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></S>
);
export const CloseIcon = ({ className }: P) => (
  <S fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18M6 6l12 12" /></S>
);
