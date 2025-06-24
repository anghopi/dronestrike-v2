import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { DashboardNew as Dashboard } from './pages/DashboardNew';
import DashboardTLCBOTG from './pages/DashboardTLCBOTG';
import Leads from './pages/Leads';
import Properties from './pages/Properties';
import PropertiesEnhanced from './pages/PropertiesEnhanced';
import ComponentDemo from './pages/ComponentDemo';
import IntelOperations from './pages/IntelOperations';
import Opportunities from './pages/Opportunities';
import OpportunitiesEnhanced from './pages/OpportunitiesEnhanced';
import Missions from './pages/Missions';
import TLCClients from './pages/TLCClients';
import MapView from './pages/MapView';
import TokensManagement from './pages/TokensManagement';
import WarRoom from './pages/WarRoom';
import ImportPage from './pages/ImportPageSimple';
import Marketing from './pages/Marketing';
import Documents from './pages/Documents';
import ScheduledImports from './pages/ScheduledImports';
import FAQ from './pages/FAQ';
import Settings from './pages/Settings';
import TargetsAdvanced from './pages/TargetsAdvanced';
import TargetsLaravelCompatible from './pages/TargetsLaravelCompatible';
import MapboxTargetsView from './components/MapboxTargetsView';
import MissionTargets from './pages/MissionTargets';
import WebSocketTest from './pages/WebSocketTest';
import RealtimeDashboardPage from './pages/RealtimeDashboard';
import { MainLayout } from './components/Layout/MainLayout';
import ToastNotifications from './components/advanced/ToastNotifications';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-military-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-military-400">Initializing DroneStrike...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route wrapper (redirect to dashboard if already authenticated)
interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-military-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-military-400">Initializing DroneStrike...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

// Main App Routes
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      {/* Protected Routes with MainLayout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DashboardTLCBOTG />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard-old"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Leads />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tokens"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TokensManagement />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/war-room"
        element={
          <ProtectedRoute>
            <MainLayout>
              <WarRoom />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/import"
        element={
          <ProtectedRoute>
            <MainLayout>
              <IntelOperations />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/import-old"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ImportPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/marketing"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Marketing />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Documents />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/scheduled-imports"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ScheduledImports />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/properties"
        element={
          <ProtectedRoute>
            <MainLayout>
              <PropertiesEnhanced />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/properties-old"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Properties />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/missions"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Missions />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/opportunities"
        element={
          <ProtectedRoute>
            <MainLayout>
              <OpportunitiesEnhanced />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/opportunities-old"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Opportunities />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tlc-clients"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TLCClients />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <MainLayout>
              <MapView />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/demo"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ComponentDemo />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <MainLayout>
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h1 className="text-3xl font-bold text-white mb-4">Analytics</h1>
                  <p className="text-gray-400">Analytics dashboard coming soon...</p>
                </div>
              </div>
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <MainLayout>
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h1 className="text-3xl font-bold text-white mb-4">Profile</h1>
                  <p className="text-gray-400">User profile coming soon...</p>
                </div>
              </div>
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Settings />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/faq"
        element={
          <ProtectedRoute>
            <MainLayout>
              <FAQ />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/targets"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TargetsLaravelCompatible />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/targets-advanced"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TargetsAdvanced />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/targets-map"
        element={
          <ProtectedRoute>
            <MapboxTargetsView />
          </ProtectedRoute>
        }
      />


      <Route
        path="/mission-targets"
        element={
          <ProtectedRoute>
            <MainLayout>
              <MissionTargets />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/websocket-test"
        element={
          <ProtectedRoute>
            <MainLayout>
              <WebSocketTest />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/realtime-dashboard"
        element={
          <ProtectedRoute>
            <RealtimeDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      {/* 404 - Not Found */}
      <Route
        path="*"
        element={
          <div className="min-h-screen bg-military-900 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-danger-400">404</h1>
              <h2 className="text-2xl font-semibold text-white mt-4">Mission Not Found</h2>
              <p className="text-military-400 mt-2">The requested operation does not exist.</p>
              <div className="mt-6">
                <a href="/dashboard" className="btn-primary">
                  Return to Command Center
                </a>
              </div>
            </div>
          </div>
        }
      />
    </Routes>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppRoutes />
            <ToastNotifications />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;