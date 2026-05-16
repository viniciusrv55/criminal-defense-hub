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
import ProtectedRoute from "./components/admin/ProtectedRoute";
import SuperAdminRoute from "./components/admin/SuperAdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            <Route path="/admin/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/admin/advogados-destaque" element={<ProtectedRoute><FeaturedAttorneysAdmin /></ProtectedRoute>} />
            <Route path="/admin/attorneys" element={<ProtectedRoute><Attorneys /></ProtectedRoute>} />
            <Route path="/admin/equipe" element={<ProtectedRoute><Team /></ProtectedRoute>} />
            <Route path="/admin/contratos" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
            <Route path="/admin/contratos/:id" element={<ProtectedRoute><ContractForm /></ProtectedRoute>} />
            <Route path="/admin/documentos" element={<ProtectedRoute><DocumentTemplates /></ProtectedRoute>} />
            <Route path="/admin/documentos/:id" element={<ProtectedRoute><DocumentTemplateForm /></ProtectedRoute>} />
            <Route path="/admin/atendimento" element={<ProtectedRoute><Atendimento /></ProtectedRoute>} />
            <Route path="/admin/agentes-ia" element={<ProtectedRoute><AiAgents /></ProtectedRoute>} />
            <Route path="/admin/whatsapp" element={<ProtectedRoute><WhatsAppInstances /></ProtectedRoute>} />
            <Route path="/admin/plataforma" element={<SuperAdminRoute><PlatformSettings /></SuperAdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
