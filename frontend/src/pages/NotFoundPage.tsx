import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/upload" className="mt-2 inline-block text-blue-600 underline">
        Go to Upload
      </Link>
    </section>
  );
}
