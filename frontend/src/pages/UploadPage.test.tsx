import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { UploadFn } from '../hooks/useUploadQueue';
import { makeFile, makeResult } from '../test/factories';
import UploadPage from './UploadPage';

const currentYear = new Date().getFullYear();

// applyAccept: false lets us pick a .txt, just like a user choosing "All files" in the dialog.
function setup(upload: UploadFn = vi.fn<UploadFn>()) {
  const user = userEvent.setup({ applyAccept: false });
  render(<UploadPage upload={upload} />);
  const input = screen.getByLabelText(/excel files/i);
  return { user, input, upload };
}

describe('UploadPage', () => {
  it('disables the upload button until a valid file is selected', async () => {
    const { user, input } = setup();
    const button = screen.getByRole('button', { name: /upload/i });

    expect(button).toBeDisabled();
    await user.upload(input, makeFile('a.xls'));
    expect(button).toBeEnabled();
  });

  it('lists rejected files with a reason and keeps the valid ones', async () => {
    const { user, input } = setup();

    await user.upload(input, [makeFile('a.xls'), makeFile('notes.txt')]);

    const rejected = screen.getByRole('list', { name: 'Rejected files' });
    expect(within(rejected).getByText('notes.txt')).toBeInTheDocument();
    expect(rejected).toHaveTextContent('Not an .xls file.');
    expect(screen.getByText(/1 file ready/)).toHaveTextContent('a.xls');
  });

  it('warns when the selected year is not the current year', async () => {
    const { user } = setup();

    expect(screen.queryByText(/not the current year/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Year'), String(currentYear - 1));
    expect(screen.getByText(/not the current year/i)).toBeInTheDocument();
  });

  it('uploads with the chosen year and shows per-file results and a summary', async () => {
    const upload = vi
      .fn<UploadFn>()
      .mockResolvedValueOnce({
        kind: 'result',
        httpStatus: 201,
        body: makeResult({ filename: 'a.xls', warnings: ['Missing cabin count'] }),
      })
      .mockResolvedValueOnce({
        kind: 'result',
        httpStatus: 409,
        body: makeResult({ filename: 'b.xls', status: 'skipped', message: 'Duplicate event' }),
      });
    const { user, input } = setup(upload);
    const files = [makeFile('a.xls'), makeFile('b.xls')];

    await user.selectOptions(screen.getByLabelText('Year'), String(currentYear - 1));
    await user.upload(input, files);
    await user.click(screen.getByRole('button', { name: /upload 2 files/i }));

    const status = await screen.findByRole('status');
    await vi.waitFor(() => expect(status).toHaveTextContent('2 of 2 done'));
    expect(status).toHaveTextContent('1 imported · 1 skipped · 0 errors');

    expect(upload).toHaveBeenNthCalledWith(1, files[0], currentYear - 1);
    expect(upload).toHaveBeenNthCalledWith(2, files[1], currentYear - 1);

    const results = screen.getByRole('list', { name: 'Upload results' });
    expect(within(results).getByText('Duplicate event')).toBeInTheDocument();
    expect(within(results).getByText('Missing cabin count')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear results' })).toBeInTheDocument();
  });

  it('shows network errors as error rows', async () => {
    const upload = vi.fn<UploadFn>().mockResolvedValue({
      kind: 'network-error',
      message: 'Could not reach the server.',
    });
    const { user, input } = setup(upload);

    await user.upload(input, makeFile('a.xls'));
    await user.click(screen.getByRole('button', { name: /upload 1 file/i }));

    expect(await screen.findByText('Could not reach the server.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 error');
  });
});
