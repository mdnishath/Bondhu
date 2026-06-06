import { GlobeIcon } from '../ui/icons';

export function TranslatingLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-white/75 py-0.5">
      <GlobeIcon className="w-3.5 h-3.5 text-[#4fd1ab] spin-slow" />
      <span>{label}</span>
      <span className="flex items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-[#4fd1ab] animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </span>
    </div>
  );
}
