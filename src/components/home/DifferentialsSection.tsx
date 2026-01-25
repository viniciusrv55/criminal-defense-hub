import { Heart, Lock, Target, MessageCircle } from "lucide-react";

const DifferentialsSection = () => {
  const differentials = [
    {
      icon: Heart,
      title: "Atendimento Humanizado",
      description: "Compreendemos o momento delicado que você atravessa. Oferecemos acolhimento, respeito e clareza em cada etapa do processo.",
    },
    {
      icon: Lock,
      title: "Sigilo Absoluto",
      description: "Garantimos total confidencialidade sobre seu caso. Suas informações estão protegidas pelo sigilo profissional advocatício.",
    },
    {
      icon: Target,
      title: "Atuação Estratégica",
      description: "Desenvolvemos estratégias jurídicas personalizadas, analisando cada detalhe para construir a melhor defesa possível.",
    },
    {
      icon: MessageCircle,
      title: "Atendimento Rápido",
      description: "Respondemos rapidamente via WhatsApp. Em casos urgentes, estamos disponíveis 24 horas para atender você.",
    },
  ];

  return (
    <section className="section-padding bg-card relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent" />
      </div>

      <div className="container-custom relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">
            Por que nos escolher
          </span>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Nossos{" "}
            <span className="text-gradient-gold">Diferenciais</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            O que torna o escritório Lindomberto Moraes a escolha certa para sua defesa criminal.
          </p>
        </div>

        {/* Differentials */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {differentials.map((item, index) => (
            <div
              key={index}
              className="flex gap-6 p-8 rounded-2xl bg-background border border-border hover:border-gold/30 transition-all duration-300 hover-lift group"
            >
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                  <item.icon className="w-8 h-8 text-gold" />
                </div>
              </div>
              <div>
                <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                  {item.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DifferentialsSection;
