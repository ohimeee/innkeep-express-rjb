import type { ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { GuestNavbar } from "./components/GuestNavbar";
import { Sidebar } from "./components/Sidebar";
import { RoomProvider } from "./context/RoomContext";
import { ReservationProvider } from "./context/ReservationContext";
import { CatalogPage } from "./pages/CatalogPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ConfirmationPage } from "./pages/ConfirmationPage";
import { FindBookingPage } from "./pages/FindBookingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FolioPage } from "./pages/FolioPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { RoomsPage } from "./pages/RoomsPage";

// The guest shell — navbar plus whichever page is routed beneath it.
const GuestLayout: React.FC<{ children: ReactNode }> = ({ children }) => (
  <>
    <GuestNavbar />
    <main className="mx-30 mb-8 min-h-screen">{children}</main>
  </>
);

// The staff shell. Unguarded for now — auth is the last phase and nothing else
// depends on it. See IMPLEMENTATION2.md section 6.
const AdminLayout: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="flex">
    <Sidebar />
    <main className="p-8">{children}</main>
  </div>
);

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
        <Route path="/admin" element={admin(<DashboardPage />)} />
        <Route path="/admin/rooms" element={admin(<RoomsPage />)} />
        <Route path="/admin/reservations" element={admin(<ReservationsPage />)} />
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
    <RoomProvider>
      <ReservationProvider>
        <MainApp />
      </ReservationProvider>
    </RoomProvider>
  );
}

export default App;
