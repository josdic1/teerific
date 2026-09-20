import AdminPage from "./pages/AdminPage";
import AdminLoginPage from "./pages/AdminLoginPage";
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
import PartnersPage from "./pages/PartnersPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to="/login"
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
        path="/admin/login"
        element={
          <AdminLoginPage />
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
        path="/partners"
        element={
          <PartnersPage />
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
