import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BlogCard from "@/components/blog/BlogCard";
import BlogSidebar from "@/components/blog/BlogSidebar";
import Breadcrumbs from "@/components/blog/Breadcrumbs";
import { blogPosts } from "@/data/blogPosts";

const Blog = () => {
  return (
    <>
      <Helmet>
        <title>Blog Jurídico | Lindomberto Moraes - Advocacia Criminal</title>
        <meta 
          name="description" 
          content="Artigos sobre Direito Criminal, habeas corpus, defesa penal, audiência de custódia e execução penal. Informação jurídica de qualidade pelo advogado Lindomberto Moraes." 
        />
        <meta 
          name="keywords" 
          content="blog direito criminal, artigos jurídicos, habeas corpus, defesa criminal, advogado criminalista blog" 
        />
        <link rel="canonical" href="https://lindombertomoraes.adv.br/blog" />
      </Helmet>

      <Header />
      
      <main className="pt-28 pb-16 bg-white">
        <div className="container-custom">
          <Breadcrumbs items={[{ label: "Blog" }]} />

          {/* Page Header */}
          <div className="mb-12">
            <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">
              Blog Jurídico
            </span>
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Artigos sobre{" "}
              <span className="text-gradient-gold">Direito Criminal</span>
            </h1>
            <p className="text-neutral-600 text-lg max-w-2xl">
              Conteúdo informativo sobre seus direitos, processos criminais e 
              orientações jurídicas para você entender melhor o sistema de justiça.
            </p>
          </div>

          {/* Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Posts */}
            <div className="lg:col-span-2 space-y-6">
              {blogPosts.map((post) => (
                <BlogCard
                  key={post.slug}
                  slug={post.slug}
                  title={post.title}
                  excerpt={post.excerpt}
                  date={post.date}
                  readTime={post.readTime}
                  category={post.category}
                />
              ))}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <BlogSidebar />
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default Blog;
