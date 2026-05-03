import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Gavel, Shield, Clock, AlertTriangle, FileText, Scale, BookOpen, Briefcase, Lock, Users, Eye, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import { usePracticeAreas } from '@/hooks/usePracticeAreas';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const iconMap: Record<string, LucideIcon> = {
  Gavel, Shield, Clock, AlertTriangle, FileText, Scale, BookOpen, Briefcase, Lock, Users, Eye, Heart,
};

const PracticeAreas = () => {
  const { areas, loading } = usePracticeAreas(true);
  const { settings } = useSiteSettings();
  const ordered = [...areas].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.sort_order - b.sort_order);

  const title = settings.areas_page_title || 'Onde podemos defender você';
  const highlight = settings.areas_page_title_highlight || 'defender você';
  const renderTitle = () => {
    if (highlight && title.includes(highlight)) {
      const [before, ...rest] = title.split(highlight);
      return (<>{before}<span className="text-gradient-gold">{highlight}</span>{rest.join(highlight)}</>);
    }
    return title;
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Áreas de Atuação | Lindomberto Moraes Advocacia</title>
        <meta name="description" content="Conheça todas as áreas de atuação do escritório Lindomberto Moraes — defesa criminal especializada com atendimento personalizado." />
        <link rel="canonical" href={`${typeof window !== 'undefined' ? window.location.origin : ''}/areas-de-atuacao`} />
      </Helmet>
      <Header />

      <section className="pt-32 pb-12 bg-card border-b border-border">
        <div className="container-custom text-center max-w-3xl mx-auto">
          <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">{settings.areas_page_eyebrow || 'Áreas de Atuação'}</span>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            {renderTitle()}
          </h1>
          <p className="text-muted-foreground text-lg">
            {settings.areas_page_subtitle || 'Atuação especializada em Direito Criminal. Selecione uma área para ver detalhes, casos, galeria e solicitar atendimento.'}
          </p>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-custom">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
          ) : ordered.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhuma área cadastrada ainda.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {ordered.map(area => {
                const Icon = iconMap[area.icon_name ?? 'Gavel'] ?? Gavel;
                const hasCover = !!area.cover_image_url;
                const Card = (
                  <article className="group relative h-full rounded-2xl overflow-hidden bg-card border border-border hover:border-gold/40 transition-all duration-300 hover-lift">
                    {hasCover && (
                      <div className="relative h-56 overflow-hidden">
                        <img src={area.cover_image_url!} alt={area.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                        {area.featured && (
                          <span className="absolute top-3 left-3 text-xs uppercase tracking-wider px-2 py-1 rounded-full bg-gold text-black font-semibold">Destaque</span>
                        )}
                      </div>
                    )}
                    <div className="p-8">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: `${area.icon_color}20` }}>
                        {area.icon_svg
                          ? <div className="w-7 h-7" style={{ color: area.icon_color }} dangerouslySetInnerHTML={{ __html: area.icon_svg }} />
                          : <Icon className="w-7 h-7" style={{ color: area.icon_color }} />}
                      </div>
                      <h2 className="font-serif text-xl font-semibold text-foreground mb-3">{area.title}</h2>
                      {area.subtitle && <p className="text-gold text-sm mb-2">{area.subtitle}</p>}
                      <p className="text-muted-foreground leading-relaxed line-clamp-3">{area.description}</p>
                      {area.slug && (
                        <span className="inline-flex items-center gap-2 mt-6 text-gold font-medium text-sm group-hover:gap-3 transition-all">
                          Ver detalhes <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </article>
                );
                return area.slug ? (
                  <Link key={area.id} to={`/areas/${area.slug}`} className="block h-full">{Card}</Link>
                ) : (
                  <div key={area.id} className="h-full">{Card}</div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default PracticeAreas;
