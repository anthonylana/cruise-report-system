import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('test setup', () => {
  it('renders into jsdom and supports jest-dom matchers', () => {
    render(<p>Hello tests</p>);
    expect(screen.getByText('Hello tests')).toBeInTheDocument();
  });
});
