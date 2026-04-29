import { Button } from "@/components/ui/button";
import { Phone, Shield, ArrowRight } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { buildWhatsappLink } from "@/lib/whatsapp";

const HeroSection = () => {
  const { settings } = useSiteSettings();
  const whatsappLink = buildWhatsappLink(settings.whatsapp_number, settings.whatsapp_message);

  const title = settings.hero_title || "Defesa Criminal com Excelência e Dedicação";
  const highlight = settings.hero_title_highlight || "Excelência";
  const renderTitle = () => {
    if (highlight && title.includes(highlight)) {
      const [before, ...rest] = title.split(highlight);
      return (
        <>
          {before}
          <span className="text-gradient-gold">{highlight}</span>
          {rest.join(highlight)}
        </>
      );
    }
    return title;
  };

  const stats = [
    { number: settings.hero_stat_1_number || "15+", label: settings.hero_stat_1_label || "Anos de Experiência" },
    { number: settings.hero_stat_2_number || "1000+", label: settings.hero_stat_2_label || "Casos Atendidos" },
    { number: settings.hero_stat_3_number || "24h", label: settings.hero_stat_3_label || "Atendimento Urgente" },
    { number: settings.hero_stat_4_number || "100%", label: settings.hero_stat_4_label || "Sigilo Garantido" },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `linear-gradient(135deg, hsla(0, 0%, 0%, 0.95) 0%, hsla(0, 0%, 8%, 0.9) 50%, hsla(0, 0%, 4%, 0.95) 100%)` }} />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container-custom text-center py-32">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 mb-8 animate-fade-up">
            <Shield className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-foreground/80">{settings.hero_badge || "Advocacia Criminal Especializada"}</span>
          </div>

          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground mb-6 leading-tight animate-fade-up" style={{ animationDelay: "0.1s" }}>
            {renderTitle()}
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up" style={{ animationDelay: "0.2s" }}>
            {settings.hero_subtitle || "Atuação estratégica em Direito Penal."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button variant="whatsapp" size="xl" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer"><Phone className="w-5 h-5" />{settings.hero_cta_primary || "Solicitar Atendimento"}</a>
            </Button>
            <Button variant="outline-light" size="xl" asChild>
              <a href="#atuacao">{settings.hero_cta_secondary || "Conheça Nossa Atuação"}<ArrowRight className="w-5 h-5" /></a>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-serif font-bold text-gold mb-2">{stat.number}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-foreground/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-gold rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
