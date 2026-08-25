function decodeXml(value) {
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (match, entity) => {
    if (entity[0] === "#") return String.fromCodePoint(entity[1]?.toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity] ?? match;
  });
}

class XmlElement {
  constructor(name, attributes = {}) {
    this.name = name;
    this.attributes = attributes;
    this.children = [];
  }

  get textContent() {
    return this.children.map((child) => typeof child === "string" ? child : child.textContent).join("");
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  getAttributeNS(_namespace, name) {
    return this.attributes[`r:${name}`] ?? null;
  }

  getElementsByTagName(name) {
    const found = [];
    for (const child of this.children) {
      if (typeof child === "string") continue;
      if (child.name === name) found.push(child);
      found.push(...child.getElementsByTagName(name));
    }
    return found;
  }
}

export function installXmlDomParser() {
  globalThis.DOMParser = class DOMParser {
    parseFromString(source) {
      const document = new XmlElement("#document");
      const stack = [document];
      for (const match of source.matchAll(/<!--[\s\S]*?-->|<\?[^]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<\/?[\w:-]+(?:\s+[^<>]*?)?\s*\/?>|[^<]+/g)) {
        const token = match[0];
        if (token.startsWith("<!--") || token.startsWith("<?") || token.startsWith("<!DOCTYPE")) continue;
        if (token.startsWith("<![CDATA[")) { stack.at(-1).children.push(token.slice(9, -3)); continue; }
        if (token.startsWith("</")) { stack.pop(); continue; }
        if (!token.startsWith("<")) { stack.at(-1).children.push(decodeXml(token)); continue; }

        const tag = token.match(/^<([\w:-]+)/)?.[1];
        if (!tag) continue;
        const attributes = {};
        for (const attribute of token.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[attribute[1]] = decodeXml(attribute[2] ?? attribute[3] ?? "");
        const element = new XmlElement(tag, attributes);
        stack.at(-1).children.push(element);
        if (!token.endsWith("/>")) stack.push(element);
      }
      return document;
    }
  };
}
