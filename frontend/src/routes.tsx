import {
  Route,
  Routes,
} from "react-router-dom";

import GolferRoundPage from "./pages/GolferRoundPage";
import GolferStatusPage from "./pages/GolferStatusPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <GolferStatusPage />
        }
      />

      <Route
        path="/golf"
        element={
          <GolferRoundPage />
        }
      />

      <Route
        path="/status/:golferUserId"
        element={
          <GolferStatusPage />
        }
      />
    </Routes>
  );
}
