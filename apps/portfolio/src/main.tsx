import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { PublicSite } from "./public/PublicSite";
import "./styles.css";
const AdminPage = lazy(() => import("./admin/AdminPage"));
createRoot(document.getElementById("root")!).render(
  window.location.pathname.startsWith("/admin") ? (
    <Suspense fallback={<div className="page-loading">Opening studio...</div>}>
      <AdminPage />
    </Suspense>
  ) : (
    <PublicSite />
  ),
);
