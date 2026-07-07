#!/usr/bin/env python3
"""Render the Markdown reference docs to print-friendly PDFs.

The PDFs committed next to the app (e.g. METRICS.pdf) are generated from their
Markdown source with this script — there is no LaTeX/pandoc dependency, just
python-markdown + WeasyPrint.

Install the doc-build deps (they are NOT app runtime deps):

    pip install -r scripts/requirements-docs.txt

Usage:

    python scripts/build_pdfs.py                 # rebuild METRICS.pdf
    python scripts/build_pdfs.py --all           # rebuild the whole doc set
    python scripts/build_pdfs.py STOCK_METRICS.md # rebuild specific file(s)

Each <name>.md is written to <name>.pdf in the same directory.
"""
import os
import sys

import markdown
from weasyprint import HTML

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The curated doc set rebuilt by --all (paths relative to the app directory).
DOC_SET = ["METRICS.md", "STOCK_METRICS.md", "SCREENER_COLUMNS.md"]

MD_EXTENSIONS = ["tables", "fenced_code", "sane_lists", "attr_list", "md_in_html"]

# Print stylesheet. Tuned for the table-heavy reference docs: headers repeat
# across page breaks and rows never split mid-cell.
CSS = """
@page {
  size: A4;
  margin: 18mm 16mm 20mm 16mm;
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font: 9px "DejaVu Sans", sans-serif; color: #8a94a0;
  }
}
* { box-sizing: border-box; }
body {
  font-family: "DejaVu Sans", "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5px; line-height: 1.5; color: #1c2530; margin: 0;
}
h1 { font-size: 24px; font-weight: 700; color: #0f1720; margin: 0 0 4px; letter-spacing: -0.3px; }
h1 + p { color: #5a6672; font-size: 11px; }
h2 {
  font-size: 15px; font-weight: 700; color: #10704f;
  margin: 22px 0 8px; padding-bottom: 5px;
  border-bottom: 2px solid #1fd1a0; break-after: avoid;
}
h3 { font-size: 12px; font-weight: 700; color: #0f1720; margin: 14px 0 6px; break-after: avoid; }
p { margin: 6px 0; }
a { color: #0f6f4e; text-decoration: none; }
strong { color: #0f1720; font-weight: 700; }
code {
  font-family: "DejaVu Sans Mono", monospace; font-size: 9px;
  background: #eef1f4; padding: 1px 4px; border-radius: 3px; color: #23303c;
}
blockquote {
  margin: 10px 0; padding: 8px 12px;
  background: #f4f8f6; border-left: 3px solid #1fd1a0;
  color: #35424e; font-size: 10px; border-radius: 0 4px 4px 0;
}
blockquote p { margin: 3px 0; }
hr { border: 0; border-top: 1px solid #e2e7ec; margin: 16px 0; }
ul, ol { margin: 6px 0; padding-left: 20px; }
li { margin: 3px 0; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5px; break-inside: auto; }
thead { display: table-header-group; }      /* repeat header across page breaks */
tr { break-inside: avoid; }
th { background: #10704f; color: #fff; font-weight: 700; text-align: left; padding: 6px 9px; border: 1px solid #0d5c41; }
td { padding: 5px 9px; border: 1px solid #dce2e8; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f6f8fa; }
td strong { color: #0f1720; }
"""


def _resolve(md_arg):
    """Locate a Markdown source given a CLI arg, trying cwd then the app dir."""
    for cand in (md_arg, os.path.join(APP_DIR, md_arg)):
        if os.path.isfile(cand):
            return os.path.abspath(cand)
    raise SystemExit(f"error: markdown file not found: {md_arg}")


def build(md_path):
    """Render one Markdown file to <same-name>.pdf; return the output path."""
    pdf_path = os.path.splitext(md_path)[0] + ".pdf"
    with open(md_path, encoding="utf-8") as f:
        body = markdown.markdown(f.read(), extensions=MD_EXTENSIONS, output_format="html5")
    html = (f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<style>{CSS}</style></head><body>{body}</body></html>")
    HTML(string=html).write_pdf(pdf_path)
    return pdf_path


def main(argv):
    if argv == ["--all"]:
        docs = [os.path.join(APP_DIR, d) for d in DOC_SET]
    elif argv:
        docs = [_resolve(a) for a in argv]
    else:
        docs = [os.path.join(APP_DIR, "METRICS.md")]

    for md in docs:
        out = build(md)
        print(f"wrote {os.path.relpath(out, os.getcwd())}")


if __name__ == "__main__":
    main(sys.argv[1:])
