import { useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BlogSidebar from "@/components/blog/BlogSidebar";
import Breadcrumbs from "@/components/blog/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { useBlogPost, useBlogGallery } from "@/hooks/useBlogPosts";
import { getPostBySlug } from "@/data/blogPosts";
import { Calendar, Clock, Phone, User } from "lucide-react";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { post: dbPost, loading } = useBlogPost(slug);
  const galleryImages = useBlogGallery(dbPost?.id);

  // Fallback to static
  const staticPost = slug ? getPostBySlug(slug) : undefined;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
      </div>
    );
  }

  const post = dbPost
    ? {
        title: dbPost.title,
        slug: dbPost.slug,
        excerpt: dbPost.excerpt ?? '',
        content: dbPost.content ?? '',
        date: new Date(dbPost.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
        readTime: '5 min de leitura',
        category: dbPost.category ?? 'Artigo',
        metaDescription: dbPost.meta_description ?? dbPost.excerpt ?? '',
        featured_image_url: dbPost.featured_image_url,
      }
    : staticPost
    ? { ...staticPost, featured_image_url: null }
    : null;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  

  return (
    <>
      <Helmet>
        <title>{post.title} | Lindomberto Moraes - Advocacia Criminal</title>
        <meta name="description" content={post.metaDescription} />
        <link rel="canonical" href={`https://lindombertomoraes.adv.br/blog/${post.slug}`} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.metaDescription} />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.metaDescription,
            author: { "@type": "Person", name: "Lindomberto Moraes" },
            publisher: { "@type": "Organization", name: "Lindomberto Moraes - Advocacia Criminal" },
            datePublished: post.date,
          })}
        </script>
      </Helmet>

      <Header />

      <main className="pt-28 pb-16">
        <div className="container-custom">
          <Breadcrumbs
            items={[
              { label: "Blog", href: "/blog" },
              { label: post.title },
            ]}
          />

          <div className="grid lg:grid-cols-3 gap-8">
            <article className="lg:col-span-2">
              <header className="mb-8">
                <span className="inline-block px-3 py-1 text-xs font-medium text-gold bg-gold/10 rounded-full mb-4">
                  {post.category}
                </span>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                  {post.title}
                </h1>

                {post.featured_image_url && (
                  <img
                    src={post.featured_image_url}
                    alt={post.title}
                    className="w-full h-64 md:h-80 object-cover rounded-xl mb-6"
                  />
                )}

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
                                <span><strong className="text-foreground">{match[1]}</strong>: {match[2]}</span>
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
                          return <li key={i} className="text-muted-foreground">{text}</li>;
                        })}
                      </ol>
                    );
                  }
                  if (paragraph.trim()) {
                    return <p key={index} className="text-muted-foreground leading-relaxed my-4">{paragraph}</p>;
                  }
                  return null;
                })}
              </div>

              {/* Gallery */}
              {galleryImages.length > 0 && (
                <div className="mt-10">
                  <h3 className="font-serif text-xl font-semibold text-foreground mb-4">Galeria</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {galleryImages.map((img) => (
                      <img
                        key={img.id}
                        src={img.image_url}
                        alt={img.caption ?? ''}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}

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
