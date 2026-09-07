import { BrowserRouter, Route, Routes } from "react-router-dom";

import { GuestNavbar } from "./components/GuestNavbar";
import { RoomProvider } from "./context/RoomContext";
import { CatalogPage } from "./pages/CatalogPage";

// The guest shell — navbar plus whichever page is routed beneath it.
const GuestLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <GuestNavbar />
    <main className="mx-30 mb-8 min-h-screen">{children}</main>
  </>
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
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <RoomProvider>
      <MainApp />
    </RoomProvider>
  );
}

export default App;
