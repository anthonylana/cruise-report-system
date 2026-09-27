/// <reference types="vite/client" />

// Typed Vite environment variables (only VITE_* vars reach browser code).
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
