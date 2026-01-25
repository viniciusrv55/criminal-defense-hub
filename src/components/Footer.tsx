import { Link } from "react-router-dom";
import { Scale, MapPin, Phone, Mail, Clock } from "lucide-react";

const Footer = () => {
  const whatsappLink = "https://wa.me/5500000000000?text=Olá, gostaria de falar com um advogado criminalista.";

  return (
    <footer className="bg-card border-t border-border">
      <div className="container-custom section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/20">
                <Scale className="w-6 h-6 text-gold" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-serif font-semibold text-foreground">
                  Lindomberto Moraes
                </span>
                <span className="text-xs text-muted-foreground tracking-wider uppercase">
                  Advocacia Criminal
                </span>
              </div>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Defesa criminal especializada com ética, sigilo e dedicação. 
              Atuamos em todo o Brasil com atendimento humanizado.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif text-lg font-semibold mb-6 text-foreground">
              Links Rápidos
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/", label: "Início" },
                { href: "/#sobre", label: "Sobre o Escritório" },
                { href: "/#atuacao", label: "Áreas de Atuação" },
                { href: "/blog", label: "Blog Jurídico" },
                { href: "/#contato", label: "Contato" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-muted-foreground hover:text-gold transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Practice Areas */}
          <div>
            <h4 className="font-serif text-lg font-semibold mb-6 text-foreground">
              Áreas de Atuação
            </h4>
            <ul className="space-y-3">
              {[
                "Direito Penal",
                "Defesa Criminal",
                "Habeas Corpus",
                "Audiência de Custódia",
                "Execução Penal",
              ].map((area) => (
                <li key={area}>
                  <span className="text-muted-foreground text-sm">{area}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-serif text-lg font-semibold mb-6 text-foreground">
              Contato
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm">
                  Av. Paulista, 1000 - Sala 1010<br />
                  São Paulo, SP - Brasil
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gold flex-shrink-0" />
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-gold transition-colors text-sm"
                >
                  (00) 00000-0000
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gold flex-shrink-0" />
                <a
                  href="mailto:contato@lindombertomoraes.adv.br"
                  className="text-muted-foreground hover:text-gold transition-colors text-sm"
                >
                  contato@lindombertomoraes.adv.br
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gold flex-shrink-0" />
                <span className="text-muted-foreground text-sm">
                  Seg - Sex: 9h às 18h
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm text-center md:text-left">
            © {new Date().getFullYear()} Lindomberto Moraes Advocacia Criminal. Todos os direitos reservados.
          </p>
          <p className="text-muted-foreground text-sm">
            OAB/SP 000.000
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
