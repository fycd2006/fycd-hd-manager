import { useEffect } from 'react';

export function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: (event: MouseEvent | TouchEvent) => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      // Do nothing if clicking ref's element, descendent elements, or portal modals
      if (
        !ref.current ||
        ref.current.contains(target as Node) ||
        target?.closest?.('[data-relation-modal="true"]') ||
        target?.closest?.('.portal-modal') ||
        target?.closest?.('[data-longtext-portal="true"]') ||
        target?.closest?.('[data-grid-portal="true"]')
      ) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}
