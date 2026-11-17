/**
 * Finding the `claude` CLI from a desktop app. An app opened from Finder gets
 * a bare PATH (/usr/bin:/bin:/usr/sbin:/sbin), not the one the user's shell
 * builds, so the usual install folders are searched as well. Pure functions:
 * the caller supplies the file check.
 */

export interface CliPathEnv {
  CLAUDE_CLI_PATH?: string;
  PATH?: string;
  HOME?: string;
}

const CLI_NAME = 'claude';
const PATH_SEPARATOR = ':';
const SYSTEM_INSTALL_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];

const HOME_INSTALL_DIRS = ['.local/bin', '.claude/local', '.volta/bin', '.bun/bin', '.npm-global/bin'];
const SHELL_PATH_START = '__EDUKIDS_PATH__';
const SHELL_PATH_END = '__EDUKIDS_END__';

function homeInstallDirs(home: string | undefined): string[] {
  return home ? HOME_INSTALL_DIRS.map((dir) => `${home}/${dir}`) : [];
}

function splitPath(value: string | undefined): string[] {
  return (value ?? '').split(PATH_SEPARATOR).filter(Boolean);
}

/**
 * Shell command that prints the user's real PATH between markers. Version
 * managers (nvm, asdf) only add their folders in the login shell, and a
 * profile may print other text around it.
 */
export function shellPathCommand(): string {
  return `printf '${SHELL_PATH_START}%s${SHELL_PATH_END}' "$PATH"`;
}

/** The PATH printed by `shellPathCommand`, or '' when the output does not contain one */
export function parseShellPath(output: string): string {
  const start = output.lastIndexOf(SHELL_PATH_START);
  const end = output.indexOf(SHELL_PATH_END, start);
  if (start === -1 || end === -1) return '';
  return output.slice(start + SHELL_PATH_START.length, end).trim();
}

/**
 * Folders to search, in order: the launch PATH, the login shell's PATH when
 * known, then the usual install folders; no duplicates.
 */
export function candidateDirs(env: CliPathEnv, shellPath = ''): string[] {
  return [
    ...new Set([...splitPath(env.PATH), ...splitPath(shellPath), ...homeInstallDirs(env.HOME), ...SYSTEM_INSTALL_DIRS]),
  ];
}

/** Absolute path of the claude binary, or null when it is not installed */
export function resolveClaudeBin(
  env: CliPathEnv,
  isExecutable: (path: string) => boolean,
  shellPath = ''
): string | null {
  if (env.CLAUDE_CLI_PATH) return env.CLAUDE_CLI_PATH;
  const found = candidateDirs(env, shellPath)
    .map((dir) => `${dir}/${CLI_NAME}`)
    .find(isExecutable);
  return found ?? null;
}

/** PATH extended with the install folders, so the CLI can find its own helpers (node, git) */
export function extendedPath(env: CliPathEnv, shellPath = ''): string {
  return candidateDirs(env, shellPath).join(PATH_SEPARATOR);
}
