import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import {
  LayoutDashboard, FileText, Briefcase, LogOut, Menu, X, Scale,
  Settings, UserCheck, FileSignature, ExternalLink, Smartphone, ShieldAlert, MessageSquare, Bot, Calendar, CalendarCog,
  UsersRound, KanbanSquare, Inbox, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profileName, user, isSuperAdmin, isAdmin } = useAuth();
  const { settings } = useSiteSettings();
  const admin = isAdmin();

  const navGroups: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
    {
      label: 'Geral',
      items: [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'CRM',
      items: [
        { href: '/admin/clientes', label: 'Clientes', icon: UsersRound },
        { href: '/admin/contratos', label: 'Contratos', icon: FileSignature },
        { href: '/admin/documentos', label: 'Gerador de Documentos', icon: FileText },
      ],
    },
    {
      label: 'Atendimento',
      items: [
        { href: '/admin/leads', label: 'Atendimento Kanban', icon: KanbanSquare },
        { href: '/admin/atendimento', label: 'Conversas', icon: MessageSquare },
        ...(admin ? [
          { href: '/admin/filas', label: 'Filas', icon: Inbox },
          { href: '/admin/agentes-ia', label: 'Agentes IA', icon: Bot },
          { href: '/admin/whatsapp', label: 'WhatsApp', icon: Smartphone },
        ] : []),
      ],
    },
    {
      label: 'Agenda',
      items: [
        { href: '/admin/agenda', label: 'Calendário', icon: Calendar },
        ...(admin ? [{ href: '/admin/agenda/config', label: 'Tipos & Disponibilidade', icon: CalendarCog }] : []),
      ],
    },
    {
      label: 'Conteúdo',
      items: [
        { href: '/admin/blog', label: 'Blog', icon: FileText },
        ...(admin ? [
          { href: '/admin/areas', label: 'Áreas de Atuação', icon: Briefcase },
          { href: '/admin/advogados-destaque', label: 'Advogados em Destaque', icon: UserCheck },
        ] : []),
      ],
    },
    {
      label: 'Administração',
      items: [
        ...(isSuperAdmin() ? [{ href: '/admin/equipe', label: 'Equipe', icon: UserCheck }] : []),
        ...(admin ? [{ href: '/admin/settings', label: 'Configurações', icon: Settings }] : []),
        ...(isSuperAdmin() ? [{ href: '/admin/plataforma', label: 'Plataforma', icon: ShieldAlert }] : []),
      ],
    },
  ].filter(g => g.items.length > 0);


  const handleLogout = async () => { await signOut(); navigate('/admin/login'); };

  const isActive = (href: string) => {
    if (href === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(href);
  };

  const initials = (profileName ?? user?.email ?? '?')
    .split(' ').slice(0, 2).map(s => s[0]?.toUpperCase()).join('');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile topbar */}
      <div className="lg:hidden flex items-center justify-between px-4 h-14 bg-card border-b border-border sticky top-0 z-30">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-foreground/80 hover:text-accent">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-accent" />
          <span className="font-serif text-sm tracking-wide">Lindomberto Moraes</span>
        </div>
        <div className="w-9" />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        bg-[hsl(0_0%_4%)] border-r border-[hsl(0_0%_12%)] text-[hsl(0_0%_92%)]
        flex flex-col`}
      >
        {/* Brand */}
        <div className="px-6 pt-6 pb-5 border-b border-[hsl(0_0%_12%)]">
          <div className="flex items-start justify-between">
            <Link to="/admin" className="flex items-center gap-3 group">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-11 w-auto object-contain" />
              ) : (
                <div className="h-11" aria-hidden />
              )}
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-[hsl(0_0%_60%)] hover:text-accent">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(0_0%_45%)]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                        ${active
                          ? 'bg-gradient-to-r from-accent/15 to-transparent text-accent font-medium'
                          : 'text-[hsl(0_0%_72%)] hover:text-[hsl(0_0%_98%)] hover:bg-[hsl(0_0%_8%)]'}`}
                    >
                      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 bg-accent rounded-r-full" />}
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-accent' : ''}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-[hsl(0_0%_12%)] p-4 space-y-3">
          <Link to="/" target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[hsl(0_0%_60%)] hover:text-accent hover:bg-[hsl(0_0%_8%)] transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Ver site público
          </Link>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-[hsl(37_45%_45%)] flex items-center justify-center text-[hsl(0_0%_5%)] font-semibold text-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[hsl(0_0%_95%)] truncate">{profileName ?? user?.email}</p>
              <p className="text-[11px] text-[hsl(0_0%_50%)] truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-[hsl(0_0%_70%)] hover:text-destructive hover:bg-destructive/10 border border-[hsl(0_0%_15%)] hover:border-destructive/40 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:ml-72 min-h-screen bg-[hsl(0_0%_98%)] text-[hsl(0_0%_8%)]">
        <div className="admin-surface p-6 lg:p-10 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
