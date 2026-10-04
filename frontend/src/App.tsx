import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import UploadPage from './pages/UploadPage';
import { EVENT_ID_PARAM } from './utils/eventIdParam';

export default function App() {
  return (
    <Routes>
      {/* Layout route: renders the header/nav, and child pages appear in its <Outlet /> */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/upload" replace />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path={`events/:${EVENT_ID_PARAM}`} element={<EventDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
