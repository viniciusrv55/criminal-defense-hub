import {
  Gavel, Shield, Clock, AlertTriangle, FileText, Scale,
  BookOpen, Briefcase, Lock, Users, Eye, Heart,
} from "lucide-react";
import { usePracticeAreas } from "@/hooks/usePracticeAreas";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Gavel, Shield, Clock, AlertTriangle, FileText, Scale,
  BookOpen, Briefcase, Lock, Users, Eye, Heart,
};

const staticAreas = [
  { icon: Gavel, title: "Direito Penal", description: "Defesa completa em crimes contra a pessoa, patrimônio, honra e demais infrações penais previstas no ordenamento jurídico.", icon_color: "" },
  { icon: Shield, title: "Defesa Criminal", description: "Representação técnica especializada em todas as fases do processo criminal, do inquérito à sentença.", icon_color: "" },
  { icon: Clock, title: "Audiência de Custódia", description: "Atuação imediata para garantir os direitos do preso e buscar a liberdade provisória quando cabível.", icon_color: "" },
  { icon: AlertTriangle, title: "Prisão em Flagrante", description: "Atendimento emergencial 24 horas para casos de prisão, garantindo defesa desde o primeiro momento.", icon_color: "" },
  { icon: FileText, title: "Habeas Corpus", description: "Impetração de HC para proteger o direito de ir e vir em casos de prisão ilegal ou abusiva.", icon_color: "" },
  { icon: Scale, title: "Execução Penal", description: "Acompanhamento da execução da pena, pedidos de progressão de regime e benefícios legais.", icon_color: "" },
];

const PracticeAreasSection = () => {
  const { areas: dbAreas, loading } = usePracticeAreas();

  const areas = dbAreas.length > 0
    ? dbAreas.map((area) => ({
        icon: iconMap[area.icon_name ?? 'Gavel'] ?? Gavel,
        title: area.title,
        description: area.description ?? '',
        icon_color: area.icon_color,
        icon_svg: area.icon_svg,
      }))
    : staticAreas.map((a) => ({ ...a, icon_svg: null }));

  return (
    <section id="atuacao" className="section-padding bg-background">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">
            Áreas de Atuação
          </span>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Especialização em{" "}
            <span className="text-gradient-gold">Direito Criminal</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Oferecemos defesa técnica especializada em todas as áreas do Direito Penal,
            com atuação estratégica e comprometida com os interesses de nossos clientes.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {areas.map((area, index) => (
              <div
                key={index}
                className="group p-8 rounded-2xl bg-card border border-border hover:border-gold/30 transition-all duration-300 hover-lift"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-colors"
                  style={{
                    backgroundColor: area.icon_color ? `${area.icon_color}20` : undefined,
                  }}
                  {...(!area.icon_color && { className: "w-14 h-14 rounded-xl bg-gold/15 flex items-center justify-center mb-6 group-hover:bg-gold/25 transition-colors" })}
                >
                  {area.icon_svg ? (
                    <div
                      className="w-7 h-7"
                      style={{ color: area.icon_color || undefined }}
                      dangerouslySetInnerHTML={{ __html: area.icon_svg }}
                    />
                  ) : (
                    <area.icon
                      className="w-7 h-7"
                      style={{ color: area.icon_color || undefined }}
                      {...(!area.icon_color && { className: "w-7 h-7 text-gold" })}
                    />
                  )}
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                  {area.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {area.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default PracticeAreasSection;
