import { Button } from "@/components/ui/button";
import { Phone, Shield, ArrowRight } from "lucide-react";

const HeroSection = () => {
  const whatsappLink = "https://wa.me/5500000000000?text=Olá, gostaria de falar com um advogado criminalista.";

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background with gradient overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(135deg, hsla(0, 0%, 0%, 0.95) 0%, hsla(0, 0%, 8%, 0.9) 50%, hsla(0, 0%, 4%, 0.95) 100%)`,
        }}
      />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container-custom text-center py-32">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 mb-8 animate-fade-up">
            <Shield className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-foreground/80">
              Advocacia Criminal Especializada
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground mb-6 leading-tight animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Defesa Criminal com{" "}
            <span className="text-gradient-gold">Excelência</span>
            {" "}e Dedicação
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up" style={{ animationDelay: "0.2s" }}>
            Atuação estratégica em Direito Penal. Sigilo absoluto, atendimento humanizado 
            e defesa técnica rigorosa para proteger seus direitos e sua liberdade.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button variant="whatsapp" size="xl" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <Phone className="w-5 h-5" />
                Fale com um Advogado no WhatsApp
              </a>
            </Button>
            <Button variant="outline-light" size="xl" asChild>
              <a href="#atuacao">
                Conheça Nossa Atuação
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            {[
              { number: "15+", label: "Anos de Experiência" },
              { number: "1000+", label: "Casos Atendidos" },
              { number: "24h", label: "Atendimento Urgente" },
              { number: "100%", label: "Sigilo Garantido" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-serif font-bold text-gold mb-2">
                  {stat.number}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-foreground/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-gold rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
