import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeEventDetail } from '../../../test/factories';
import { EventSummary } from './EventSummary';

/** The <dd> text next to a <dt> label. */
function fieldValue(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('EventSummary', () => {
  it('shows the date as the page title and the client', () => {
    render(<EventSummary event={makeEventDetail()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'June 14, 2026' })).toBeTruthy();
    expect(screen.getByText('Elite')).toBeTruthy();
  });

  it('formats the detail fields', () => {
    render(<EventSummary event={makeEventDetail()} />);

    expect(fieldValue('Event #')).toBe('42');
    expect(fieldValue('Guests')).toBe('120');
    expect(fieldValue('Scheduled boarding')).toBe('18:30');
    expect(fieldValue('Actual departure')).toBe('19:05');
    expect(fieldValue('Floor plan followed')).toBe('Yes');
    expect(fieldValue('Feedback')).toBe('Great night');
  });

  it('shows a dash for null and keeps false as "No"', () => {
    render(
      <EventSummary
        event={makeEventDetail({ guest_count: null, extra_time: null, floor_plan_followed: false })}
      />,
    );

    expect(fieldValue('Guests')).toBe('—');
    expect(fieldValue('Extra time')).toBe('—');
    expect(fieldValue('Floor plan followed')).toBe('No');
  });
});
