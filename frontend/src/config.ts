const raw = import.meta.env.VITE_API_BASE_URL;

if (!raw) {
  throw new Error('VITE_API_BASE_URL is not set. See frontend/.env.development');
}

// Strip trailing slashes so `${API_BASE_URL}/api/imports` never becomes "//api"
export const API_BASE_URL: string = raw.replace(/\/+$/, '');
