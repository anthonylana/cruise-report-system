import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from './App';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  it('redirects / to the upload page and marks Upload as active', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { name: 'Upload reports' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders the events placeholder', () => {
    renderAt('/events');

    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown URLs', () => {
    renderAt('/nope');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('navigates when a nav link is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/upload');

    await user.click(screen.getByRole('link', { name: 'Events' }));

    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();
  });
});
