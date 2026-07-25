import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { PublicLayout } from '@/components/layout/public-layout';
import { AuthLayout } from '@/components/layout/auth-layout';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { StudioLayout } from '@/components/layout/studio-layout';
import { AdminLayout } from '@/components/layout/admin-layout';

// Public Pages
import Home from '@/pages/public/home';
import Search from '@/pages/public/search';
import UniversityDetail from '@/pages/public/university-detail';
import ListingDetail from '@/pages/public/listing-detail';
import Storefront from '@/pages/public/storefront';

// Auth Pages
import Login from '@/pages/auth/login';
import Register from '@/pages/auth/register';
import ForgotPassword from '@/pages/auth/forgot-password';
import ResetPassword from '@/pages/auth/reset-password';
import MagicLinkSent from '@/pages/auth/magic-link-sent';
import VerifyEmail from '@/pages/auth/verify-email';

// Checkout Pages
import Checkout from '@/pages/checkout/checkout';
import CheckoutSuccess, { CheckoutCancel } from '@/pages/checkout/success';

// Creator Apply Pages
import Apply, { ApplyStatus } from '@/pages/apply/apply';

// Static / Policy Pages
import { Trust, FAQs, Privacy, Terms, Cookies } from '@/pages/public/policies';

// Learner Pages
import Dashboard from '@/pages/learner/dashboard';
import Bookings from '@/pages/learner/bookings';
import Library from '@/pages/learner/library';
import Subscriptions from '@/pages/learner/subscriptions';
import Messages from '@/pages/learner/messages';
import Orders from '@/pages/learner/orders';
import Profile from '@/pages/learner/profile';

// Creator Studio Pages
import StudioOverview from '@/pages/creator/studio-overview';
import StudioListings from '@/pages/creator/studio-listings';
import StudioStorefront from '@/pages/creator/studio-storefront';
import StudioAvailability from '@/pages/creator/studio-availability';
import StudioBookings from '@/pages/creator/studio-bookings';
import StudioEarnings from '@/pages/creator/studio-earnings';
import StudioMessages from '@/pages/creator/studio-messages';
import StudioSettings from '@/pages/creator/studio-settings';
import StudioSubscribers from '@/pages/creator/studio-subscribers';

// Admin Pages
import AdminDashboard from '@/pages/admin/admin-dashboard';
import AdminApplications from '@/pages/admin/admin-applications';
import AdminListings from '@/pages/admin/admin-listings';
import AdminUsers from '@/pages/admin/admin-users';
import AdminOrders from '@/pages/admin/admin-orders';
import AdminReports from '@/pages/admin/admin-reports';
import AdminAuditLogs from '@/pages/admin/admin-audit-logs';
import AdminCommission from '@/pages/admin/admin-commission';
import AdminSettings from '@/pages/admin/admin-settings';
import AdminUniversities from '@/pages/admin/admin-universities';
import AdminUniversityDetail from '@/pages/admin/admin-university-detail';

import { HowItWorks, BecomeACreator } from '@/pages/public/static';
import StudentProfilePage from '@/pages/public/student-profile';
import NotFound from './pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Auth Routes */}
      <Route path="/auth/login">
        <AuthLayout><Login /></AuthLayout>
      </Route>
      <Route path="/auth/register">
        <AuthLayout><Register /></AuthLayout>
      </Route>
      <Route path="/auth/forgot-password">
        <AuthLayout><ForgotPassword /></AuthLayout>
      </Route>
      <Route path="/auth/reset-password">
        <AuthLayout><ResetPassword /></AuthLayout>
      </Route>
      <Route path="/auth/magic-link-sent">
        <AuthLayout><MagicLinkSent /></AuthLayout>
      </Route>
      <Route path="/auth/verify-email">
        <AuthLayout><VerifyEmail /></AuthLayout>
      </Route>

      {/* Checkout Flow */}
      <Route path="/checkout">
        <PublicLayout><Checkout /></PublicLayout>
      </Route>
      <Route path="/checkout/success">
        <PublicLayout><CheckoutSuccess /></PublicLayout>
      </Route>
      <Route path="/checkout/cancel">
        <PublicLayout><CheckoutCancel /></PublicLayout>
      </Route>

      {/* Apply Flow */}
      <Route path="/apply">
        <PublicLayout><Apply /></PublicLayout>
      </Route>
      <Route path="/apply/status">
        <PublicLayout><ApplyStatus /></PublicLayout>
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <AdminLayout><AdminDashboard /></AdminLayout>
      </Route>
      <Route path="/admin/applications">
        <AdminLayout><AdminApplications /></AdminLayout>
      </Route>
      <Route path="/admin/listings">
        <AdminLayout><AdminListings /></AdminLayout>
      </Route>
      <Route path="/admin/users">
        <AdminLayout><AdminUsers /></AdminLayout>
      </Route>
      <Route path="/admin/orders">
        <AdminLayout><AdminOrders /></AdminLayout>
      </Route>
      <Route path="/admin/reports">
        <AdminLayout><AdminReports /></AdminLayout>
      </Route>
      <Route path="/admin/audit-logs">
        <AdminLayout><AdminAuditLogs /></AdminLayout>
      </Route>
      <Route path="/admin/commission">
        <AdminLayout><AdminCommission /></AdminLayout>
      </Route>
      <Route path="/admin/settings">
        <AdminLayout><AdminSettings /></AdminLayout>
      </Route>
      <Route path="/admin/universities">
        <AdminLayout><AdminUniversities /></AdminLayout>
      </Route>
      <Route path="/admin/universities/:slug">
        {(params: { slug: string }) => (
          <AdminLayout><AdminUniversityDetail slug={params.slug} /></AdminLayout>
        )}
      </Route>

      {/* Creator Studio Routes */}
      <Route path="/studio">
        <StudioLayout><StudioOverview /></StudioLayout>
      </Route>
      <Route path="/studio/listings">
        <StudioLayout><StudioListings /></StudioLayout>
      </Route>
      <Route path="/studio/storefront">
        <StudioLayout><StudioStorefront /></StudioLayout>
      </Route>
      <Route path="/studio/availability">
        <StudioLayout><StudioAvailability /></StudioLayout>
      </Route>
      <Route path="/studio/bookings">
        <StudioLayout><StudioBookings /></StudioLayout>
      </Route>
      <Route path="/studio/earnings">
        <StudioLayout><StudioEarnings /></StudioLayout>
      </Route>
      <Route path="/studio/messages">
        <StudioLayout><StudioMessages /></StudioLayout>
      </Route>
      <Route path="/studio/settings">
        <StudioLayout><StudioSettings /></StudioLayout>
      </Route>
      <Route path="/studio/subscribers">
        <StudioLayout><StudioSubscribers /></StudioLayout>
      </Route>

      {/* Learner Dashboard Routes */}
      <Route path="/dashboard">
        <DashboardLayout><Dashboard /></DashboardLayout>
      </Route>
      <Route path="/bookings">
        <DashboardLayout><Bookings /></DashboardLayout>
      </Route>
      <Route path="/library">
        <DashboardLayout><Library /></DashboardLayout>
      </Route>
      <Route path="/messages">
        <DashboardLayout><Messages /></DashboardLayout>
      </Route>
      <Route path="/orders">
        <DashboardLayout><Orders /></DashboardLayout>
      </Route>
      <Route path="/profile">
        <DashboardLayout><Profile /></DashboardLayout>
      </Route>
      <Route path="/subscriptions">
        <DashboardLayout><Subscriptions /></DashboardLayout>
      </Route>

      {/* Public Routes */}
      <Route path="/">
        <PublicLayout><Home /></PublicLayout>
      </Route>
      <Route path="/search">
        <PublicLayout><Search /></PublicLayout>
      </Route>
      <Route path="/universities/:slug">
        <PublicLayout><UniversityDetail /></PublicLayout>
      </Route>
      <Route path="/listings/:id">
        <PublicLayout><ListingDetail /></PublicLayout>
      </Route>
      <Route path="/storefronts/:slug">
        <PublicLayout><Storefront /></PublicLayout>
      </Route>

      <Route path="/students/:id">
        <PublicLayout><StudentProfilePage /></PublicLayout>
      </Route>

      <Route path="/how-it-works">
        <PublicLayout><HowItWorks /></PublicLayout>
      </Route>
      <Route path="/become-a-creator">
        <PublicLayout><BecomeACreator /></PublicLayout>
      </Route>
      <Route path="/trust">
        <PublicLayout><Trust /></PublicLayout>
      </Route>
      <Route path="/faqs">
        <PublicLayout><FAQs /></PublicLayout>
      </Route>
      <Route path="/privacy">
        <PublicLayout><Privacy /></PublicLayout>
      </Route>
      <Route path="/terms">
        <PublicLayout><Terms /></PublicLayout>
      </Route>
      <Route path="/cookies">
        <PublicLayout><Cookies /></PublicLayout>
      </Route>

      {/* 404 */}
      <Route>
        <PublicLayout><NotFound /></PublicLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
