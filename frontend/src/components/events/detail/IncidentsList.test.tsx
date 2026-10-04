import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeSecurityIncident } from '../../../test/factories';
import { IncidentsList } from './IncidentsList';

describe('IncidentsList', () => {
  it('shows the guard and the description', () => {
    render(
      <IncidentsList
        incidents={[
          makeSecurityIncident(),
          makeSecurityIncident({ guard_name: 'Bo', incident_description: 'Spilled drink' }),
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Alex: Guest refused service', 'Bo: Spilled drink']);
  });

  it('says so when a description is missing', () => {
    render(<IncidentsList incidents={[makeSecurityIncident({ incident_description: null })]} />);

    expect(screen.getByRole('listitem').textContent).toBe('Alex: No description.');
  });

  it('shows an empty message', () => {
    render(<IncidentsList incidents={[]} />);

    expect(screen.getByText(/no security incidents recorded/i)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
