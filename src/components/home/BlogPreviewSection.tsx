import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blogPosts } from "@/data/blogPosts";

const BlogPreviewSection = () => {
  // Pega os 3 artigos mais recentes
  const recentPosts = blogPosts.slice(0, 3);

  return (
    <section className="py-20 bg-white">
      <div className="container-custom">
        {/* Section Header */}
        <div className="text-center mb-12">
          <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">
            Blog Jurídico
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-black mb-4">
            Artigos sobre{" "}
            <span className="text-gradient-gold">Direito Criminal</span>
          </h2>
          <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
            Conteúdo informativo para você entender seus direitos e o funcionamento do sistema de justiça criminal.
          </p>
        </div>

        {/* Articles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {recentPosts.map((post) => (
            <article
              key={post.slug}
              className="group p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-gold/40 transition-all duration-300 hover-lift"
            >
              <div className="mb-4">
                <span className="inline-block px-3 py-1 text-xs font-medium text-gold bg-gold/10 rounded-full">
                  {post.category}
                </span>
              </div>

              <Link to={`/blog/${post.slug}`}>
                <h3 className="font-serif text-lg font-semibold text-black mb-3 group-hover:text-gold transition-colors line-clamp-2">
                  {post.title}
                </h3>
              </Link>

              <p className="text-neutral-500 text-sm mb-4 line-clamp-3 leading-relaxed">
                {post.excerpt}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readTime}
                  </span>
                </div>

                <Link
                  to={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-hover transition-colors"
                >
                  Ler
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* CTA to Blog */}
        <div className="text-center">
          <Button asChild variant="outline-gold" size="lg">
            <Link to="/blog" className="inline-flex items-center gap-2">
              Ver todos os artigos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default BlogPreviewSection;
