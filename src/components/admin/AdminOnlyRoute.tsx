import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface AdminOnlyRouteProps {
  children: React.ReactNode;
}

/**
 * Restricts access to users with role 'admin' or 'super_admin'.
 * Non-admin team members are redirected to /admin (dashboard).
 */
const AdminOnlyRoute = ({ children }: AdminOnlyRouteProps) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin()) return <Navigate to="/admin" replace />;

  return <>{children}</>;
};

export default AdminOnlyRoute;
