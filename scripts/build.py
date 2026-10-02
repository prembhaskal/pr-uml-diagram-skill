#!/usr/bin/env python3
"""Validate a PR-diagram data.json and render a standalone HTML file.

Usage:
  build.py data.json --html <path>.html
"""
import argparse
import html
import json
import sys
from pathlib import Path

TEMPLATES = Path(__file__).resolve().parent.parent / "templates"
CHANGES = {"A", "C", "R"}


def validate(d):
    errs = []
    for key in ("title", "subtitle", "prs", "lanes", "nodes", "edges"):
        if key not in d:
            errs.append(f"missing top-level key: {key}")
    if errs:
        return errs
    pr_nums = {p["n"] for p in d["prs"]}
    ids = set()
    for n in d["nodes"]:
        nid = n.get("id")
        if nid in ids:
            errs.append(f"duplicate node id: {nid}")
        ids.add(nid)
        if not 0 <= n.get("lane", -1) < len(d["lanes"]):
            errs.append(f"node {nid}: lane {n.get('lane')} out of range")
        for k, v in n.get("prs", {}).items():
            if int(k) not in pr_nums:
                errs.append(f"node {nid}: unknown PR {k}")
            if v not in CHANGES:
                errs.append(f"node {nid}: bad change '{v}' for PR {k}")
        for m in n.get("members", []):
            if m.get("change") not in CHANGES or m.get("pr") not in pr_nums:
                errs.append(f"node {nid}: bad member {m}")
        n.setdefault("members", [])
        n.setdefault("prs", {})
        n.setdefault("summary", "")
    for e in d["edges"]:
        for end in ("from", "to"):
            if e.get(end) not in ids:
                errs.append(f"edge {e.get('from')}->{e.get('to')}: unknown node '{e.get(end)}'")
        if e.get("change") not in CHANGES:
            errs.append(f"edge {e.get('from')}->{e.get('to')}: bad change '{e.get('change')}'")
        if e.get("pr") not in pr_nums and e.get("pr") != 0:
            errs.append(f"edge {e.get('from')}->{e.get('to')}: unknown PR {e.get('pr')}")
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("--html", required=True)
    a = ap.parse_args()

    data = json.loads(Path(a.data).read_text())
    errs = validate(data)
    if errs:
        print("data.json invalid:", *errs, sep="\n  ", file=sys.stderr)
        sys.exit(1)
    blob = json.dumps(data, indent=1, ensure_ascii=False)
    safe = blob.replace("</", "<\\/")
    out = (TEMPLATES / "diagram.html").read_text().replace("__DATA__", safe).replace("__TITLE__", html.escape(data["title"]))
    Path(a.html).write_text(out)
    print(f"html:   {a.html}")
    print(f"ok: {len(data['nodes'])} nodes, {len(data['edges'])} edges, {len(data['prs'])} PRs")


if __name__ == "__main__":
    main()
