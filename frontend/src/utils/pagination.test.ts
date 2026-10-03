import { describe, expect, it } from 'vitest';
import { pageInfo } from './pagination';

describe('pageInfo', () => {
  it('computes a middle page', () => {
    expect(pageInfo(2, 25, 160)).toEqual({
      totalPages: 7,
      firstRow: 26,
      lastRow: 50,
      hasPrevious: true,
      hasNext: true,
    });
  });

  it('handles a partial last page', () => {
    const info = pageInfo(7, 25, 160);
    expect([info.firstRow, info.lastRow, info.hasNext]).toEqual([151, 160, false]);
  });

  it('handles a single page', () => {
    const info = pageInfo(1, 25, 10);
    expect(info).toMatchObject({
      totalPages: 1,
      firstRow: 1,
      lastRow: 10,
      hasPrevious: false,
      hasNext: false,
    });
  });

  it('handles no results', () => {
    expect(pageInfo(1, 25, 0)).toMatchObject({ totalPages: 1, firstRow: 0, lastRow: 0 });
  });

  it('handles a page past the end', () => {
    expect(pageInfo(9, 25, 30)).toMatchObject({
      totalPages: 2,
      firstRow: 0,
      lastRow: 0,
      hasNext: false,
    });
  });
});
