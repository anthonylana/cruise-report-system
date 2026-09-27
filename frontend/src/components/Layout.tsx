import { Outlet } from 'react-router';
import NavBar from './NavBar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold">Cruise Report Manager</span>
          <NavBar />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* The matched child route (UploadPage, EventsPage...) renders here */}
        <Outlet />
      </main>
    </div>
  );
}
