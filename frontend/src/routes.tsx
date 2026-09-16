import AdminPage from "./pages/AdminPage";
import AdminCoursePage from "./pages/AdminCoursePage";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import FieldCourseMapperPage from "./pages/FieldCourseMapperPage";
import GolferRoundPage from "./pages/GolferRoundPage";
import GolferStatusPage from "./pages/GolferStatusPage";
import LoginPage from "./pages/LoginPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to="/golf"
            replace
          />
        }
      />

      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />

      <Route
        path="/admin/field-course"
        element={
          <FieldCourseMapperPage />
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
          <Route
        path="/admin"
        element={<AdminPage />}
      />

      <Route
        path="/admin/courses/:courseId"
        element={<AdminCoursePage />}
      />

    </Routes>
  );
}
