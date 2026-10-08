// The game only needs synchronous JSX rendering, not a general framework runtime.
// Text is always a text node; this renderer has no HTML parsing/writing API.
export const Fragment = Symbol('fragment');
export function createElement(type, props, ...children) {
  return { type, props: { ...props, ...(children.length ? { children } : {}) } };
}
export const jsx = (type, props, key) => createElement(type, { ...props, key });
export const jsxs = jsx;
export const jsxDEV = jsx;
export const flushSync = callback => callback();

const names = {
  className: 'class', htmlFor: 'for', tabIndex: 'tabindex', viewBox: 'viewBox',
  preserveAspectRatio: 'preserveAspectRatio', strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin',
  fillOpacity: 'fill-opacity', textAnchor: 'text-anchor', paintOrder: 'paint-order',
  fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', clipPath: 'clip-path'
};
const booleanAttributes = new Set(['disabled', 'hidden', 'checked', 'selected', 'multiple', 'readOnly']);

function flatten(value, output = []) {
  if (Array.isArray(value)) value.forEach(child => flatten(child, output));
  else if (value == null || typeof value === 'boolean') return output;
  else if (typeof value === 'string' || typeof value === 'number') output.push(String(value));
  else if (value.type === Fragment) flatten(value.props.children, output);
  else if (typeof value.type === 'function') flatten(value.type(value.props), output);
  else output.push({ ...value, children: flatten(value.props.children) });
  return output;
}

function setProps(node, before, after) {
  if(node.localName==='img'&&!after.decoding)node.decoding='async';
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (name === 'children' || name === 'key') continue;
    if (/^on/i.test(name) || /^(?:innerHTML|outerHTML|dangerouslySetInnerHTML|srcdoc)$/i.test(name)) {
      throw new Error(`Unsupported DOM property: ${name}`);
    }
    const value = after[name];
    if (name === 'ref') {
      if (before[name] !== value && before[name]) before[name].current = null;
      if (value) value.current = node;
      continue;
    }
    if (name === 'value' && ['textarea', 'input', 'select'].includes(node.localName)) {
      node.value = value == null ? '' : String(value);
      continue;
    }
    if (name === 'style') {
      for (const property of new Set([...Object.keys(before.style || {}), ...Object.keys(value || {})])) {
        const cssName = property.startsWith('--') ? property : property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        const cssValue = value?.[property];
        if (cssValue == null) node.style.removeProperty(cssName);
        else node.style.setProperty(cssName, String(cssValue));
      }
      continue;
    }
    if (before[name] === value) continue;
    const attribute = names[name] || name;
    if (value == null || (booleanAttributes.has(name) && value === false)) node.removeAttribute(attribute);
    else node.setAttribute(attribute, booleanAttributes.has(name) ? '' : String(value));
  }
}

function patchChildren(parent, previous, next, svgNamespace, document) {
  const used = new Set();
  const result = next.map((value, index) => {
    const key = typeof value === 'string' ? null : value.props.key;
    const candidate = key == null ? previous[index] : previous.find(record => record.key === key);
    const sameType = candidate && !used.has(candidate) && candidate.type === (typeof value === 'string' ? '#text' : value.type);
    let record;
    if (sameType) {
      used.add(candidate);
      record = candidate;
    } else {
      const type = typeof value === 'string' ? '#text' : value.type;
      const namespace = type === 'svg' ? document.getElementById('svg-element-template')?.namespaceURI : svgNamespace;
      if (type === 'svg' && !namespace) throw new Error('Missing SVG element template');
      record = { type, key, props: {}, children: [], namespace,
        node: type === '#text' ? document.createTextNode('') : namespace ? document.createElementNS(namespace, type) : document.createElement(type) };
    }
    if (record.type === '#text') record.node.textContent = value;
    else {
      setProps(record.node, record.props, value.props);
      record.children = patchChildren(record.node, record.children, value.children, record.namespace, document);
      record.props = value.props;
    }
    const current = parent.childNodes[index];
    if (current !== record.node) parent.insertBefore(record.node, current || null);
    return record;
  });
  for (const record of previous) {
    if (!used.has(record) && record.node.parentNode === parent) {
      if (record.props.ref) record.props.ref.current = null;
      parent.removeChild(record.node);
    }
  }
  return result;
}

export function createRoot(element) {
  let previous = [];
  const ownerDocument = element.ownerDocument || document;
  element.replaceChildren();
  return {
    render(content) { previous = patchChildren(element, previous, flatten(content), null, ownerDocument); },
    unmount() { previous = patchChildren(element, previous, [], null, ownerDocument); }
  };
}
