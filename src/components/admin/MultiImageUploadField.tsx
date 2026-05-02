import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { X } from 'lucide-react';

interface Props {
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  hint?: string;
  folder?: string;
  bucket?: string;
}

export const MultiImageUploadField = ({ label, value, onChange, hint, folder = 'gallery', bucket = 'practice-areas' }: Props) => {
  const [uploading, setUploading] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) { toast({ title: `Erro: ${file.name}`, description: error.message, variant: 'destructive' }); continue; }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }
    onChange([...value, ...newUrls]);
    setUploading(false);
    if (newUrls.length) toast({ title: `${newUrls.length} imagem(ns) enviada(s)` });
    e.target.value = '';
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, idx) => (
            <div key={url + idx} className="relative group bg-muted rounded-lg overflow-hidden aspect-square">
              <img src={url} alt={`g-${idx}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button type="button" size="sm" variant="secondary" onClick={() => move(idx, idx - 1)} disabled={idx === 0} className="h-7 px-2 text-xs">←</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => move(idx, idx + 1)} disabled={idx === value.length - 1} className="h-7 px-2 text-xs">→</Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => onChange(value.filter((_, i) => i !== idx))} className="h-7 w-7 p-0"><X className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Input type="file" accept="image/*" multiple onChange={handle} disabled={uploading} />
    </div>
  );
};
