/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { LatestCommentModal } from '../cells/LatestCommentModal';

const entries = [
  { id: '1', user: '張經理', time: '2026/09/01 10:00:00', content: '張的舊留言' },
  { id: '2', user: '李工程師', time: '2026/09/02 11:00:00', content: '李的新留言' },
];

const setup = (props: Partial<React.ComponentProps<typeof LatestCommentModal>> = {}) => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  render(
    <LatestCommentModal show={true} value={entries} onChange={onChange} onClose={onClose} {...props} />
  );
  return { onChange, onClose, composer: screen.getByPlaceholderText(/輸入新留言備註/) };
};

describe('LatestCommentModal keyboard and editing UX', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('fycd_cached_user', JSON.stringify({ username: '張經理' }));
  });

  it('Enter alone inserts a newline instead of submitting', () => {
    const { onChange, composer } = setup();
    fireEvent.change(composer, { target: { value: '第一行' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter and Cmd+Enter submit the comment', () => {
    const { onChange, composer } = setup();
    fireEvent.change(composer, { target: { value: '以鍵盤送出' } });
    fireEvent.keyDown(composer, { key: 'Enter', ctrlKey: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0];
    expect(added).toHaveLength(3);
    expect(added[2]).toMatchObject({ user: '張經理', content: '以鍵盤送出' });
    expect(added[2].time).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);

    fireEvent.change(composer, { target: { value: 'Mac 送出' } });
    fireEvent.keyDown(composer, { key: 'Enter', metaKey: true });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('does not submit while an IME composition is in progress', () => {
    const { onChange, composer } = setup();
    fireEvent.change(composer, { target: { value: 'ㄓㄨㄥ' } });
    fireEvent.keyDown(composer, { key: 'Enter', ctrlKey: true, isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps focus in the composer after submitting', () => {
    const { composer } = setup();
    fireEvent.change(composer, { target: { value: '連續新增' } });
    fireEvent.keyDown(composer, { key: 'Enter', ctrlKey: true });
    expect(composer).toHaveValue('');
    expect(document.activeElement).toBe(composer);
  });

  it('prefills the composer with the type-over character', () => {
    setup({ initialText: '今' });
    expect(screen.getByPlaceholderText(/輸入新留言備註/)).toHaveValue('今');
  });

  it('asks for confirmation before deleting and cancel keeps the entry', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: '刪除留言' })[0]);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('刪除這則留言？');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes the entry after confirming', () => {
    const { onChange } = setup();
    // 第一個是最新的「李的新留言」
    fireEvent.click(screen.getAllByRole('button', { name: '刪除留言' })[0]);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '刪除' }));
    expect(onChange).toHaveBeenCalledWith([entries[0]]);
  });

  it('Escape closes the delete confirmation without closing the modal', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: '刪除留言' })[0]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ArrowUp in an empty composer edits my own latest comment; Ctrl+Enter saves with editedAt', () => {
    const { onChange, composer } = setup();
    fireEvent.keyDown(composer, { key: 'ArrowUp' });
    const editor = screen.getByLabelText('更正留言內容');
    expect(editor).toHaveValue('張的舊留言');

    fireEvent.change(editor, { target: { value: '張的更正' } });
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });
    const updated = onChange.mock.calls[0][0];
    expect(updated[0]).toMatchObject({ id: '1', content: '張的更正' });
    expect(updated[0].editedAt).toBeTruthy();
    expect(updated[1]).toEqual(entries[1]);
  });

  it('Escape while editing cancels the edit but keeps the modal open', () => {
    const { onChange, onClose, composer } = setup();
    fireEvent.keyDown(composer, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByLabelText('更正留言內容')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('only one entry can be edited at a time', () => {
    setup();
    const editButtons = screen.getAllByRole('button', { name: '更正留言' });
    fireEvent.click(editButtons[0]);
    expect(screen.queryAllByRole('button', { name: '更正留言' })).toHaveLength(0);
    expect(screen.getAllByLabelText('更正留言內容')).toHaveLength(1);
  });

  it('marks edited entries', () => {
    setup({ value: [{ ...entries[0], editedAt: '2026/09/03 09:00:00' }] });
    expect(screen.getByText('（已編輯）')).toBeInTheDocument();
  });

  it('warns once before discarding an unsent draft', () => {
    const { onClose, composer } = setup();
    fireEvent.change(composer, { target: { value: '還沒送出' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/還有未送出的留言/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes immediately on Escape when there is no draft', () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
