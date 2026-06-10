import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminOnlyRoute } from "@/components/AdminOnlyRoute";
import { PermissionProtectedRoute } from "@/components/PermissionGate";

// Pages
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Layouts
import SuperAdminLayout from "./components/layouts/SuperAdminLayout";
import DashboardLayout from "./components/layouts/DashboardLayout";

// Super Admin Pages
import SuperAdminDashboard from "./pages/super-admin/Dashboard";
import OrganizationsPage from "./pages/super-admin/Organizations";
import UsersPage from "./pages/super-admin/Users";
import PlansPage from "./pages/super-admin/Plans";
import StripeSettingsPage from "./pages/super-admin/StripeSettings";
import SuperAdminSettings from "./pages/super-admin/Settings";
import SuperAdminProfile from "./pages/super-admin/Profile";
import AuditLogPage from "./pages/super-admin/AuditLog";

import ChatbotAnalyticsPage from "./pages/super-admin/ChatbotAnalytics";



// Org Dashboard Pages
import OrgDashboard from "./pages/dashboard/Dashboard";
import DocumentsPage from "./pages/dashboard/Documents";
import OrgUsersPage from "./pages/dashboard/Users";
import DepartmentsPage from "./pages/dashboard/Departments";
import BillingPage from "./pages/dashboard/Billing";
import PaymentSuccessPage from "./pages/dashboard/PaymentSuccess";
import PaymentCanceledPage from "./pages/dashboard/PaymentCanceled";
import CancelSubscriptionPage from "./pages/dashboard/CancelSubscription";
import ReactivateSubscriptionPage from "./pages/dashboard/ReactivateSubscription";
import PauseSubscriptionPage from "./pages/dashboard/PauseSubscription";
import ResumeFromPausePage from "./pages/dashboard/ResumeFromPause";
import OrgSettingsPage from "./pages/dashboard/Settings";
import OrgProfilePage from "./pages/dashboard/Profile";
import PermissionsPage from "./pages/dashboard/Permissions";
import DocumentTypesPage from "./pages/dashboard/DocumentTypes";
import FavoritesPage from "./pages/dashboard/Favorites";
import RecentPage from "./pages/dashboard/Recent";
import TermsPage from "./pages/dashboard/Terms";
import PrivacyPage from "./pages/dashboard/Privacy";
import LegalPage from "./pages/super-admin/Legal";
import AboutPage from "./pages/dashboard/About";
import SuperAdminAboutPage from "./pages/super-admin/About";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

const App = () => {
  useEffect(() => {
    const noop = () => {};
    document.body.addEventListener('pointerdown', noop, { passive: true });
    return () => document.body.removeEventListener('pointerdown', noop);
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/auth" replace />} />

            {/* Super Admin Routes */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SuperAdminDashboard />} />
              <Route path="organizations" element={<OrganizationsPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="stripe" element={<StripeSettingsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="legal" element={<LegalPage />} />
              <Route path="settings" element={<SuperAdminSettings />} />
              <Route path="profile" element={<SuperAdminProfile />} />
              <Route path="audit" element={<AuditLogPage />} />
              
              <Route path="chatbot-analytics" element={<ChatbotAnalyticsPage />} />
              <Route path="about" element={<SuperAdminAboutPage />} />
            </Route>

            {/* Organization Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={["org_admin", "user"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OrgDashboard />} />
              <Route 
                path="documents" 
                element={
                  <PermissionProtectedRoute permission="visualizar_documento">
                    <DocumentsPage />
                  </PermissionProtectedRoute>
                } 
              />
              <Route 
                path="favorites" 
                element={
                  <PermissionProtectedRoute permission="visualizar_documento">
                    <FavoritesPage />
                  </PermissionProtectedRoute>
                } 
              />
              <Route 
                path="recent" 
                element={
                  <PermissionProtectedRoute permission="visualizar_documento">
                    <RecentPage />
                  </PermissionProtectedRoute>
                } 
              />
              <Route path="departments" element={<AdminOnlyRoute><DepartmentsPage /></AdminOnlyRoute>} />
              <Route path="users" element={<AdminOnlyRoute><OrgUsersPage /></AdminOnlyRoute>} />
              <Route path="permissions" element={<AdminOnlyRoute><PermissionsPage /></AdminOnlyRoute>} />
              <Route path="document-types" element={<AdminOnlyRoute><DocumentTypesPage /></AdminOnlyRoute>} />
              <Route path="billing" element={<AdminOnlyRoute><BillingPage /></AdminOnlyRoute>} />
              <Route path="payment-success" element={<AdminOnlyRoute><PaymentSuccessPage /></AdminOnlyRoute>} />
              <Route path="payment-canceled" element={<AdminOnlyRoute><PaymentCanceledPage /></AdminOnlyRoute>} />
              <Route path="cancel-subscription" element={<AdminOnlyRoute><CancelSubscriptionPage /></AdminOnlyRoute>} />
              <Route path="reactivate-subscription" element={<AdminOnlyRoute><ReactivateSubscriptionPage /></AdminOnlyRoute>} />
              <Route path="pause-subscription" element={<AdminOnlyRoute><PauseSubscriptionPage /></AdminOnlyRoute>} />
              <Route path="resume-from-pause" element={<AdminOnlyRoute><ResumeFromPausePage /></AdminOnlyRoute>} />
              <Route path="settings" element={<OrgSettingsPage />} />
              <Route path="profile" element={<OrgProfilePage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="about" element={<AboutPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
