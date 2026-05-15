import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
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
import { useAuth } from "./_core/hooks/useAuth";
import { DemoBar } from "./components/DemoBar";

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm font-light tracking-wide">Valisse</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Splash} />
      <Route path="/onboarding" component={Onboarding} />
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
      <Route path="/settings">
        <AppLayout><Settings /></AppLayout>
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
          <DemoBar />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
