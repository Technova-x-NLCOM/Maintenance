export function getApiBaseUrl(): string {
  const hostname = window.location.hostname.toLowerCase();

  if (
    hostname === 'nlcom.site' ||
    hostname === 'www.nlcom.site' ||
    hostname.endsWith('.nlcom.site')
  ) {
    return '/api';
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return 'http://127.0.0.1:8000/api';
  }

  return '/api';
}