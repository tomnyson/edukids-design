import React, { useEffect, useRef } from 'react';

/**
 * Closes a modal on Escape. Listens in the capture phase and stops the event,
 * so canvas shortcuts behind the modal (deselect, delete) never see it.
 * Returns a mousedown handler for the backdrop that closes on clicks outside the panel.
 */
export function useEscapeToClose(isOpen: boolean, onClose: () => void): (e: React.MouseEvent) => void {
  // Read through a ref so an inline onClose does not re-register the listener every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  return (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCloseRef.current();
  };
}
