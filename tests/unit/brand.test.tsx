import { describe, it, expect } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { BRAND, isDesktopApp } from '../../src/lib/brand';
import { BrandLogo } from '../../src/components/brand/BrandLogo';
import { TitleBarLead } from '../../src/components/layout/TitleBarLead';

describe('brand', () => {
  it('names the product', () => {
    expect(BRAND.name).toBe('EduKids Design');
    expect(BRAND.shortName).toBe('EduKids');
    expect(BRAND.mcpServerId).toBe('edukids-design');
  });

  it('detects the desktop shell from the user agent', () => {
    expect(isDesktopApp('Mozilla/5.0 (Macintosh) Chrome/140.0 Electron/40.0.0 Safari/537.36')).toBe(true);
    expect(isDesktopApp('Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36')).toBe(false);
  });

  it('renders the logo whole at the requested size', () => {
    const html = renderToStaticMarkup(<BrandLogo size={28} />);
    expect(html).toContain('alt="EduKids Design"');
    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
    expect(html).toContain('object-contain');
  });

  it('leaves no old product name in visible UI', () => {
    const files = [
      'index.html',
      'src/components/layout/WindowChrome.tsx',
      'src/components/toolbar/TopNavbar.tsx',
      'src/components/modals/AgentConnectModal.tsx',
      'src/advisor/prompts/consultant-prompt.ts',
      'scripts/setup-mcp-agents.js',
    ];
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/Pen Studio|pen-studio|>pen\.dev</);
    }
    expect(readFileSync('index.html', 'utf8')).toContain('<title>EduKids Design - AI Design-as-Code Canvas</title>');
  });

  it('ships a self-contained square logo, also used as the favicon', () => {
    const logo = readFileSync('src/assets/brand/logo.svg', 'utf8');
    expect(logo).toContain('viewBox="0 0 64 64"');
    expect(logo).not.toMatch(/href="http|<image|font-family/);
    expect(readFileSync('public/favicon.svg', 'utf8')).toBe(logo);
  });
});

describe('TitleBarLead', () => {
  it('draws fake window buttons only in the browser', () => {
    const web = renderToStaticMarkup(<TitleBarLead desktop={false} />);
    const desktop = renderToStaticMarkup(<TitleBarLead desktop />);
    expect(web.match(/rounded-full/g)).toHaveLength(3);
    expect(desktop).not.toContain('rounded-full');
    expect(desktop).toContain('width:68px');
  });
});
