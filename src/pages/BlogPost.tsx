import { useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BlogSidebar from "@/components/blog/BlogSidebar";
import Breadcrumbs from "@/components/blog/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { getPostBySlug } from "@/data/blogPosts";
import { Calendar, Clock, Phone, User } from "lucide-react";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const whatsappLink = "https://wa.me/5500000000000?text=Olá, gostaria de falar com um advogado criminalista.";

  return (
    <>
      <Helmet>
        <title>{post.title} | Lindomberto Moraes - Advocacia Criminal</title>
        <meta name="description" content={post.metaDescription} />
        <link rel="canonical" href={`https://lindombertomoraes.adv.br/blog/${post.slug}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.metaDescription} />
        <meta property="og:type" content="article" />
        
        {/* Article structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": post.metaDescription,
            "author": {
              "@type": "Person",
              "name": "Lindomberto Moraes"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Lindomberto Moraes - Advocacia Criminal"
            },
            "datePublished": post.date
          })}
        </script>
      </Helmet>

      <Header />
      
      <main className="pt-28 pb-16">
        <div className="container-custom">
          <Breadcrumbs 
            items={[
              { label: "Blog", href: "/blog" },
              { label: post.title }
            ]} 
          />

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Article Content */}
            <article className="lg:col-span-2">
              {/* Article Header */}
              <header className="mb-8">
                <span className="inline-block px-3 py-1 text-xs font-medium text-gold bg-gold/10 rounded-full mb-4">
                  {post.category}
                </span>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                  {post.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Dr. Lindomberto Moraes
                  </span>
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {post.readTime}
                  </span>
                </div>
              </header>

              {/* Article Body */}
              <div className="prose prose-invert prose-lg max-w-none">
                {post.content.split('\n\n').map((paragraph, index) => {
                  if (paragraph.startsWith('## ')) {
                    return (
                      <h2 key={index} className="font-serif text-2xl font-bold text-foreground mt-8 mb-4">
                        {paragraph.replace('## ', '')}
                      </h2>
                    );
                  }
                  if (paragraph.startsWith('- **')) {
                    const items = paragraph.split('\n').filter(Boolean);
                    return (
                      <ul key={index} className="space-y-3 my-6">
                        {items.map((item, i) => {
                          const match = item.match(/- \*\*(.+?)\*\*: (.+)/);
                          if (match) {
                            return (
                              <li key={i} className="flex items-start gap-3 text-muted-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-gold mt-2.5 flex-shrink-0" />
                                <span>
                                  <strong className="text-foreground">{match[1]}</strong>: {match[2]}
                                </span>
                              </li>
                            );
                          }
                          return (
                            <li key={i} className="flex items-start gap-3 text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-gold mt-2.5 flex-shrink-0" />
                              <span>{item.replace(/^- /, '')}</span>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  }
                  if (paragraph.startsWith('1. ')) {
                    const items = paragraph.split('\n').filter(Boolean);
                    return (
                      <ol key={index} className="space-y-3 my-6 list-decimal list-inside">
                        {items.map((item, i) => {
                          const text = item.replace(/^\d+\. \*\*(.+?)\*\*: (.+)/, '$1: $2').replace(/^\d+\. /, '');
                          return (
                            <li key={i} className="text-muted-foreground">
                              {text}
                            </li>
                          );
                        })}
                      </ol>
                    );
                  }
                  if (paragraph.trim()) {
                    return (
                      <p key={index} className="text-muted-foreground leading-relaxed my-4">
                        {paragraph}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Article CTA */}
              <div className="mt-12 p-8 rounded-2xl bg-card border border-border">
                <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                  Precisa de orientação jurídica?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Se você tem dúvidas sobre seu caso ou precisa de assistência jurídica especializada, 
                  entre em contato conosco. Atendimento sigiloso e humanizado.
                </p>
                <Button variant="whatsapp" size="lg" asChild>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Phone className="w-4 h-4" />
                    Falar com um Advogado
                  </a>
                </Button>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="lg:col-span-1">
              <BlogSidebar />
            </aside>
          </div>
        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default BlogPost;
