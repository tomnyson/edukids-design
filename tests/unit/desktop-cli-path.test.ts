import { describe, it, expect, afterEach } from 'vitest';
import { candidateDirs, extendedPath, parseShellPath, resolveClaudeBin, shellPathCommand } from '../../desktop/cli-path';
import { claudeBin } from '../../server/claude-bridge-plugin';

const env = { PATH: '/usr/bin:/bin', HOME: '/Users/kid' };

describe('resolveClaudeBin', () => {
  it('prefers an explicit CLAUDE_CLI_PATH', () => {
    expect(resolveClaudeBin({ ...env, CLAUDE_CLI_PATH: '/x/claude' }, () => true)).toBe('/x/claude');
  });

  it('finds claude in a user install folder that a Finder launch has no PATH for', () => {
    expect(resolveClaudeBin(env, (p) => p === '/Users/kid/.local/bin/claude')).toBe('/Users/kid/.local/bin/claude');
  });

  it('searches PATH before the fallback folders', () => {
    const found = resolveClaudeBin(env, (p) => p === '/usr/bin/claude' || p === '/opt/homebrew/bin/claude');
    expect(found).toBe('/usr/bin/claude');
  });

  it('returns null when claude is not installed', () => {
    expect(resolveClaudeBin(env, () => false)).toBeNull();
  });

  it('works without PATH or HOME', () => {
    expect(candidateDirs({})).toEqual(['/opt/homebrew/bin', '/usr/local/bin']);
    expect(resolveClaudeBin({}, (p) => p === '/usr/local/bin/claude')).toBe('/usr/local/bin/claude');
  });
});

describe('extendedPath', () => {
  it('extends PATH without duplicating entries', () => {
    expect(extendedPath({ PATH: '/usr/bin:/opt/homebrew/bin', HOME: '/Users/kid' })).toBe(
      '/usr/bin:/opt/homebrew/bin:/Users/kid/.local/bin:/Users/kid/.claude/local:/Users/kid/.volta/bin:/Users/kid/.bun/bin:/Users/kid/.npm-global/bin:/usr/local/bin'
    );
  });

  it('puts the login shell PATH after the launch PATH and before the fallback folders', () => {
    const shellPath = '/Users/kid/.nvm/versions/node/v22.1.0/bin:/usr/bin';
    expect(candidateDirs(env, shellPath).slice(0, 4)).toEqual([
      '/usr/bin',
      '/bin',
      '/Users/kid/.nvm/versions/node/v22.1.0/bin',
      '/Users/kid/.local/bin',
    ]);
  });
});

describe('login shell PATH', () => {
  it('finds an nvm-installed claude, and node beside it, through the shell PATH', () => {
    const shellPath = '/Users/kid/.nvm/versions/node/v22.1.0/bin';
    const claude = '/Users/kid/.nvm/versions/node/v22.1.0/bin/claude';
    expect(resolveClaudeBin(env, (p) => p === claude, shellPath)).toBe(claude);
    expect(extendedPath(env, shellPath).split(':')).toContain(shellPath);
  });

  it('reads PATH between markers, ignoring whatever the shell profile prints', () => {
    const output = `Welcome back!\n${shellPathCommand().includes('__EDUKIDS_PATH__') ? '' : 'x'}__EDUKIDS_PATH__/a/bin:/b/bin__EDUKIDS_END__\nbye`;
    expect(parseShellPath(output)).toBe('/a/bin:/b/bin');
  });

  it('yields nothing when the markers are missing or the PATH is empty', () => {
    expect(parseShellPath('zsh: command not found')).toBe('');
    expect(parseShellPath('__EDUKIDS_PATH____EDUKIDS_END__')).toBe('');
  });
});

describe('claudeBin', () => {
  const original = process.env.CLAUDE_CLI_PATH;
  afterEach(() => {
    if (original === undefined) delete process.env.CLAUDE_CLI_PATH;
    else process.env.CLAUDE_CLI_PATH = original;
  });

  it('reads the CLI path at call time', () => {
    process.env.CLAUDE_CLI_PATH = '/late/claude';
    expect(claudeBin()).toBe('/late/claude');
    delete process.env.CLAUDE_CLI_PATH;
    expect(claudeBin()).toBe('claude');
  });
});
