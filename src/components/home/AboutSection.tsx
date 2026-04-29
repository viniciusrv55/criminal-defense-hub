import { Scale, Shield, Users, Award } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const AboutSection = () => {
  const { settings } = useSiteSettings();

  const features = [
    { icon: Scale, title: "Ética Profissional", description: "Atuação pautada pelos mais altos padrões éticos da advocacia" },
    { icon: Shield, title: "Sigilo Absoluto", description: "Confidencialidade total em todos os casos e informações" },
    { icon: Users, title: "Atendimento Humanizado", description: "Tratamento digno e acolhedor em momentos difíceis" },
    { icon: Award, title: "Experiência Comprovada", description: "Anos de atuação exclusiva em Direito Criminal" },
  ];

  const title = settings.about_title || "Advocacia Criminal de Excelência";
  const highlight = settings.about_title_highlight || "Excelência";
  const renderTitle = () => {
    if (highlight && title.includes(highlight)) {
      const [before, ...rest] = title.split(highlight);
      return (<>{before}<span className="text-gradient-gold">{highlight}</span>{rest.join(highlight)}</>);
    }
    return title;
  };

  return (
    <section id="sobre" className="section-padding bg-white text-black">
      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block drop-shadow-sm">
              {settings.about_eyebrow || "Sobre o Escritório"}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-6 leading-tight">
              {renderTitle()}
            </h2>
            <div className="space-y-4 text-neutral-600 leading-relaxed">
              {settings.about_paragraph_1 && <p>{settings.about_paragraph_1}</p>}
              {settings.about_paragraph_2 && <p>{settings.about_paragraph_2}</p>}
              {settings.about_paragraph_3 && <p>{settings.about_paragraph_3}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="p-6 rounded-xl bg-neutral-50 border border-neutral-200 hover:border-gold/40 transition-all duration-300 hover-lift group">
                <div className="w-12 h-12 rounded-lg bg-gold/15 flex items-center justify-center mb-4 group-hover:bg-gold/25 transition-colors">
                  <feature.icon className="w-6 h-6 text-gold" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-black mb-2">{feature.title}</h3>
                <p className="text-neutral-500 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
