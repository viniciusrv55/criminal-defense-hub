import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Upload, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase-helpers';
import { supabase } from '@/integrations/supabase/client';
import type { SiteSetting } from '@/types/database';

const SETTINGS_KEYS = [
  { key: 'logo_url', label: 'Logo', type: 'image', bucket: 'site-assets' },
  { key: 'team_image_url', label: 'Imagem da Equipe', type: 'image', bucket: 'site-assets' },
  { key: 'address', label: 'Endereço', type: 'text' },
  { key: 'phone', label: 'Telefone', type: 'text' },
  { key: 'email', label: 'E-mail', type: 'text' },
  { key: 'google_maps_embed', label: 'Google Maps (código embed)', type: 'textarea' },
  { key: 'google_my_business_url', label: 'Google Meu Negócio (URL)', type: 'text' },
  { key: 'facebook_url', label: 'Facebook (URL)', type: 'text' },
  { key: 'instagram_url', label: 'Instagram (URL)', type: 'text' },
];

const Settings = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await db.from('site_settings').select('*');
      const map: Record<string, string> = {};
      (data as SiteSetting[] ?? []).forEach(s => { map[s.key] = s.value ?? ''; });
      setValues(map);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleImageUpload = async (key: string, file: File) => {
    setUploading(key);
    const ext = file.name.split('.').pop();
    const path = `settings/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('site-assets').upload(path, file);
    if (error) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
      setUploading(null);
      return;
    }
    const { data: urlData } = supabase.storage.from('site-assets').getPublicUrl(path);
    setValues(p => ({ ...p, [key]: urlData.publicUrl }));
    setUploading(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const promises = Object.entries(values).map(([key, value]) =>
      db.from('site_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
    );
    await Promise.all(promises);
    toast({ title: 'Configurações salvas!' });
    setSaving(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Configurações gerais do site</p>
        </div>

        <div className="space-y-6">
          {SETTINGS_KEYS.map(setting => (
            <div key={setting.key} className="p-6 bg-card rounded-xl border border-border space-y-3">
              <Label className="text-foreground font-medium">{setting.label}</Label>

              {setting.type === 'image' ? (
                <div>
                  {values[setting.key] ? (
                    <div className="relative w-full max-w-xs">
                      <img src={values[setting.key]} alt={setting.label} className="w-full h-32 object-contain rounded-lg bg-muted/50 p-2" />
                      <button
                        onClick={() => setValues(p => ({ ...p, [setting.key]: '' }))}
                        className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full max-w-xs h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/50 transition-colors bg-background">
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">{uploading === setting.key ? 'Enviando...' : 'Clique para enviar'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(setting.key, file);
                      }} disabled={uploading === setting.key} />
                    </label>
                  )}
                </div>
              ) : setting.type === 'textarea' ? (
                <Textarea
                  value={values[setting.key] ?? ''}
                  onChange={(e) => setValues(p => ({ ...p, [setting.key]: e.target.value }))}
                  rows={3}
                  className="bg-background font-mono text-xs"
                  placeholder={`Cole o ${setting.label} aqui...`}
                />
              ) : (
                <Input
                  value={values[setting.key] ?? ''}
                  onChange={(e) => setValues(p => ({ ...p, [setting.key]: e.target.value }))}
                  className="bg-background"
                  placeholder={setting.label}
                />
              )}
            </div>
          ))}

          <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;
