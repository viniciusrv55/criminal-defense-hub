import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Phone, Mail, Clock, Send, Facebook, Instagram, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { usePracticeAreas } from '@/hooks/usePracticeAreas';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { db } from '@/lib/supabase-helpers';
import LeadFormPopup from '@/components/LeadFormPopup';

const Contact = () => {
  const { areas } = usePracticeAreas();
  const { settings } = useSiteSettings();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', practice_area_id: '', message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast({ title: 'Preencha nome e telefone', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { error } = await db.from('leads').insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone,
      practice_area_id: form.practice_area_id || null,
      message: form.message || null,
      status: 'new',
      kanban_status: 'new',
    });

    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Mensagem enviada!', description: 'Entraremos em contato em breve.' });
      setForm({ name: '', email: '', phone: '', practice_area_id: '', message: '' });
    }
    setSending(false);
  };

  return (
    <>
      <Helmet>
        <title>Contato | Lindomberto Moraes - Advocacia Criminal</title>
        <meta name="description" content="Entre em contato com o escritório Lindomberto Moraes Advocacia Criminal. Formulário de contato, endereço e redes sociais." />
      </Helmet>

      <Header />

      <main className="pt-28 pb-16 bg-background">
        <div className="container-custom">
          <div className="text-center mb-16">
            <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">Contato</span>
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Fale com <span className="text-gradient-gold">Nossa Equipe</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Preencha o formulário abaixo e entraremos em contato para entender melhor o seu caso.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Form */}
            <div className="p-8 rounded-2xl bg-card border border-border">
              <h2 className="font-serif text-2xl font-bold text-foreground mb-6">Solicite Atendimento</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-foreground">Nome Completo *</Label>
                  <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Seu nome completo" className="bg-background" required />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">E-mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Telefone *</Label>
                    <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" className="bg-background" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Área de Atendimento</Label>
                  <select
                    value={form.practice_area_id}
                    onChange={(e) => setForm(p => ({ ...p, practice_area_id: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm"
                  >
                    <option value="">Selecione a área</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Mensagem</Label>
                  <Textarea value={form.message} onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Descreva brevemente sua situação..." rows={4} className="bg-background" />
                </div>
                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={sending}>
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? 'Enviando...' : 'Enviar Solicitação'}
                </Button>
              </form>
            </div>

            {/* Info */}
            <div className="space-y-8">
              {/* Team image */}
              {settings.team_image_url && (
                <div className="rounded-2xl overflow-hidden border border-border">
                  <img src={settings.team_image_url} alt="Nossa equipe" className="w-full h-64 object-cover" />
                </div>
              )}

              {/* Contact info */}
              <div className="p-8 rounded-2xl bg-card border border-border space-y-6">
                <h3 className="font-serif text-xl font-semibold text-foreground">Informações</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm">{settings.address || 'Endereço não configurado'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gold flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">{settings.phone || '(00) 00000-0000'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gold flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">{settings.email || 'contato@exemplo.com'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gold flex-shrink-0" />
                    <span className="text-muted-foreground text-sm">Seg - Sex: 9h às 18h</span>
                  </div>
                </div>

                {/* Social links */}
                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  {settings.facebook_url && (
                    <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted/50 text-muted-foreground hover:text-gold transition-colors">
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {settings.instagram_url && (
                    <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted/50 text-muted-foreground hover:text-gold transition-colors">
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {settings.google_my_business_url && (
                    <a href={settings.google_my_business_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted/50 text-muted-foreground hover:text-gold transition-colors">
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Google Maps */}
              {settings.google_maps_embed && (
                <div className="rounded-2xl overflow-hidden border border-border h-64">
                  <div dangerouslySetInnerHTML={{ __html: settings.google_maps_embed }} className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <LeadFormPopup />
    </>
  );
};

export default Contact;
