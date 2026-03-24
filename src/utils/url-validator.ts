const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'file:']);

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', '::1', '[::1]']);

function isPrivateIp(hostname: string): boolean {
  if (hostname.startsWith('127.')) return true;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (hostname.startsWith('169.254.')) return true;

  if (hostname.startsWith('172.')) {
    const second = parseInt(hostname.split('.')[1] ?? '', 10);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

export function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new Error(`Disallowed URL scheme "${parsed.protocol}" — only http, https, and file are permitted`);
  }

  // file: URLs are local — skip host validation
  if (parsed.protocol === 'file:') return;

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(hostname)) {
    throw new Error(`Disallowed hostname "${hostname}"`);
  }

  if (isPrivateIp(hostname)) {
    throw new Error(`Private/reserved IP address "${hostname}" is not allowed`);
  }
}
