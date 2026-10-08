function documentFixture() {
  const document = {};
  class Node {
    constructor(type, namespaceURI = null) {
      this.type = type; this.localName = type; this.namespaceURI = namespaceURI; this.ownerDocument = document;
      this.childNodes = []; this.attributes = {}; this.parentNode = null; this.data = '';
      this.dataset = {}; this.styles = {};
      this.style = { setProperty: (key, value) => this.styles[key] = value, removeProperty: key => delete this.styles[key] };
    }
    insertBefore(node, target) {
      if (node.parentNode) node.parentNode.removeChild(node);
      const index = target ? this.childNodes.indexOf(target) : this.childNodes.length;
      if (index < 0) throw Error('Invalid insert target');
      this.childNodes.splice(index, 0, node); node.parentNode = this;
    }
    removeChild(node) { this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null; }
    replaceChildren() { this.childNodes.forEach(node => node.parentNode = null); this.childNodes = []; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    set textContent(value) { this.data = String(value); this.replaceChildren(); }
    get textContent() { return this.data + this.childNodes.map(node => node.textContent).join(''); }
  }
  document.createElement = type => new Node(type);
  document.createElementNS = (namespace, type) => new Node(type, namespace);
  document.createTextNode = text => { const node = new Node('#text'); node.textContent = text; return node; };
  // The real HTML parser provides this namespace on the SVG template in index.html.
  const svgTemplate = new Node('svg', 'http://www.w3.org/2000/svg');
  document.getElementById = id => id === 'svg-element-template' ? svgTemplate : null;
  return { document, element: document.createElement('main'), svgTemplate };
}

module.exports = { documentFixture };
