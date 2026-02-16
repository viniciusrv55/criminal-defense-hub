import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";

interface BlogCardProps {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
}

const BlogCard = ({ slug, title, excerpt, date, readTime, category }: BlogCardProps) => {
  return (
    <article className="group p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-gold/40 transition-all duration-300 hover-lift">
      <div className="mb-4">
        <span className="inline-block px-3 py-1 text-xs font-medium text-gold bg-gold/10 rounded-full">
          {category}
        </span>
      </div>

      <Link to={`/blog/${slug}`}>
        <h2 className="font-serif text-xl font-semibold text-black mb-3 group-hover:text-gold transition-colors line-clamp-2">
          {title}
        </h2>
      </Link>

      <p className="text-neutral-600 mb-6 line-clamp-3 leading-relaxed">
        {excerpt}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {date}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {readTime}
          </span>
        </div>

        <Link
          to={`/blog/${slug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-hover transition-colors"
        >
          Ler mais
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </article>
  );
};

export default BlogCard;
