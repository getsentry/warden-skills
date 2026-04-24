# XXE (XML External Entity) Reference

Load when the diff parses XML with untrusted input: `lxml`, `xml.etree`, `xml.sax`, `xml.dom`, `defusedxml`, Java `DocumentBuilder` / `SAXParser` / `XMLStreamReader`, Node `xml2js` / `libxmljs` / `sax`, .NET `XmlDocument` / `XDocument` / `XmlReader`, or any SOAP / SAML / WS-Security / OOXML parser.

XXE produces multiple outcomes that all belong in this skill:

1. **File read**: `<!ENTITY xxe SYSTEM "file:///etc/passwd">` reflects the file contents in the parsed value.
2. **SSRF**: `<!ENTITY xxe SYSTEM "http://169.254.169.254/...">` turns the parser into an HTTP client.
3. **DoS**: "billion laughs" / quadratic blowup.
4. **RCE** (rare, legacy): via classloader gadgets in Java or specific parser extensions.

## The Core Rule

XML parsers that resolve external entities by default must be explicitly disabled or replaced with a safe equivalent. Presence of `defusedxml` (Python) or the equivalent config in other ecosystems is the fix, not the bug.

## Python

### Unsafe stdlib defaults

```python
import xml.etree.ElementTree as ET
tree = ET.fromstring(user_xml)     # Expands entities by default.

import xml.sax
xml.sax.parseString(user_xml, handler)

import xml.dom.minidom
doc = xml.dom.minidom.parseString(user_xml)
```

### Safe: `defusedxml`

```python
from defusedxml import ElementTree as ET
tree = ET.fromstring(user_xml)    # Rejects entities, doctypes, XInclude.

import defusedxml.sax
defusedxml.sax.parseString(user_xml, handler)

import defusedxml.minidom
doc = defusedxml.minidom.parseString(user_xml)
```

`defusedxml` drops in as a replacement. Always.

### lxml

```python
from lxml import etree

parser = etree.XMLParser()           # Defaults allow local entities (CVE-2024-6508 family).
tree = etree.fromstring(user_xml, parser)

parser = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    load_dtd=False,
    dtd_validation=False,
    huge_tree=False,
)
tree = etree.fromstring(user_xml, parser)   # Safe.
```

### BeautifulSoup

```python
from bs4 import BeautifulSoup
soup = BeautifulSoup(user_xml, "xml")       # Safe by default when backed by lxml's HTML parser,
                                             # or when lxml features are not enabled.
```

Sentry uses this shape in `src/sentry/shared_integrations/response/xml.py`. Treat as safe unless the code passes explicit features that re-enable entity resolution.

## JavaScript / Node

### xml2js

```ts
import { parseString } from 'xml2js';
parseString(userXml, (err, result) => { ... });
```

`xml2js` does not support DTDs or external entities by default and is generally safe.

### libxmljs

```ts
import { parseXml } from 'libxmljs';
const doc = parseXml(userXml);                    // Defaults do not load DTDs.
const doc = parseXml(userXml, { noent: true });   // UNSAFE: resolves entities.
```

`noent: true` reintroduces XXE. Flag any use.

### sax / htmlparser2

Event-based parsers; do not resolve entities. Safe.

### fast-xml-parser

Configurable. The default is safe; flag when `allowBooleanAttributes`, `processEntities`, or `htmlEntities` is set to enable entity processing on untrusted XML.

## Java

### DocumentBuilderFactory

```java
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
DocumentBuilder db = dbf.newDocumentBuilder();
Document doc = db.parse(userXmlInputStream);     // Defaults allow DTDs, entities.
```

Safe configuration (must set all):

```java
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
dbf.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
dbf.setXIncludeAware(false);
dbf.setExpandEntityReferences(false);
```

OWASP's XXE Prevention Cheat Sheet is the canonical reference.

### SAXParserFactory, XMLInputFactory, SAXBuilder

Same pattern. Each has its own set of features to disable. Missing any is potentially exploitable.

### Spring `WebServiceTemplate`, JAXB

Higher-level libraries often ship safe defaults, but some older versions or misconfigurations re-enable entities. Check version and config.

## .NET

```csharp
var doc = new XmlDocument();
doc.LoadXml(userXml);                       // Pre-4.5.2: unsafe default.

// Safe:
var doc = new XmlDocument();
doc.XmlResolver = null;                     // Block external resources.
doc.LoadXml(userXml);

var reader = XmlReader.Create(stream, new XmlReaderSettings {
    DtdProcessing = DtdProcessing.Prohibit,
    XmlResolver = null,
});
```

.NET 4.5.2+ defaults to `DtdProcessing.Prohibit` for `XmlReader`, but `XmlDocument` and `XDocument` can still be misconfigured. Always set `XmlResolver = null`.

## XML-adjacent surfaces

### SAML

SAML assertions are XML, often parsed with DOM/XML security libraries. XXE in SAML is historically devastating. Check that the SAML library:

- Disables entity resolution.
- Performs signature validation (ruby-saml CVE-2024-45409 is the recent signature-bypass case).

### SOAP / WS-*

Legacy; if present, assume XXE-prone by default and require explicit hardening.

### OOXML / XLSX

`.docx`, `.xlsx`, `.pptx` are ZIP archives containing XML. Libraries parsing these (openpyxl, apache-poi, jszip + xml2js pipelines) may pass the inner XML through an unsafe parser. Review each step.

## Canonical Incidents

- **CVE-2024-6508 — lxml**: defaults allowed local entities unless `resolve_entities=False`.
- **CVE-2013-1664 / CVE-2013-1665** (Python stdlib, still a live risk if `defusedxml` is not used).
- Any SAML library without entity-resolution hardening has historically had an XXE advisory; SAMLtool, python-saml, ruby-saml, Shibboleth.

## Detection Heuristics

For every XML parse in a diff:

1. **Is the input trace to an untrusted source?** Request body, uploaded file, webhook payload, third-party API response.
2. **Is the parser's default mode safe?** Python stdlib: no. `lxml`: no (unless `resolve_entities=False`). `defusedxml`: yes. `xml2js` (Node): yes. `sax` (Node): yes. `libxmljs`: yes unless `noent: true`. Java `DocumentBuilder`: no unless all features disabled.
3. **Is it SAML / OOXML / SOAP** wrapping the parse? Review the wrapper library.

## False-Positive Traps

- `defusedxml.*` is the fix.
- `BeautifulSoup(text, "xml")` in Sentry's use is safe (no explicit unsafe features).
- `sax`, `xml2js`, `fast-xml-parser` (default config) in Node do not resolve entities.
- `XmlReader` with `DtdProcessing.Prohibit` in modern .NET is safe.
- Parsing a hardcoded string literal is not XXE regardless of parser.

## Diff Heuristics

1. New `xml.etree.*`, `xml.sax.*`, `xml.dom.*` (stdlib, unsafe defaults).
2. New `lxml.etree.fromstring(x, parser)` where parser lacks `resolve_entities=False`.
3. New `libxmljs.parseXml(x, { noent: true })`.
4. New Java `DocumentBuilderFactory.newInstance()` without the five required feature settings.
5. New .NET `XmlDocument` or `XmlReader` without `XmlResolver = null` / `DtdProcessing = Prohibit`.
6. New SAML / SOAP / OOXML parser without an explicit entity-hardening step.
7. `fast-xml-parser` with `processEntities: true`.

## Verification Commands

```bash
# Python stdlib XML (candidates for defusedxml migration)
rg -n 'xml\.etree|xml\.sax|xml\.dom|xml\.parsers\.expat' <file>

# lxml
rg -n 'lxml\.(etree|objectify)' <file>
rg -n 'resolve_entities|no_network|load_dtd' <file>

# defusedxml (presence is the fix)
rg -n 'defusedxml' <file>

# Node XML libraries
rg -n 'require\(.xml2js.\)|require\(.libxmljs.\)|require\(.sax.\)|fast-xml-parser' <file>

# Java
rg -n 'DocumentBuilderFactory|SAXParserFactory|XMLInputFactory' <file>
rg -n 'disallow-doctype-decl|external-general-entities' <file>

# .NET
rg -n 'XmlDocument|XmlReader|XDocument|DtdProcessing|XmlResolver' <file>
```
