import { Button } from "@/components/ui/button";
import { Phone, Shield, Clock, MessageCircle } from "lucide-react";

const BlogSidebar = () => {
  const whatsappLink = "https://wa.me/5500000000000?text=Olá, gostaria de falar com um advogado criminalista.";

  return (
    <aside className="lg:sticky lg:top-28 space-y-8">
      {/* WhatsApp CTA */}
      <div className="p-6 rounded-2xl bg-black border border-gold/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gold/15 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-gold" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-white">
            Fale Conosco
          </h3>
        </div>

        <p className="text-white/80 mb-6 leading-relaxed">
          Precisa falar com um advogado criminalista agora?
          Atendimento imediato e sigiloso via WhatsApp.
        </p>

        <Button variant="whatsapp" className="w-full" size="lg" asChild>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
            <Phone className="w-4 h-4" />
            Falar pelo WhatsApp
          </a>
        </Button>

        <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Shield className="w-4 h-4 text-gold" />
            <span>Sigilo absoluto garantido</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Clock className="w-4 h-4 text-gold" />
            <span>Resposta rápida</span>
          </div>
        </div>
      </div>

      {/* Practice Areas */}
      <div className="p-6 rounded-2xl bg-black border border-gold/30">
        <h3 className="font-serif text-lg font-semibold text-white mb-4">
          Áreas de Atuação
        </h3>
        <ul className="space-y-3">
          {[
            "Direito Penal",
            "Defesa Criminal",
            "Habeas Corpus",
            "Audiência de Custódia",
            "Prisão em Flagrante",
            "Execução Penal",
          ].map((area) => (
            <li key={area}>
              <a
                href="/#atuacao"
                className="text-white/80 hover:text-gold transition-colors text-sm flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                {area}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default BlogSidebar;
