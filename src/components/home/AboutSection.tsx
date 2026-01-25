import { Scale, Shield, Users, Award } from "lucide-react";

const AboutSection = () => {
  const features = [
    {
      icon: Scale,
      title: "Ética Profissional",
      description: "Atuação pautada pelos mais altos padrões éticos da advocacia",
    },
    {
      icon: Shield,
      title: "Sigilo Absoluto",
      description: "Confidencialidade total em todos os casos e informações",
    },
    {
      icon: Users,
      title: "Atendimento Humanizado",
      description: "Tratamento digno e acolhedor em momentos difíceis",
    },
    {
      icon: Award,
      title: "Experiência Comprovada",
      description: "Anos de atuação exclusiva em Direito Criminal",
    },
  ];

  return (
    <section id="sobre" className="section-padding bg-card">
      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">
              Sobre o Escritório
            </span>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              Advocacia Criminal de{" "}
              <span className="text-gradient-gold">Excelência</span>
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                O escritório <strong className="text-foreground">Lindomberto Moraes – Advocacia Criminal</strong> é 
                especializado exclusivamente em Direito Penal, oferecendo defesa técnica qualificada 
                para clientes em todo o Brasil.
              </p>
              <p>
                Com mais de 15 anos de experiência, nossa atuação é pautada pela ética inabalável, 
                pelo respeito ao sigilo profissional e pelo compromisso com a defesa dos direitos 
                e garantias fundamentais de nossos clientes.
              </p>
              <p>
                Entendemos que cada caso é único e merece atenção personalizada. Por isso, 
                oferecemos um atendimento humanizado, onde o cliente é ouvido, respeitado e 
                mantido informado sobre todos os passos do seu processo.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-xl bg-background border border-border hover:border-gold/30 transition-all duration-300 hover-lift group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-gold" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
