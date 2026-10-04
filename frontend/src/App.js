import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProviders, useApp } from "@/context/AppContext";
import { ConfirmProvider } from "@/components/common";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Products from "@/pages/Products";
import Documents from "@/pages/Documents";
import DocumentView from "@/pages/DocumentView";
import Payments from "@/pages/Payments";
import Tasks from "@/pages/Tasks";
import CalendarPage from "@/pages/CalendarPage";
import Inbox from "@/pages/Inbox";
import MapPage from "@/pages/MapPage";
import Insights from "@/pages/Insights";
import Settings from "@/pages/Settings";
import About from "@/pages/About";
import { Loader2 } from "lucide-react";

function Protected({ children }) {
  const { user } = useApp();
  if (user === undefined)
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useApp();
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AppProviders>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/products" element={<Products />} />
              <Route path="/quotes" element={<Documents type="quotes" />} />
              <Route path="/orders" element={<Documents type="orders" />} />
              <Route path="/invoices" element={<Documents type="invoices" />} />
              <Route path="/view/:type/:id" element={<DocumentView />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/about" element={<About />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </ConfirmProvider>
    </AppProviders>
  );
}
