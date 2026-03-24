export function escapeSelector(str: string): string {
  return str.replace(/([^\w-])/g, '\\$1');
}

export function buildSelector(el: Element): string {
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList?.length
    ? `.${Array.from(el.classList).slice(0, 2).map(c => escapeSelector(c)).join('.')}`
    : '';
  return `${el.tagName.toLowerCase()}${id}${cls}`;
}

export function parseDurationMs(str: string): number {
  return Math.max(...str.split(',').map(s => {
    const t = s.trim();
    const val = parseFloat(t);
    return isNaN(val) ? 0 : (t.endsWith('ms') ? val : val * 1000);
  }));
}

export const BROWSER_HELPERS_INIT_SCRIPT = `
  window.__mcp = {
    escapeSelector: function(str) {
      return str.replace(/([^\\w-])/g, '\\\\$1');
    },
    buildSelector: function(el) {
      var id = el.id ? '#' + el.id : '';
      var cls = el.classList && el.classList.length
        ? '.' + Array.from(el.classList).slice(0, 2).map(function(c) { return window.__mcp.escapeSelector(c); }).join('.')
        : '';
      return el.tagName.toLowerCase() + id + cls;
    },
    parseDurationMs: function(str) {
      return Math.max.apply(null, str.split(',').map(function(s) {
        var t = s.trim();
        var val = parseFloat(t);
        return isNaN(val) ? 0 : (t.endsWith('ms') ? val : val * 1000);
      }));
    }
  };
`;
