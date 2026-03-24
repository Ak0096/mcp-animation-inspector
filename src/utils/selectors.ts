interface DomElement {
  tagName: string;
  id: string;
  classList: { length: number } & Iterable<string>;
}

export function buildSelector(el: DomElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList?.length
    ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
    : '';
  return `${tag}${id}${cls}`;
}
