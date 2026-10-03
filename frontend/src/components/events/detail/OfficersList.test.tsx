import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeEventOfficer } from '../../../test/factories';
import { OfficersList } from './OfficersList';

describe('OfficersList', () => {
  it('shows each officer with a readable position', () => {
    render(
      <OfficersList
        officers={[
          makeEventOfficer(),
          makeEventOfficer({ officer_name: 'K. Lee', position: 'first_mate' }),
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Captain: J. Smith', 'First mate: K. Lee']);
  });

  it('shows an empty message', () => {
    render(<OfficersList officers={[]} />);

    expect(screen.getByText(/no officers recorded/i)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
