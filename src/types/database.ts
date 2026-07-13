export type AppRole = 'super_admin' | 'admin' | 'attorney' | 'team_member' | 'client';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface BlogPostDB {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image_url: string | null;
  category: string | null;
  meta_description: string | null;
  published: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogImage {
  id: string;
  post_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface PracticeArea {
  id: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  icon_svg: string | null;
  icon_color: string;
  sort_order: number;
  active: boolean;
  slug: string | null;
  subtitle: string | null;
  cover_image_url: string | null;
  content: string | null;
  gallery: string[];
  featured: boolean;
  whatsapp_message: string | null;
  cta_button_text: string | null;
  youtube_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteSetting {
  id: string;
  key: string;
  value: string | null;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  practice_area_id: string | null;
  message: string | null;
  status: string;
  assigned_attorney_id: string | null;
  kanban_status: string;
  responsible_ids: string[];
  client_id: string | null;
  whatsapp_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadHistory {
  id: string;
  lead_id: string;
  action: string;
  description: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface AttorneyPermission {
  id: string;
  user_id: string;
  can_view: boolean;
  can_create: boolean;
  can_delete: boolean;
  practice_area_ids: string[];
  created_at: string;
  updated_at: string;
}
