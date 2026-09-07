import { BrowserRouter, Route, Routes } from "react-router-dom";

import Navbar from "./components/guest/GuestNavbar";
import CatalogPage from "./pages/CatalogPage";

/**
 * The guest shell — navbar plus whichever page is routed beneath it.
 *
 * Stands in for `app/(guest)/layout.tsx` from the Next version. The admin
 * section gets its own layout with the sidebar once those routes land.
 */
const GuestLayout = ({ children }: { children: React.ReactNode }) => (
  <>
    <Navbar />
    <main className="mx-30 mb-8 min-h-screen">{children}</main>
  </>
);

const App = () => (
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

export default App;
