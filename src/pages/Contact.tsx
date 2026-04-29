import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Clock, MessageCircle, Facebook, Instagram, ExternalLink } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { buildWhatsappLink } from '@/lib/whatsapp';

const Contact = () => {
  const { settings } = useSiteSettings();
  const whatsappLink = buildWhatsappLink(settings.whatsapp_number, settings.whatsapp_message);

  return (
    <>
      <Helmet>
        <title>Contato | Lindomberto Moraes - Advocacia Criminal</title>
        <meta name="description" content="Entre em contato pelo WhatsApp com o escritório Lindomberto Moraes Advocacia Criminal." />
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
              Atendimento ágil e sigiloso pelo WhatsApp. Solicite agora seu atendimento.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* WhatsApp CTA */}
            <div className="p-8 rounded-2xl bg-card border border-border flex flex-col justify-center text-center">
              <div className="inline-flex mx-auto w-16 h-16 rounded-full bg-[#25D366]/15 items-center justify-center mb-6">
                <MessageCircle className="w-8 h-8 text-[#25D366]" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground mb-4">Solicite Atendimento</h2>
              <p className="text-muted-foreground mb-8">
                Clique no botão abaixo para iniciar uma conversa direta com nossa equipe pelo WhatsApp.
              </p>
              <Button variant="whatsapp" size="xl" asChild className="mx-auto">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5" />
                  Falar no WhatsApp
                </a>
              </Button>
              {settings.phone && (
                <p className="text-muted-foreground text-sm mt-6">
                  Ou ligue: <a href={`tel:${settings.phone}`} className="text-gold hover:underline">{settings.phone}</a>
                </p>
              )}
            </div>

            {/* Info */}
            <div className="space-y-8">
              {settings.team_image_url && (
                <div className="rounded-2xl overflow-hidden border border-border">
                  <img src={settings.team_image_url} alt="Nossa equipe" className="w-full h-64 object-cover" />
                </div>
              )}

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
                    <span className="text-muted-foreground text-sm">{settings.contact_hours || 'Seg - Sex: 9h às 18h'}</span>
                  </div>
                </div>

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
            </div>
          </div>

          {/* Google Maps - largura total */}
          {settings.google_maps_embed && (
            <div className="mt-12 rounded-2xl overflow-hidden border border-border h-[420px]">
              <div
                dangerouslySetInnerHTML={{ __html: settings.google_maps_embed }}
                className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
              />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
};

export default Contact;
