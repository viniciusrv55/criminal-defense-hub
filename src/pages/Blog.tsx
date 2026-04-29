import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogCard from "@/components/blog/BlogCard";
import BlogSidebar from "@/components/blog/BlogSidebar";
import Breadcrumbs from "@/components/blog/Breadcrumbs";
import { useBlogPosts } from "@/hooks/useBlogPosts";
import { blogPosts as staticPosts } from "@/data/blogPosts";

const Blog = () => {
  const { posts: dbPosts, loading } = useBlogPosts();

  const posts = dbPosts.length > 0
    ? dbPosts.map((p) => ({
        slug: p.slug, title: p.title, excerpt: p.excerpt ?? '',
        date: new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
        readTime: '5 min de leitura', category: p.category ?? 'Artigo',
      }))
    : staticPosts;

  return (
    <>
      <Helmet>
        <title>Blog Jurídico | Lindomberto Moraes - Advocacia Criminal</title>
        <meta name="description" content="Artigos sobre Direito Criminal, habeas corpus, defesa penal, audiência de custódia e execução penal." />
        <link rel="canonical" href="https://lindombertomoraes.adv.br/blog" />
      </Helmet>

      <Header />
      <main className="pt-28 pb-16 bg-background">
        <div className="container-custom">
          <Breadcrumbs items={[{ label: "Blog" }]} />
          <div className="mb-12">
            <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">Blog Jurídico</span>
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Artigos sobre <span className="text-gradient-gold">Direito Criminal</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">Conteúdo informativo sobre seus direitos e o sistema de justiça criminal.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {posts.map(post => (
                  <BlogCard key={post.slug} slug={post.slug} title={post.title} excerpt={post.excerpt} date={post.date} readTime={post.readTime} category={post.category} />
                ))}
              </div>
              <div className="lg:col-span-1"><BlogSidebar /></div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Blog;
