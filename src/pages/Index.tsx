import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import HeroSection from "@/components/home/HeroSection";
import AboutSection from "@/components/home/AboutSection";
import PracticeAreasSection from "@/components/home/PracticeAreasSection";
import DifferentialsSection from "@/components/home/DifferentialsSection";
import CTASection from "@/components/home/CTASection";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Lindomberto Moraes - Advocacia Criminal | Advogado Criminalista SP</title>
        <meta 
          name="description" 
          content="Escritório de advocacia criminal especializado em defesa penal, habeas corpus, audiência de custódia e execução penal. Atendimento 24h com sigilo absoluto. São Paulo e todo Brasil." 
        />
        <meta 
          name="keywords" 
          content="advogado criminalista, advocacia criminal, defesa criminal, habeas corpus, audiência de custódia, prisão em flagrante, execução penal, São Paulo" 
        />
        <link rel="canonical" href="https://lindombertomoraes.adv.br" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Lindomberto Moraes - Advocacia Criminal" />
        <meta property="og:description" content="Escritório de advocacia criminal especializado. Defesa penal com ética, sigilo e dedicação." />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        
        {/* JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LegalService",
            "name": "Lindomberto Moraes - Advocacia Criminal",
            "description": "Escritório de advocacia especializado em Direito Criminal",
            "url": "https://lindombertomoraes.adv.br",
            "telephone": "+55-00-00000-0000",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Av. Paulista, 1000 - Sala 1010",
              "addressLocality": "São Paulo",
              "addressRegion": "SP",
              "postalCode": "01310-100",
              "addressCountry": "BR"
            },
            "priceRange": "$$",
            "openingHours": "Mo-Fr 09:00-18:00",
            "areaServed": "BR",
            "serviceType": ["Criminal Defense", "Criminal Law", "Habeas Corpus"]
          })}
        </script>
      </Helmet>

      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <PracticeAreasSection />
        <DifferentialsSection />
        <CTASection />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default Index;
