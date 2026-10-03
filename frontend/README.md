# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x';
import reactDom from 'eslint-plugin-react-dom';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

### Events page (`/events`)

Browse imported events in a paginated table (25 per page, newest first).

**Filters and pagination live in the URL**, so a view survives refresh, bookmarks and the Back button:

| Param    | Example      | Meaning                                   |
| -------- | ------------ | ----------------------------------------- |
| `client` | `client=3`   | Only events for this client id            |
| `from`   | `2026-06-01` | Events on or after this date (inclusive)  |
| `to`     | `2026-06-30` | Events on or before this date (inclusive) |
| `page`   | `page=2`     | Page number (omitted for page 1)          |

Example: `/events?client=3&from=2026-06-01&to=2026-06-30&page=2`

**Behavior**

- Invalid URL values are ignored, never sent to the API: `client=abc` means all clients, `from=2026-02-30` means no date filter, `page=0` means page 1.
- Changing any filter resets to page 1 and doesn't add a Back-button entry. Next/Previous do add one.
- If `from` is after `to`, an inline message is shown and no request is made.
- While the next page loads, the previous rows stay visible (dimmed) to avoid a layout jump.
- A page past the end (e.g. an old `?page=99` link) shows "This page doesn't exist" with a **Go to first page** button.
- Money columns show `—` when there is no bar data, which is different from a real `$0.00`.
- Errors show the server reference ID (for 500s) and a **Retry** button.

**Code map**

- `src/api/events.ts`: `getEvents(query, signal)` plus runtime type guards
- `src/hooks/eventsState.ts` / `useEvents.ts`: pure reducer plus a hook that re-fetches on query change and aborts stale requests
- `src/components/events/`: `EventsTable`, `Pagination`, `DateRangeFilter` (presentational)
- `src/utils/`: URL parsers (`clientParam`, `dateParam`, `pageParam`), `pagination`, `format`
- `src/pages/EventsPage.tsx`: reads the URL, calls the hooks, wires the components
