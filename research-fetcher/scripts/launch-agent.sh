#!/usr/bin/env bash
# Launch the Research Digest Agent.
# Sources ~/.research-agent-env for secrets (ANTHROPIC_AUTH_TOKEN, etc.)
# Used by the launchd plist — also runnable directly.

set -euo pipefail

AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$HOME/.research-agent-env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

# Fallback: inherit from current shell if env vars already set
: "${ANTHROPIC_AUTH_TOKEN:?ANTHROPIC_AUTH_TOKEN must be set in $ENV_FILE or the environment}"
export ANTHROPIC_AUTH_TOKEN
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.anthropic.com}"
export ANTHROPIC_DEFAULT_OPUS_MODEL="${ANTHROPIC_DEFAULT_OPUS_MODEL:-claude-opus-latest}"

exec /Users/I758976/.local/bin/node "$AGENT_DIR/src/agent.js"
