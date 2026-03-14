import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/blog', label: 'Blog Posts', icon: FileText },
  { href: '/admin/areas', label: 'Áreas de Atuação', icon: Briefcase },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profileName, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const isActive = (href: string) => {
    if (href === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-muted/30 light">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-card border-b border-border">
        <button onClick={() => setSidebarOpen(true)} className="p-2">
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <span className="font-serif font-semibold text-foreground">Painel Admin</span>
        <div className="w-9" />
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-50 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <Link to="/admin" className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/15">
                  <Scale className="w-5 h-5 text-accent" />
                </div>
                <div className="flex flex-col">
                  <span className="font-serif font-semibold text-sm text-foreground">
                    Admin
                  </span>
                  <span className="text-xs text-muted-foreground">Painel de Controle</span>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {isActive(item.href) && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </Link>
            ))}
          </nav>

          {/* User info + logout */}
          <div className="p-4 border-t border-border">
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-foreground truncate">
                {profileName ?? user?.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
