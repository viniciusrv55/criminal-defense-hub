import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

const SuperAdminRoute = ({ children }: SuperAdminRouteProps) => {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
      </div>
    );
  }

  if (!user || !isSuperAdmin()) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default SuperAdminRoute;
