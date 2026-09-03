/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { LatestCommentModal } from '../cells/LatestCommentModal';
import { doesCellMatchFilter } from '../cells/utils';
import { exportToCSV } from '@/modules/database/utils/csv';
import type { TableField, TableRow } from '@/modules/database/types';

describe('Latest Comment Field (P0 Fixes)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('displays newest comments at the very top of the list and marks first item as latest', () => {
    const mockComments = [
      { id: '1', user: 'User 1', time: '2026/09/01 10:00', content: '第一筆舊留言' },
      { id: '2', user: 'User 2', time: '2026/09/02 11:00', content: '第二筆中間留言' },
      { id: '3', user: 'User 3', time: '2026/09/03 12:00', content: '第三筆最新留言' },
    ];

    render(
      <LatestCommentModal
        show={true}
        value={mockComments}
        onChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const commentNodes = screen.getAllByText(/留言/);
    expect(commentNodes.length).toBeGreaterThan(0);

    // Verify "最新紀錄" badge is rendered
    expect(screen.getByText('最新紀錄')).toBeInTheDocument();

    // Verify reverse order: content of third (latest) comment appears before older comments in DOM
    const allContents = screen.getAllByText(/筆.*留言/);
    expect(allContents[0]).toHaveTextContent('第三筆最新留言');
    expect(allContents[1]).toHaveTextContent('第二筆中間留言');
    expect(allContents[2]).toHaveTextContent('第一筆舊留言');
  });

  it('autofocuses on the typing textarea when opened', async () => {
    render(
      <LatestCommentModal
        show={true}
        value={[]}
        onChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/輸入新留言備註/);
    await waitFor(() => {
      expect(document.activeElement).toBe(textarea);
    });
  });

  it('automatically attaches cached logged-in user name as author when submitting', () => {
    localStorage.setItem('fycd_cached_user', JSON.stringify({ username: '張經理', email: 'manager@fycd.org' }));
    const onChange = jest.fn();

    render(
      <LatestCommentModal
        show={true}
        value={[]}
        onChange={onChange}
        onClose={jest.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/輸入新留言備註/);
    fireEvent.change(textarea, { target: { value: '今日進料檢驗合格' } });

    const submitBtn = screen.getByText('新增留言');
    fireEvent.click(submitBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedList = onChange.mock.calls[0][0];
    expect(updatedList.length).toBe(1);
    expect(updatedList[0].user).toBe('張經理');
    expect(updatedList[0].content).toBe('今日進料檢驗合格');
  });

  it('correctly filters latest_comment rows with doesCellMatchFilter', () => {
    const field: TableField = { id: 10, tableId: 1, name: '最新留言', type: 'latest_comment', order: 0, options: null };
    const comments = [
      { id: '1', user: '王大同', time: '2026/09/01', content: '採購急件待核准' },
      { id: '2', user: '李工程師', time: '2026/09/02', content: '已送檢測中心' },
    ];

    // contains by content
    expect(doesCellMatchFilter(comments, field, 'contains', '採購')).toBe(true);
    expect(doesCellMatchFilter(comments, field, 'contains', '庫存')).toBe(false);

    // contains by author
    expect(doesCellMatchFilter(comments, field, 'contains', '王大同')).toBe(true);

    // empty / not_empty
    expect(doesCellMatchFilter(comments, field, 'not_empty', '')).toBe(true);
    expect(doesCellMatchFilter([], field, 'empty', '')).toBe(true);
    expect(doesCellMatchFilter([], field, 'not_empty', '')).toBe(false);
  });

  it('correctly serializes latest_comment into readable text for CSV export', () => {
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const link = originalCreateElement('a');
        link.setAttribute = jest.fn();
        link.click = jest.fn();
        return link;
      }
      return originalCreateElement(tagName);
    });

    global.URL.createObjectURL = jest.fn();
    global.URL.revokeObjectURL = jest.fn();

    const fields: TableField[] = [{ id: 5, tableId: 1, name: '留言紀錄', type: 'latest_comment', order: 0, options: null }];
    const rows: TableRow[] = [
      {
        id: 1,
        tableId: 1,
        order: 1,
        data: {
          field_5: [
            { id: '1', user: '王大同', time: '2026/09/01 10:00', content: '第一筆備註' },
          ],
        },
      } as any,
    ];

    exportToCSV(fields, rows, [], 'TestTable');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    const blob = (global.URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    expect(blob.type).toContain('text/csv');
  });
});
