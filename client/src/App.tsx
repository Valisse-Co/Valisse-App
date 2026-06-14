import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import Splash from "./pages/Splash";
import Onboarding from "./pages/Onboarding";
import Discover from "./pages/Discover";
import PostDetail from "./pages/PostDetail";
import TechProfile from "./pages/TechProfile";
import Saved from "./pages/Saved";
import Bookings from "./pages/Bookings";
import BookingFlow from "./pages/BookingFlow";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import TechDashboard from "./pages/TechDashboard";
import CreatePost from "./pages/CreatePost";
import TechBookings from "./pages/TechBookings";
import Subscription from "./pages/Subscription";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import SettingsProfile from "./pages/SettingsProfile";
import SettingsNotifications from "./pages/SettingsNotifications";
import SettingsPrivacy from "./pages/SettingsPrivacy";
import SettingsAccount from "./pages/SettingsAccount";
import SettingsSubscription from "./pages/SettingsSubscription";
import SettingsAppearance from "./pages/SettingsAppearance";
import SettingsSupport from "./pages/SettingsSupport";
import { useAuth } from "./_core/hooks/useAuth";
import { DemoBar } from "./components/DemoBar";
import Notifications from "./pages/Notifications";
import AdminReports from "./pages/AdminReports";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ConsentStep from "./pages/ConsentStep";
import { trpc } from "./lib/trpc";

// Routes that are always accessible — even during re-consent flow
const PUBLIC_PATHS = ["/terms", "/privacy", "/login", "/", "/onboarding", "/404"];

// ─── Consent Gate ─────────────────────────────────────────────────────────────
// Shown to already-onboarded users who need to re-accept (e.g. after ToS bump).
// Legal pages (/terms, /privacy) bypass the gate so users can read before accepting.
function ConsentGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const utils = trpc.useUtils();

  const isPublicPath = PUBLIC_PATHS.some(p => location === p || location.startsWith(p + "/"));

  const consentQuery = trpc.users.getConsentStatus.useQuery(undefined, {
    enabled: Boolean(user?.onboardingCompleted) && !isPublicPath,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Public paths always pass through
  if (isPublicPath) return <>{children}</>;

  // Still loading auth or consent status
  if (loading || (user?.onboardingCompleted && consentQuery.isLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/manus-storage/valisse_logo_transparent_b005737c.png" alt="Valisse" className="w-14 h-14 object-contain" />
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // User is onboarded but hasn't accepted current ToS version
  if (user?.onboardingCompleted && consentQuery.data?.needsConsent) {
    return (
      <ConsentStep
        onComplete={() => utils.users.getConsentStatus.invalidate()}
      />
    );
  }

  return <>{children}</>;
}

function Router() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/manus-storage/valisse_logo_transparent_b005737c.png" alt="Valisse" className="w-14 h-14 object-contain" />
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <ConsentGate>
      <Switch>
        <Route path="/" component={Splash} />
        <Route path="/onboarding" component={Onboarding} />
        {/* Legal pages — always public, no auth or consent required */}
        <Route path="/terms" component={TermsOfService} />
        <Route path="/privacy" component={PrivacyPolicy} />
        {/* Client routes */}
        <Route path="/discover">
          <AppLayout><Discover /></AppLayout>
        </Route>
        <Route path="/post/:id">
          {(params) => <AppLayout><PostDetail postId={Number(params.id)} /></AppLayout>}
        </Route>
        <Route path="/tech/:id">
          {(params) => <AppLayout><TechProfile techId={Number(params.id)} /></AppLayout>}
        </Route>
        <Route path="/saved">
          <AppLayout><Saved /></AppLayout>
        </Route>
        <Route path="/bookings">
          <AppLayout><Bookings /></AppLayout>
        </Route>
        <Route path="/book/:techId">
          {() => <AppLayout><BookingFlow /></AppLayout>}
        </Route>
        <Route path="/messages">
          <AppLayout><Messages /></AppLayout>
        </Route>
        <Route path="/chat/:conversationId">
          {(params) => <AppLayout><Chat conversationId={Number(params.conversationId)} /></AppLayout>}
        </Route>
        {/* Nail Tech routes */}
        <Route path="/dashboard">
          <AppLayout><TechDashboard /></AppLayout>
        </Route>
        <Route path="/create-post">
          <AppLayout><CreatePost /></AppLayout>
        </Route>
        <Route path="/edit-post/:id">
          {(params) => <AppLayout><CreatePost postId={Number(params.id)} /></AppLayout>}
        </Route>
        <Route path="/tech-bookings">
          <AppLayout><TechBookings /></AppLayout>
        </Route>
        <Route path="/subscription">
          <AppLayout><Subscription /></AppLayout>
        </Route>
        <Route path="/notifications">
          <AppLayout><Notifications /></AppLayout>
        </Route>
        <Route path="/settings">
          <AppLayout><Settings /></AppLayout>
        </Route>
        <Route path="/settings/profile">
          <AppLayout><SettingsProfile /></AppLayout>
        </Route>
        <Route path="/settings/notifications">
          <AppLayout><SettingsNotifications /></AppLayout>
        </Route>
        <Route path="/settings/privacy">
          <AppLayout><SettingsPrivacy /></AppLayout>
        </Route>
        <Route path="/settings/account">
          <AppLayout><SettingsAccount /></AppLayout>
        </Route>
        <Route path="/settings/subscription">
          <AppLayout><SettingsSubscription /></AppLayout>
        </Route>
        <Route path="/settings/appearance">
          <AppLayout><SettingsAppearance /></AppLayout>
        </Route>
        <Route path="/settings/support">
          <AppLayout><SettingsSupport /></AppLayout>
        </Route>
        {/* Admin routes */}
        <Route path="/admin/reports">
          <AppLayout><AdminReports /></AppLayout>
        </Route>
        <Route path="/login" component={Login} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </ConsentGate>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeProvider defaultTheme="light" switchable>
          <TooltipProvider>
            <Toaster />
            <Router />
            <DemoBar />
          </TooltipProvider>
        </ThemeProvider>
      </NextThemesProvider>
    </ErrorBoundary>
  );
}

export default App;
