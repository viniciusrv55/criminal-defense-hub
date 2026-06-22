import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Contact from "./pages/Contact";
import PracticeAreaDetail from "./pages/PracticeAreaDetail";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import BlogPosts from "./pages/admin/BlogPosts";
import BlogPostForm from "./pages/admin/BlogPostForm";
import PracticeAreasAdmin from "./pages/admin/PracticeAreas";
import Leads from "./pages/admin/Leads";
import Settings from "./pages/admin/Settings";
import Attorneys from "./pages/admin/Attorneys";
import Team from "./pages/admin/Team";
import PracticeAreas from "./pages/PracticeAreas";
import Contracts from "./pages/admin/Contracts";
import ContractForm from "./pages/admin/ContractForm";
import ClientPortal from "./pages/ClientPortal";
import FeaturedAttorneysAdmin from "./pages/admin/FeaturedAttorneys";
import DocumentTemplates from "./pages/admin/DocumentTemplates";
import DocumentTemplateForm from "./pages/admin/DocumentTemplateForm";
import PlatformSettings from "./pages/admin/PlatformSettings";
import WhatsAppInstances from "./pages/admin/WhatsAppInstances";
import Atendimento from "./pages/admin/Atendimento";
import AiAgents from "./pages/admin/AiAgents";
import Agenda from "./pages/admin/Agenda";
import AgendaConfig from "./pages/admin/AgendaConfig";
import Campaigns from "./pages/admin/Campaigns";
import CampaignTemplates from "./pages/admin/CampaignTemplates";
import CampaignAudiences from "./pages/admin/CampaignAudiences";
import Queues from "./pages/admin/Queues";
import Clients from "./pages/admin/Clients";
import ProtectedRoute from "./components/admin/ProtectedRoute";
import SuperAdminRoute from "./components/admin/SuperAdminRoute";
import AdminOnlyRoute from "./components/admin/AdminOnlyRoute";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/contato" element={<Contact />} />
            <Route path="/areas-de-atuacao" element={<PracticeAreas />} />
            <Route path="/areas/:slug" element={<PracticeAreaDetail />} />
            <Route path="/portal" element={<ClientPortal />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin/blog" element={<ProtectedRoute><BlogPosts /></ProtectedRoute>} />
            <Route path="/admin/blog/:id" element={<ProtectedRoute><BlogPostForm /></ProtectedRoute>} />
            <Route path="/admin/areas" element={<ProtectedRoute><PracticeAreasAdmin /></ProtectedRoute>} />
            <Route path="/admin/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<AdminOnlyRoute><Settings /></AdminOnlyRoute>} />
            <Route path="/admin/advogados-destaque" element={<AdminOnlyRoute><FeaturedAttorneysAdmin /></AdminOnlyRoute>} />
            <Route path="/admin/areas" element={<AdminOnlyRoute><PracticeAreasAdmin /></AdminOnlyRoute>} />
            <Route path="/admin/attorneys" element={<AdminOnlyRoute><Attorneys /></AdminOnlyRoute>} />
            <Route path="/admin/equipe" element={<SuperAdminRoute><Team /></SuperAdminRoute>} />
            <Route path="/admin/contratos" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
            <Route path="/admin/clientes" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/admin/contratos/:id" element={<ProtectedRoute><ContractForm /></ProtectedRoute>} />
            <Route path="/admin/documentos" element={<ProtectedRoute><DocumentTemplates /></ProtectedRoute>} />
            <Route path="/admin/documentos/:id" element={<ProtectedRoute><DocumentTemplateForm /></ProtectedRoute>} />
            <Route path="/admin/atendimento" element={<ProtectedRoute><Atendimento /></ProtectedRoute>} />
            <Route path="/admin/agentes-ia" element={<AdminOnlyRoute><AiAgents /></AdminOnlyRoute>} />
            <Route path="/admin/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
            <Route path="/admin/agenda/config" element={<AdminOnlyRoute><AgendaConfig /></AdminOnlyRoute>} />
            <Route path="/admin/campanhas" element={<AdminOnlyRoute><Campaigns /></AdminOnlyRoute>} />
            <Route path="/admin/campanhas/templates" element={<AdminOnlyRoute><CampaignTemplates /></AdminOnlyRoute>} />
            <Route path="/admin/campanhas/publicos" element={<AdminOnlyRoute><CampaignAudiences /></AdminOnlyRoute>} />
            <Route path="/admin/whatsapp" element={<AdminOnlyRoute><WhatsAppInstances /></AdminOnlyRoute>} />
            <Route path="/admin/filas" element={<AdminOnlyRoute><Queues /></AdminOnlyRoute>} />
            <Route path="/admin/plataforma" element={<SuperAdminRoute><PlatformSettings /></SuperAdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
