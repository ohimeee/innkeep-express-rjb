import { useContext, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { GuestFooter } from "./components/layout/GuestFooter";
import { GuestNavbar } from "./components/layout/GuestNavbar";
import { Sidebar } from "./components/layout/Sidebar";
import { AuthContext, AuthProvider } from "./context/AuthContext";
import { RoomProvider } from "./context/RoomContext";
import { ReservationProvider } from "./context/ReservationContext";
import { CatalogPage } from "./pages/guest/CatalogPage";
import { CheckoutPage } from "./pages/guest/CheckoutPage";
import { ConfirmationPage } from "./pages/guest/ConfirmationPage";
import { FindBookingPage } from "./pages/guest/FindBookingPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { FolioPage } from "./pages/admin/FolioPage";
import { LoginPage } from "./pages/admin/LoginPage";
import { ReservationsPage } from "./pages/admin/ReservationsPage";
import { RoomsPage } from "./pages/admin/RoomsPage";

// The guest shell — navbar plus whichever page is routed beneath it.
const GuestLayout: React.FC<{ children: ReactNode }> = ({ children }) => (
  <>
    <GuestNavbar />
    <main className="mx-auto mb-8 min-h-screen w-full max-w-6xl px-4 sm:px-8">
      {children}
    </main>
    <GuestFooter />
  </>
);

// The staff shell, behind a sign-in. This guard is only the screen — the API
// checks the token on every staff route, which is the half that keeps data
// safe. Someone signed out is sent to the login page and brought back after.
const AdminLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AdminLayout must be used within AuthProvider");
  const location = useLocation();

  if (!context.state.isAuthenticated)
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
};

const guest = (page: ReactNode) => <GuestLayout>{page}</GuestLayout>;
const admin = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;

function MainApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={guest(<CatalogPage />)} />
        <Route path="/booking/checkout" element={guest(<CheckoutPage />)} />
        <Route
          path="/booking/:confirmationCode"
          element={guest(<ConfirmationPage />)}
        />
        <Route path="/find-booking" element={guest(<FindBookingPage />)} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={admin(<DashboardPage />)} />
        <Route path="/admin/rooms" element={admin(<RoomsPage />)} />
        <Route
          path="/admin/reservations"
          element={admin(<ReservationsPage />)}
        />
        <Route
          path="/admin/reservations/:code"
          element={admin(<FolioPage />)}
        />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <RoomProvider>
        <ReservationProvider>
          <MainApp />
        </ReservationProvider>
      </RoomProvider>
    </AuthProvider>
  );
}

export default App;
