import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Phone, Gavel, Shield, Clock, AlertTriangle, FileText, Scale, BookOpen, Briefcase, Lock, Users, Eye, Heart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { usePracticeAreaBySlug } from "@/hooks/usePracticeAreas";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { buildWhatsappLink } from "@/lib/whatsapp";

const iconMap: Record<string, LucideIcon> = {
  Gavel, Shield, Clock, AlertTriangle, FileText, Scale, BookOpen, Briefcase, Lock, Users, Eye, Heart,
};

const toYouTubeEmbed = (url: string) => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
};

const PracticeAreaDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { area, loading } = usePracticeAreaBySlug(slug);
  const { settings } = useSiteSettings();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-32 pb-20 container-custom text-center text-muted-foreground">Carregando...</div>
        <Footer />
      </div>
    );
  }

  if (!area) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-32 pb-20 container-custom text-center">
          <h1 className="font-serif text-3xl font-bold text-foreground mb-4">Área não encontrada</h1>
          <Link to="/#atuacao" className="text-gold hover:underline">← Voltar para áreas de atuação</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const Icon = iconMap[area.icon_name ?? 'Gavel'] ?? Gavel;
  const waMsg = area.whatsapp_message || `Olá, gostaria de saber mais sobre ${area.title}.`;
  const waUrl = buildWhatsappLink(settings.whatsapp_number, waMsg);
  const ctaText = area.cta_button_text || settings.cta_button || 'Solicitar Atendimento via WhatsApp';

  return (
    <>
      <Helmet>
        <title>{area.title} | Lindomberto Moraes - Advocacia Criminal</title>
        <meta name="description" content={area.description ?? area.subtitle ?? `Saiba mais sobre ${area.title} no escritório Lindomberto Moraes.`} />
        <link rel="canonical" href={`https://lindombertomoraes.adv.br/areas/${area.slug}`} />
      </Helmet>

      <Header />

      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-20 min-h-[60vh] flex items-center overflow-hidden bg-background">
          {area.cover_image_url && (
            <>
              <div className="absolute inset-0">
                <img src={area.cover_image_url} alt={area.title} className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/85" />
            </>
          )}
          <div className="container-custom relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <Link to="/#atuacao" className="inline-flex items-center gap-2 text-gold hover:text-gold/80 text-sm mb-8">
                <ArrowLeft className="w-4 h-4" /> Voltar para áreas
              </Link>
              <div className="flex justify-center mb-6">
                <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: `${area.icon_color}25` }}>
                {area.icon_svg
                  ? <div className="w-8 h-8" style={{ color: area.icon_color }} dangerouslySetInnerHTML={{ __html: area.icon_svg }} />
                  : <Icon className="w-8 h-8" style={{ color: area.icon_color }} />}
              </div>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 drop-shadow-lg">{area.title}</h1>
              {area.subtitle && <p className="text-white/90 text-xl mb-4">{area.subtitle}</p>}
              {area.description && <p className="text-white/80 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">{area.description}</p>}
            </div>
          </div>
        </section>

        {/* Content */}
        {area.content && (
          <section className="section-padding bg-card">
            <div className="container-custom max-w-3xl">
              <div className="prose prose-invert max-w-none text-foreground/90 whitespace-pre-line leading-relaxed">
                {area.content}
              </div>
            </div>
          </section>
        )}

        {/* Gallery */}
        {area.gallery.length > 0 && (
          <section className="section-padding bg-background">
            <div className="container-custom max-w-5xl">
              <h2 className="font-serif text-3xl font-bold text-center text-foreground mb-10">Galeria</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {area.gallery.map((img, i) => (
                  <a key={img + i} href={img} target="_blank" rel="noreferrer" className="aspect-video rounded-xl overflow-hidden border border-border hover:border-gold/50 transition-colors block">
                    <img src={img} alt={`${area.title} ${i + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Video */}
        {area.youtube_url && (
          <section className="section-padding bg-card">
            <div className="container-custom max-w-4xl">
              <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black">
                <iframe src={toYouTubeEmbed(area.youtube_url)} title={area.title} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="section-padding bg-background">
          <div className="container-custom">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Precisa de orientação sobre {area.title}?</h2>
              <p className="text-muted-foreground mb-8">Fale agora com nosso escritório pelo WhatsApp e receba atendimento sigiloso.</p>
              <Button variant="whatsapp" size="xl" asChild>
                <a href={waUrl} target="_blank" rel="noopener noreferrer"><Phone className="w-5 h-5" />{ctaText}</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default PracticeAreaDetail;
