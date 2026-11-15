#!/usr/bin/env python3
"""Bounded SF66 evidence reader. Input: genuine Actions producer bytes, never test fixtures copied into a gallery."""
import csv
import hashlib
import html
import io
import json
import os
import pathlib
import platform
import re
import subprocess
import sys
import urllib.parse
import zipfile
from html.parser import HTMLParser
from xml.etree import ElementTree

ROOT = pathlib.Path(os.environ["RUNNER_TEMP"]) / "sf66-export-artifacts"
EXTENSIONS = {"docx", "pptx", "xlsx", "csv", "json", "html"}
REQUIRED = {
    "planner-viewer", "dashboard-backup", "members-admin", "opex-template",
    "procurement-register", "purchase-order", "suppliers-buyer",
    "composed-docx", "composed-pptx", "after-drift-docx",
    "after-drift-pptx", "legacy-egress-control",
}
PRIVATE_MARKERS = (
    "PRIVATE_BANK_SENTINEL_66", "PRIVATE_ACCOUNT_SENTINEL_66",
    "PRIVATE_RATE_SENTINEL_66", "PRIVATE_ATLAS_SENTINEL_66",
    "PRIVATE_RECEIPT_SENTINEL_66", "PRIVATE_NESTED_SENTINEL_66",
    "SALARY_SENTINEL_66", "SYNTHETIC_UNSELECTED_PRIVATE_66",
)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def command(*args, timeout=180):
    completed = subprocess.run(args, check=True, text=True,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               timeout=timeout)
    return completed.stdout.strip()


def put(path, content):
    path.write_text(content, encoding="utf-8")


def metadata(path):
    return {"path": str(path.relative_to(ROOT)), "sha256": digest(path),
            "bytes": path.stat().st_size}


def xlsx_sheets(path):
    with zipfile.ZipFile(path) as archive:
        workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
        names = [node.attrib.get("name", "") for node in workbook.iter(ns + "sheet")]
        result = []
        for index, name in enumerate(names, 1):
            member = "xl/worksheets/sheet%d.xml" % index
            dimension = "unknown"
            if member in archive.namelist():
                node = ElementTree.fromstring(archive.read(member)).find(ns + "dimension")
                if node is not None:
                    dimension = node.attrib.get("ref", "unknown")
            result.append({"name": name, "dimension": dimension})
        return result

class HtmlEvidence(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.scripts = 0
        self.cells = 0
        self.external = []

    def handle_starttag(self, tag, attrs):
        self.scripts += int(tag == "script")
        self.cells += int(tag in ("td", "th"))
        for key, value in attrs:
            if key in ("src", "href") and value and re.match(r"(?i)^(https?:|file:|data:|//)", value):
                self.external.append(value[:120])


def text_view(title, contents):
    return ('<!doctype html><html><head><meta charset="utf-8">'
            '<style>body{font:12px/1.4 "DejaVu Sans Mono",monospace; margin:25px}'
            'pre{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse}'
            'td,th{border:1px solid #777;padding:4px;text-align:left;vertical-align:top}'
            'h1{font:19px sans-serif}</style></head><body><h1>' +
            html.escape(title) + '</h1>' + contents + '</body></html>')


def source_view(source, format_, target):
    raw = source.read_bytes()
    details = {}
    if format_ == "xlsx":
        details["sheets"] = xlsx_sheets(source)
    if format_ in ("docx", "pptx", "xlsx"):
        with zipfile.ZipFile(source) as archive:
            visible = "\n".join(archive.read(name).decode("utf-8", "replace")
                for name in archive.namelist() if name.endswith(".xml"))
        details["officeXmlEntries"] = len([n for n in archive.namelist() if n.endswith(".xml")])
    else:
        visible = raw.decode("utf-8-sig", "strict")
    details["privateMarkersFound"] = [marker for marker in PRIVATE_MARKERS if marker in visible]
    if details["privateMarkersFound"]:
        raise ValueError("Restricted marker present: " + ", ".join(details["privateMarkersFound"]))
    if format_ == "csv":
        rows = list(csv.reader(io.StringIO(visible, newline=""), strict=True))
        if not rows or len(rows) > 10000 or max(map(len, rows)) > 200:
            raise ValueError("CSV size/shape outside bounded inspection")
        details.update({"rows": len(rows), "columns": len(rows[0]),
                        "rowWidths": sorted(set(map(len, rows)))})
        cells = "<table>" + "".join("<tr>" + "".join(
            ("<th>" if index == 0 else "<td>") + html.escape(cell) +
            ("</th>" if index == 0 else "</td>") for cell in row)
            + "</tr>" for index, row in enumerate(rows)) + "</table>"
        preview = target / "csv-source-view.html"
        put(preview, text_view("CSV source reader (derived view, not a product render)", cells))
        return preview, details
    if format_ == "json":
        parsed = json.loads(visible)
        details["jsonRootType"] = type(parsed).__name__
        preview = target / "json-source-view.html"
        put(preview, text_view("JSON source reader (derived view, not a product render)",
            "<pre>" + html.escape(json.dumps(parsed, ensure_ascii=False, indent=2)) + "</pre>"))
        return preview, details
    if format_ == "html":
        parser = HtmlEvidence()
        parser.feed(visible)
        details.update({"scriptElements": parser.scripts, "tableCells": parser.cells,
                        "externalResources": parser.external})
        if parser.scripts or parser.external:
            raise ValueError("Active or external HTML resources prohibited in hosted renderer")
    return source, details


def render(source, target, index):
    profile = pathlib.Path(os.environ["RUNNER_TEMP"]) / ("sf88-reader-profile-%04d" % index)
    transcript = command("libreoffice", "--headless", "-env:UserInstallation=" + profile.as_uri(),
                         "--convert-to", "pdf", "--outdir", str(target), str(source))
    put(target / "conversion.txt", transcript + "\n")
    pdfs = list(target.glob("*.pdf"))
    if len(pdfs) != 1:
        raise ValueError("LibreOffice did not create exactly one PDF")
    pdf = pdfs[0]
    info = command("pdfinfo", str(pdf))
    put(target / "pdfinfo.txt", info + "\n")
    match = re.search(r"^Pages:\s+(\d+)\s*$", info, re.MULTILINE)
    if not match or not 1 <= int(match.group(1)) <= 160:
        raise ValueError("PDF page count missing or outside bounded 1..160")
    put(target / "fonts.txt", command("pdffonts", str(pdf)) + "\n")
    command("pdftotext", "-layout", str(pdf), str(target / "extracted.txt"))
    command("pdftoppm", "-png", "-r", "110", str(pdf), str(target / "page"), timeout=360)
    pages = sorted(target.glob("page-*.png"))
    if len(pages) != int(match.group(1)):
        raise ValueError("Rendered PNG count differs from PDF page count")
    return pages


def gallery(entries, inspection):
    gallery_root = inspection / "gallery"
    gallery_root.mkdir()
    parts = ['<!doctype html><html><head><meta charset="utf-8"><title>SF88 — exported originals inspection</title>',
             '<style>body{font:16px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:1160px;color:#182538}'
             'h1,h2{line-height:1.2}section{border-top:2px solid #dbe3ed;padding:1.5rem 0}'
             'figure{margin:1.3rem 0}img{max-width:100%;border:1px solid #aaa;display:block}'
             'figcaption{font-size:.9rem}code{overflow-wrap:anywhere}iframe{width:100%;height:500px;border:1px solid #888}'
             '.small{color:#526171;font-size:.9rem}</style></head><body>',
             '<h1>SF88 — genuine exports: reader gallery</h1>',
             '<p>This shows new CI-produced originals, not 66 historical Action artifacts. Office previews are '
             'LibreOffice/PDF-derived; CSV and JSON are structured reader views; HTML is converted by LibreOffice '
             'and may differ from a browser. A PNG is conversion evidence, not independent visual approval.</p>',
             '<p>For original/preview SHA-256, tool versions and failures see '
             '<a href="../manifest.json">inspection manifest</a>. '
             'The functional test result is separate and may be FAIL even if the reader succeeds.</p>']
    for entry in entries:
        name = html.escape(entry["caseId"])
        original = urllib.parse.quote("../../" + entry["source"], safe="/-_.")
        parts.extend(["<section><h2>" + name + " — " + html.escape(entry["format"]) + "</h2>",
            "<p>Original: <a href=\"" + original + "\">" + html.escape(entry["source"]) +
            "</a><br> SHA-256 <code>" + entry["sha256"] + "</code>; reader " +
            html.escape(entry["status"]) + ".</p>"])
        if entry.get("details", {}).get("sheets"):
            parts.append("<p>Actual workbook sheets: " + ", ".join(
                html.escape(sheet["name"]) + " [" + html.escape(sheet["dimension"]) + "]"
                for sheet in entry["details"]["sheets"]) +
                ". The native PDF page-to-sheet mapping is not independently established.</p>")
        if entry["format"] == "html":
            parts.append("<p>Actual original HTML (sandboxed browser display; not a stored screenshot):</p>"
                         '<iframe sandbox="" src="' + original + '"></iframe>')
        if entry.get("derivedView"):
            path = urllib.parse.quote("../" + entry["derivedView"], safe="/-_.")
            parts.append('<p><a href="' + path +
                         '">Source-derived inspection HTML</a> (not the original export).</p>')
        if entry.get("pages"):
            pdf = next((output["path"] for output in entry["outputs"]
                       if output["path"].endswith(".pdf")), "")
            if pdf:
                parts.append('<p><a href="' + urllib.parse.quote("../" + pdf, safe="/-_.") +
                             '">Converted PDF</a> · <a href="' +
                             urllib.parse.quote("../" + entry["folder"] + "/extracted.txt", safe="/-_.") +
                             '">PDF extracted text</a> · <a href="' +
                             urllib.parse.quote("../" + entry["folder"] + "/fonts.txt", safe="/-_.") +
                             '">PDF fonts</a></p>')
            for page in entry["pages"]:
                src = urllib.parse.quote("../" + page["path"], safe="/-_.")
                parts.append('<figure><img loading="lazy" src="' + src +
                             '" alt="' + name + ' page ' + str(page["number"]) +
                             '"><figcaption>' + name + ', PDF page ' + str(page["number"]) +
                             '</figcaption></figure>')
        if entry.get("error"):
            parts.append("<p>Reader failure: " + html.escape(entry["error"]) + "</p>")
        parts.append("</section>")
    parts.append('</body></html>')
    put(gallery_root / "index.html", "\n".join(parts) + "\n")


def main():
    if not ROOT.is_dir() or ROOT.is_symlink():
        raise SystemExit("Missing genuine SF66 producer output directory")
    original_paths = sorted(path for path in ROOT.rglob("*") if path.is_file())
    if any(path.is_symlink() for path in ROOT.rglob("*")):
        raise SystemExit("Symlink in producer directory")
    manifests = sorted(ROOT.glob("*.manifest.json"))
    if not manifests:
        raise SystemExit("No generator manifests found")
    before = [metadata(path) for path in original_paths]
    inspection = ROOT / "_inspection"
    inspection.mkdir(exist_ok=False)
    request = json.loads(pathlib.Path(".ci-run.json").read_text(encoding="utf-8"))
    put(inspection / "request.json", json.dumps(request, indent=2) + "\n")
    def version(*args):
        try:
            return command(*args, timeout=20)
        except Exception as error:
            return "UNAVAILABLE: " + str(error)
    tools = {"python": platform.python_version(), "libreoffice": version("libreoffice", "--version"),
             "poppler": version("pdftoppm", "-v"),
             "fontconfig": version("fc-match", "--format", "%{family}|%{file}", "Aptos"),
             "packages": version("dpkg-query", "-W", "libreoffice-writer", "libreoffice-impress",
                                 "libreoffice-calc", "poppler-utils", "fontconfig")}
    cases = []
    seen = set()
    for manifest in manifests:
        item = json.loads(manifest.read_text(encoding="utf-8"))
        if "case_id" not in item:  # composed.manifest.json is an aggregate, not a produced file
            continue
        case = item["case_id"]
        filename = item["file_name"]
        if not isinstance(case, str) or not re.fullmatch(r"[a-z0-9-]+", case) or case in seen:
            raise SystemExit("Invalid or duplicate generator case_id")
        if not isinstance(filename, str) or pathlib.Path(filename).name != filename:
            raise SystemExit("Invalid generator filename")
        seen.add(case)
        source = ROOT / filename
        format_ = pathlib.Path(filename).suffix.lstrip(".").lower()
        if format_ not in EXTENSIONS or not source.is_file() or source.is_symlink():
            raise SystemExit("Missing or unsupported generated source: " + filename)
        if item.get("format") != format_ or item.get("byte_count") != source.stat().st_size \
                or item.get("sha256") != digest(source):
            raise SystemExit("Generated source does not match manifest: " + filename)
        cases.append((case, format_, source, manifest, item))
    entries = []
    for index, (case, format_, source, manifest, item) in enumerate(sorted(cases), 1):
        folder = "_inspection/file-%04d" % index
        target = ROOT / folder
        target.mkdir()
        entry = {"caseId": case, "source": str(source.relative_to(ROOT)),
                 "sourceManifest": str(manifest.relative_to(ROOT)), "format": format_,
                 "bytes": source.stat().st_size, "sha256": digest(source),
                 "folder": folder, "status": "FAILED"}
        try:
            render_input, details = source_view(source, format_, target)
            entry["details"] = details
            if render_input != source:
                entry["derivedView"] = str(render_input.relative_to(ROOT))
            pages = render(render_input, target, index)
            entry["pages"] = [{"number": number, **metadata(page)}
                              for number, page in enumerate(pages, 1)]
            entry["status"] = "COMPLETED"
        except Exception as error:
            entry["error"] = str(error)
        entry["sha256AfterRead"] = digest(source)
        entry["originalUnchanged"] = entry["sha256AfterRead"] == entry["sha256"]
        if not entry["originalUnchanged"]:
            entry["status"] = "FAILED"
        entry["outputs"] = [metadata(path) for path in sorted(target.rglob("*")) if path.is_file()]
        entries.append(entry)
    after = [metadata(path) for path in original_paths]
    unchanged = before == after
    missing = sorted(REQUIRED - seen)
    unexpected = sorted(seen - REQUIRED - {"legacy-egress-revoked"})
    gallery(entries, inspection)
    result = {
        "schema": "sf88-export-visual-reader-v1",
        "snapshotSha": os.environ.get("GITHUB_SHA"),
        "productSourceParentSha": version("git", "rev-parse", "HEAD^"),
        "runId": os.environ.get("GITHUB_RUN_ID"),
        "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "workflowBlobSha": version("git", "hash-object", ".github/workflows/test-ci.yml"),
        "requestSha256": digest(inspection / "request.json"),
        "functionalStepOutcome": os.environ.get("SF66_PRODUCT_STEP_OUTCOME", "UNAVAILABLE"),
        "functionalNumericExitStatus": "NOT_CAPTURED_BY_EXISTING_TEST_STEP",
        "functionalAcceptance": "NOT_ASSERTED; check original Run tests step and job conclusion",
        "matrix66HistoricalObservations": 14,
        "matrix66HistoricalRuns": [43667294352, 43667789028, 43668383518],
        "historicalArtifactsReused": False,
        "currentUniqueGeneratorCases": len(seen),
        "mandatoryCaseIds": sorted(REQUIRED),
        "missingMandatoryCaseIds": missing,
        "unexpectedCaseIds": unexpected,
        "originalsBefore": before, "originalsAfter": after,
        "allOriginalsByteIdentical": unchanged,
        "tools": tools, "readers": entries,
        "readerVerdict": "COMPLETED" if unchanged and not missing and not unexpected and
            all(entry["status"] == "COMPLETED" for entry in entries) else "FAILED",
        "visualInspection": "PENDING_INDEPENDENT_HUMAN_PAGE_SHEET_SLIDE_REVIEW",
        "gallery": "_inspection/gallery/index.html",
        "notes": [
            "14 historical observations include a duplicate composed-docx across distinct runs; a new own-only run yields 12 mandatory cases plus optional failed-egress negative evidence.",
            "PDF and PNG are inspection derivatives, never additional original export formats.",
            "Excel workbook PDF page-to-sheet correspondence has not been asserted.",
            "HTML original has an optional sandboxed browser frame in the gallery; conversion preview is LibreOffice, not Chromium.",
        ],
    }
    put(inspection / "manifest.json", json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    put(inspection / "SUMMARY.md", "# SF88 evidence reader\n\n"
        + "New generated cases: %d; mandatory absent: %s\n\n" % (len(seen), missing)
        + "Reader: %s; original bytes identical: %s\n\n" % (result["readerVerdict"], unchanged)
        + "Functional: %s (numeric status not captured); VISUAL: PENDING independent review\n\n" %
          result["functionalStepOutcome"])
    print("SF88_READER " + json.dumps({"verdict": result["readerVerdict"],
          "cases": len(seen), "missing": missing, "functional": result["functionalStepOutcome"]}))
    if result["readerVerdict"] != "COMPLETED":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
