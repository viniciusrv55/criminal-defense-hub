import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { X } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  onUploaded: (url: string) => void;
  hint?: string;
  folder?: string;
  bucket?: string;
}

export const ImageUploadField = ({ label, value, onUploaded, hint, folder = 'cover', bucket = 'practice-areas' }: Props) => {
  const [uploading, setUploading] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) { toast({ title: 'Erro ao subir', description: error.message, variant: 'destructive' }); setUploading(false); return; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onUploaded(data.publicUrl);
    setUploading(false);
    toast({ title: 'Imagem enviada' });
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {value && (
        <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
          <img src={value} alt="preview" className="max-h-28 rounded" />
          <Button type="button" size="sm" variant="ghost" onClick={() => onUploaded('')}><X className="w-4 h-4" /></Button>
        </div>
      )}
      <Input type="file" accept="image/*" onChange={handle} disabled={uploading} />
    </div>
  );
};
