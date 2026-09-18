import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type PlayerOption = {
  id: string;
  name: string;
  disabled?: boolean;
};

type Props = {
  options: PlayerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
};

export default function PlayerSelect({ options, value, onChange, placeholder = 'Choose player...' }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.id === value);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-14 px-4 rounded-2xl border border-white/[.08] bg-[#081327] text-white text-sm font-bold outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/10 transition-all flex items-center justify-between"
      >
        <span className={selected ? 'text-white' : 'text-slate-500'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full max-h-64 overflow-y-auto rounded-2xl border border-white/[.08] bg-[#0c172b] shadow-2xl shadow-black/50 p-1.5">
          {options.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500 text-center">No players</div>
          ) : (
            options.map((o) => {
              const isSelected = value === o.id;
              return (
                <button
                  type="button"
                  key={o.id}
                  disabled={o.disabled}
                  onClick={() => {
                    if (o.disabled) return;
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${
                    o.disabled
                      ? 'text-slate-600 cursor-not-allowed opacity-50'
                      : isSelected
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <span>{o.name}</span>
                  {isSelected && !o.disabled && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
