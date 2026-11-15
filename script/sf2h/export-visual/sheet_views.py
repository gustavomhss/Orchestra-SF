"""Read XLSX OOXML cells, not screenshots or reconstructed Office files."""
import html
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PACKAGE_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def render_sheet_views(source, target):
    result = []
    with zipfile.ZipFile(source) as archive:
        book = ET.fromstring(archive.read("xl/workbook.xml"))
        mapping = {item.attrib["Id"]: item.attrib.get("Target", "")
                   for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
                   if item.tag == PACKAGE_REL + "Relationship"}
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            strings = ["".join(node.text or "" for node in item.iter(NS + "t"))
                       for item in root.iter(NS + "si")]
        for number, reference in enumerate(book.iter(NS + "sheet"), 1):
            name = reference.attrib.get("name", f"sheet-{number}")
            rid = reference.attrib.get(REL + "id")
            href = mapping.get(rid, "")
            member = href.lstrip("/") if href.startswith("/") else posixpath.normpath(posixpath.join("xl", href))
            if not member.startswith("xl/worksheets/") or member not in archive.namelist():
                raise ValueError("Workbook sheet relationship unavailable: " + name)
            document = ET.fromstring(archive.read(member))
            dimension_node = document.find(NS + "dimension")
            dimension = dimension_node.attrib.get("ref", "unknown") if dimension_node is not None else "unknown"
            rows = []
            formula_count = 0
            for cell in document.iter(NS + "c"):
                coordinate = cell.attrib.get("r", "")
                value = cell.find(NS + "v")
                inline = cell.find(NS + "is")
                formula = cell.find(NS + "f")
                content = "" if value is None else (value.text or "")
                if cell.attrib.get("t") == "s" and content:
                    content = strings[int(content)]
                if inline is not None:
                    content = "".join(child.text or "" for child in inline.iter(NS + "t"))
                if formula is not None:
                    formula_count += 1
                rows.append((coordinate, content, formula.text if formula is not None else ""))
                if len(rows) > 15000:
                    raise ValueError("Sheet exceeds bounded structural reader: " + name)
            path = target / ("sheet-%02d.html" % number)
            body = '<!doctype html><html><head><meta charset="utf-8"><style>' \
                   'body{font:13px/1.4 system-ui,sans-serif;margin:24px}' \
                   'table{border-collapse:collapse}td,th{padding:5px;border:1px solid #aaa;text-align:left;vertical-align:top}' \
                   'td{white-space:pre-wrap;overflow-wrap:anywhere}code{font-family:monospace}</style></head><body>'
            body += "<h1>" + html.escape(name) + "</h1><p>Actual OOXML cells from original XLSX. "\
                    "This is a structural inspection view, not an XLSX page render. "\
                    "Dimension " + html.escape(dimension) + ".</p>"
            body += "<table><tr><th>Cell</th><th>Value/cache</th><th>Formula</th></tr>"
            for coordinate, content, formula in rows:
                body += "<tr><td><code>" + html.escape(coordinate) + "</code></td><td>" + \
                        html.escape(content) + "</td><td>" + html.escape(formula or "") + "</td></tr>"
            path.write_text(body + "</table></body></html>\n", encoding="utf-8")
            result.append({"name": name, "dimension": dimension, "cells": len(rows),
                           "formulaCells": formula_count, "sourceRelationship": member,
                           "sourceView": path.name})
    return result
