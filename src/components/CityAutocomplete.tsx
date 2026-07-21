import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchSiigoCities } from "@/lib/catalog/catalog.functions";

export interface SelectedCity {
  code: string;
  name: string;
  state_name?: string;
  state_code: string;
  country_code: string;
}

interface Props {
  value: SelectedCity | null;
  /** Texto libre actual del input (para no perder lo que escribió si no eligió aún). */
  inputValue?: string;
  onChange: (city: SelectedCity | null, rawText: string) => void;
  placeholder?: string;
  className?: string;
}

export function CityAutocomplete({ value, inputValue, onChange, placeholder, className }: Props) {
  const search = useServerFn(searchSiigoCities);
  const [text, setText] = useState(inputValue ?? value?.name ?? "");
  const [opts, setOpts] = useState<SelectedCity[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!open) return;
      setLoading(true);
      try {
        const r = await search({ data: { q: text || undefined } });
        setOpts(r.cities as SelectedCity[]);
      } catch { setOpts([]); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [text, open, search]);

  useEffect(() => {
    const onClickOut = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  return (
    <div ref={boxRef} className={`relative ${className ?? ""}`}>
      <Input
        value={text}
        placeholder={placeholder ?? "Buscar ciudad (Siigo)…"}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          // Si el texto deja de coincidir con la selección, limpia la selección.
          if (value && e.target.value.trim() !== value.name) onChange(null, e.target.value);
          else onChange(value, e.target.value);
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-lg text-sm">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />Buscando…</div>
          )}
          {!loading && opts.length === 0 && (
            <div className="px-3 py-2 text-muted-foreground">Sin coincidencias en el catálogo de Siigo.</div>
          )}
          {!loading && opts.map((c) => {
            const selected = value?.code === c.code;
            return (
              <button
                key={`${c.code}-${c.state_code}`}
                type="button"
                onClick={() => { onChange(c, c.name); setText(c.name); setOpen(false); }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-accent/50 ${selected ? "bg-accent/30" : ""}`}
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{c.name}{c.state_name ? ` · ${c.state_name}` : ""}</span>
                <span className="text-[10px] text-muted-foreground">{c.code}</span>
                {selected && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}