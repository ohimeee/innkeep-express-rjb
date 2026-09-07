import type { ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { GuestNavbar } from "./components/GuestNavbar";
import { Sidebar } from "./components/Sidebar";
import { RoomProvider } from "./context/RoomContext";
import { ReservationProvider } from "./context/ReservationContext";
import { CatalogPage } from "./pages/CatalogPage";
import { ReservationsPage } from "./pages/ReservationsPage";

// The guest shell — navbar plus whichever page is routed beneath it.
const GuestLayout: React.FC<{ children: ReactNode }> = ({ children }) => (
  <>
    <GuestNavbar />
    <main className="mx-30 mb-8 min-h-screen">{children}</main>
  </>
);

// The staff shell. Unguarded for now — auth is the last phase, and nothing
// else depends on it. See IMPLEMENTATION2.md section 6.
const AdminLayout: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="flex">
    <Sidebar />
    <main className="p-8">{children}</main>
  </div>
);

function MainApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <GuestLayout>
              <CatalogPage />
            </GuestLayout>
          }
        />
        <Route
          path="/admin/reservations"
          element={
            <AdminLayout>
              <ReservationsPage />
            </AdminLayout>
          }
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
