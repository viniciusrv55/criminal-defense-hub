import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-helpers';
import type { BlogPostDB } from '@/types/database';

export function useBlogPosts() {
  const [posts, setPosts] = useState<BlogPostDB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await db.from('blog_posts').select('*').eq('published', true).order('created_at', { ascending: false });
      setPosts(data ?? []);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  return { posts, loading };
}

export function useBlogPost(slug: string | undefined) {
  const [post, setPost] = useState<BlogPostDB | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    const fetchPost = async () => {
      const { data } = await db.from('blog_posts').select('*').eq('slug', slug).eq('published', true).single();
      setPost(data ?? null);
      setLoading(false);
    };
    fetchPost();
  }, [slug]);

  return { post, loading };
}

export function useBlogGallery(postId: string | undefined) {
  const [images, setImages] = useState<Array<{ id: string; image_url: string; caption: string | null }>>([]);

  useEffect(() => {
    if (!postId) return;
    db.from('blog_images').select('id, image_url, caption').eq('post_id', postId).order('sort_order')
      .then(({ data }: { data: any }) => setImages(data ?? []));
  }, [postId]);

  return images;
}
