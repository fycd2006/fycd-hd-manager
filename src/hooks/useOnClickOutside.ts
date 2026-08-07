import { useEffect } from 'react';

export function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: (event: MouseEvent | TouchEvent) => void) {
  useEffect(() => {
    let mousedownTarget: Node | null = null;

    const handleMouseDown = (event: MouseEvent | TouchEvent) => {
      mousedownTarget = event.target as Node;
    };

    const handleMouseUp = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;

      // Do nothing if clicking ref's element, descendent elements, mousedown started inside, or portal modals
      if (
        !ref.current ||
        ref.current.contains(target as Node) ||
        (mousedownTarget && ref.current.contains(mousedownTarget)) ||
        target?.closest?.('[data-portal-root="true"]') ||
        target?.closest?.('.portal-modal') ||
        target?.closest?.('.modal-overlay') ||
        target?.closest?.('[data-relation-modal="true"]') ||
        target?.closest?.('[data-longtext-portal="true"]') ||
        target?.closest?.('[data-grid-portal="true"]') ||
        target?.closest?.('[data-select-portal="true"]') ||
        target?.closest?.('[data-comment-portal="true"]') ||
        target?.closest?.('[data-row-edit-portal="true"]')
      ) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchstart', handleMouseDown);
    document.addEventListener('touchend', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchstart', handleMouseDown);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [ref, handler]);
}
