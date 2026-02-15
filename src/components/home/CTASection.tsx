import { Button } from "@/components/ui/button";
import { Phone, Shield, Clock } from "lucide-react";

const CTASection = () => {
  const whatsappLink = "https://wa.me/5500000000000?text=Olá, gostaria de falar com um advogado criminalista.";

  return (
    <section id="contato" className="section-padding relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black/90 to-secondary" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/10 rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/10 border border-foreground/20 mb-8">
            <Shield className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-foreground/80">
              Atendimento Sigiloso e Imediato
            </span>
          </div>

          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
            Precisa de um{" "}
            <span className="text-gradient-gold">Advogado Criminalista?</span>
          </h2>

          <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            Não enfrente essa situação sozinho. Entre em contato agora mesmo e 
            receba orientação jurídica especializada com total sigilo e agilidade.
          </p>

          {/* CTA Button */}
          <Button variant="whatsapp" size="xl" className="mb-12" asChild>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Phone className="w-5 h-5" />
              Fale com um Advogado Agora
            </a>
          </Button>

          {/* Trust indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { icon: Phone, text: "Resposta Rápida" },
              { icon: Shield, text: "Sigilo Total" },
              { icon: Clock, text: "Disponível 24h para urgências" },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-center gap-3">
                <item.icon className="w-5 h-5 text-gold" />
                <span className="text-foreground/80">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
