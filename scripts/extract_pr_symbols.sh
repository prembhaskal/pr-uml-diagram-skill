#!/usr/bin/env bash
# Usage: extract_pr_symbols.sh <repo-dir> <pr> [<pr> ...]
# Prints, per PR: title/state/base/head, per-file +/- stats, and added/removed
# top-level Go/Java/TS/Python declarations from non-test source files.
set -euo pipefail

repo="${1:?repo dir required}"; shift
[ $# -gt 0 ] || { echo "at least one PR number required" >&2; exit 1; }
cd "$repo"

export TEST_RE='(_test[.]go|Tests?[.]java|[.](test|spec)[.][jt]sx?|/test_[^/]*[.]py)$'
export DECL_RE='^[+-][[:space:]]*(func |type |class |interface |enum |record |def |export (default )?(function|class|const|interface|type) |(public|protected|private)[[:space:]].*[(]|[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[[:space:]]*"|[{][a-zA-Z.]+[(][)],[[:space:]]*[0-9]+[}])'

for pr in "$@"; do
  echo "=================== PR $pr ==================="
  gh pr view "$pr" --json number,title,state,baseRefName,headRefName,url,additions,deletions,changedFiles \
    --jq '"\(.title)\nstate=\(.state) base=\(.baseRefName) head=\(.headRefName) files=\(.changedFiles) +\(.additions) -\(.deletions)\n\(.url)"'
  echo "--- files"
  gh pr view "$pr" --json files --jq '.files[] | "\(.path) +\(.additions) -\(.deletions)"'
  echo "--- declarations (non-test)"
  gh pr diff "$pr" | awk '
    BEGIN { test_re = ENVIRON["TEST_RE"]; decl_re = ENVIRON["DECL_RE"] }
    /^diff --git/ { f = $3; sub(/^a\//, "", f); skip = (f ~ test_re) || (f ~ /[.](md|yaml|yml|json|sum|mod)$/); next }
    /^(\+\+\+|---)/ { next }
    !skip && $0 ~ decl_re { print f ": " substr($0, 1, 170) }
  '
  echo
done
