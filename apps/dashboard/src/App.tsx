import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { HomePage } from "./pages/HomePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectFormPage } from "./pages/ProjectFormPage";
import { EpisodesPage } from "./pages/EpisodesPage";
import { EpisodeFormPage } from "./pages/EpisodeFormPage";
import { EpisodeDetailPage } from "./pages/EpisodeDetailPage";
import { ProvidersPage } from "./pages/ProvidersPage";

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<ProjectFormPage />} />
        <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
        <Route path="/episodes" element={<EpisodesPage />} />
        <Route path="/episodes/new" element={<EpisodeFormPage />} />
        <Route path="/episodes/:id" element={<EpisodeDetailPage />} />
        <Route path="/episodes/:id/edit" element={<EpisodeFormPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
