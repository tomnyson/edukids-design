import { useEffect } from 'react';
import { PenNode } from '../types/pen-ast';
import { fontFamiliesIn, googleFontsUrl } from '../components/canvas/node-style';

/** Families already asked for, so each stylesheet is added to the page once */
const requested = new Set<string>();

function requestFont(family: string): void {
  const url = googleFontsUrl(family);
  if (!url || requested.has(family)) return;
  requested.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  // Google rejects weights a family lacks; fall back to its regular weight
  link.onerror = () => {
    const regular = googleFontsUrl(family, false);
    if (regular && link.href !== regular) link.href = regular;
  };
  document.head.appendChild(link);
}

/** Loads the Google Fonts the document's text uses; unknown families fall back to a generic font */
export function useDocumentFonts(nodes: readonly PenNode[]): void {
  const key = fontFamiliesIn(nodes).join('|');
  useEffect(() => {
    if (key) key.split('|').forEach(requestFont);
  }, [key]);
}
