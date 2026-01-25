import { 
  Gavel, 
  Shield, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Scale 
} from "lucide-react";

const PracticeAreasSection = () => {
  const areas = [
    {
      icon: Gavel,
      title: "Direito Penal",
      description: "Defesa completa em crimes contra a pessoa, patrimônio, honra e demais infrações penais previstas no ordenamento jurídico.",
    },
    {
      icon: Shield,
      title: "Defesa Criminal",
      description: "Representação técnica especializada em todas as fases do processo criminal, do inquérito à sentença.",
    },
    {
      icon: Clock,
      title: "Audiência de Custódia",
      description: "Atuação imediata para garantir os direitos do preso e buscar a liberdade provisória quando cabível.",
    },
    {
      icon: AlertTriangle,
      title: "Prisão em Flagrante",
      description: "Atendimento emergencial 24 horas para casos de prisão, garantindo defesa desde o primeiro momento.",
    },
    {
      icon: FileText,
      title: "Habeas Corpus",
      description: "Impetração de HC para proteger o direito de ir e vir em casos de prisão ilegal ou abusiva.",
    },
    {
      icon: Scale,
      title: "Execução Penal",
      description: "Acompanhamento da execução da pena, pedidos de progressão de regime e benefícios legais.",
    },
  ];

  return (
    <section id="atuacao" className="section-padding bg-background">
      <div className="container-custom">
        {/* Header */}
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

        {/* Areas Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {areas.map((area, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-gold/30 transition-all duration-300 hover-lift"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-colors">
                <area.icon className="w-7 h-7 text-gold" />
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
      </div>
    </section>
  );
};

export default PracticeAreasSection;
