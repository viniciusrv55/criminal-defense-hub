import AdminLayout from '@/components/admin/AdminLayout';
import FinancialWidgets from '@/components/admin/dashboard/FinancialWidgets';
import DashboardCharts from '@/components/admin/dashboard/DashboardCharts';
import WeeklyAgendaWidget from '@/components/admin/dashboard/WeeklyAgendaWidget';

const Dashboard = () => {
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
      </div>
      <DashboardCharts />
      <FinancialWidgets />
      <WeeklyAgendaWidget />
    </AdminLayout>
  );
};

export default Dashboard;
