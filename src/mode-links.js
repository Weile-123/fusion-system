export function modeLink(mode) {
  const query = new URLSearchParams(window.location.search);
  if (mode) query.set('mode', mode); else query.delete('mode');
  return `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`;
}
