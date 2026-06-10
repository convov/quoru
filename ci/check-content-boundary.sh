#!/bin/bash
# ci/check-content-boundary.sh
#
# Content boundary check for the public quoru repo:
#
#   1. Public-facing surfaces (docs, code comments, examples) must not contain
#      internal strategy vocabulary (positioning, pricing, competitive framing).
#   2. Public-facing surfaces must not reference the quoru-internal repo.
#
# There is no license/dependency boundary check today — all current quoru
# crates are BSL 1.1, no OSS/paid split inside the public repo (the cloud
# tier lives in quoru-internal/cloud/ and never ships here).
#
# Run in CI; safe to run locally. Scans tracked files only (git ls-files), so
# local worktrees, target/, node_modules/, and other untracked state are
# automatically excluded.

set -e

VIOLATIONS=0

# --- Sensitive Content Checks ---
#
# All file scans below operate on the git-tracked set (git ls-files).

# Files whose name alone signals an internal-strategy artifact.
INTERNAL_FILE_PATTERNS='(revenue-projection|competitive-analysis|go-to-market|gtm-strategy|fundraising-)'
FOUND=$(git ls-files | grep -i -E "$INTERNAL_FILE_PATTERNS" || true)
if [ -n "$FOUND" ]; then
    echo "❌ BOUNDARY VIOLATION: file name matches internal strategy pattern:"
    echo "$FOUND" | sed 's/^/   /'
    echo "   → This belongs in convov/quoru-internal"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Sensitive strategy vocabulary.
#
# Public docs describe WHAT the system does, not HOW it competes. Positioning,
# pricing, competitive analysis, and roadmap framing live in quoru-internal.
#
# Whole-word match for standalone terms (so "moat" doesn't false-positive on
# "automated"). Multi-word phrases use loose matching.
SENSITIVE_WORDS='\b(moat|GTM|TAM|SAM|SOM)\b'
SENSITIVE_PHRASES='revenue projection|pricing tier|competitive advantage|go.to.market|north.star|ARR target|MRR target|burn rate|fundrais'

# Product-boundary attribution: "Quoru <product> (should|will|can) ..." is
# explicit free-vs-paid positioning, not technical description.
PRODUCT_BOUNDARY='Quoru (OSS|Cloud|Enterprise|Dedicated) (should|will|can) '

SENSITIVE_KEYWORDS="${SENSITIVE_WORDS}|${SENSITIVE_PHRASES}|${PRODUCT_BOUNDARY}"

# Scan markdown, Rust source, example DSL, and MDX from the tracked set.
# Exclude CHANGELOG (historical), this script (contains the wordlist), and
# CLAUDE.md / AGENTS.md (legitimately document the boundary itself).
TRACKED=$(git ls-files \
    | grep -E '\.(md|mdx|rs|fuse)$' \
    | grep -v -E '(^CHANGELOG\.md$|^ci/check-content-boundary\.sh$|(^|/)CLAUDE\.md$|(^|/)AGENTS\.md$)' \
    || true)

if [ -n "$TRACKED" ]; then
    MATCHES=$(echo "$TRACKED" | xargs grep -l -i -E "$SENSITIVE_KEYWORDS" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
        echo "❌ SENSITIVE CONTENT: public files contain internal strategy vocabulary:"
        echo "$MATCHES" | while read f; do
            echo "   $f"
            grep -n -i -E "$SENSITIVE_KEYWORDS" "$f" | head -3 | sed 's/^/      /'
        done
        echo ""
        echo "   → This vocabulary belongs in convov/quoru-internal, not the public repo."
        echo "   → Public docs describe what the system does, not how it competes."
        VIOLATIONS=$((VIOLATIONS + 1))
    fi

    # References to quoru-internal/ from a public file are almost always leaks.
    # CLAUDE.md + AGENTS.md (allowed setup/bootstrap guidance) are excluded above.
    REF_TRACKED=$(git ls-files \
        | grep -E '\.(md|mdx|rs|fuse|toml|ya?ml)$' \
        | grep -v -E '(^ci/check-content-boundary\.sh$|(^|/)CLAUDE\.md$|(^|/)AGENTS\.md$)' \
        || true)
    INTERNAL_REFS=$(echo "$REF_TRACKED" | xargs grep -l -E "quoru-internal/" 2>/dev/null || true)
    if [ -n "$INTERNAL_REFS" ]; then
        echo "❌ INTERNAL PATH LEAK: public files reference quoru-internal/:"
        echo "$INTERNAL_REFS" | while read f; do
            echo "   $f"
            grep -n -E "quoru-internal/" "$f" | head -3 | sed 's/^/      /'
        done
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
fi

if [ $VIOLATIONS -gt 0 ]; then
    echo ""
    echo "❌ $VIOLATIONS boundary issue(s) found. Review output above."
    exit 1
fi

echo "✅ All boundary checks pass."
