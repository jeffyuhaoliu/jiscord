#!/bin/bash

# --- CONFIGURATION ---
AGENT_CMD="claude"
ARCH_FILE="architecture.md"
MAX_ITERATIONS=${1:-15}    # Safeguard against infinite loops (override with first arg)
WAIT_ON_LIMIT=3600         # Seconds to wait if rate limited (1 hour)
ITERATION_COUNT=0

echo "🚀 Initializing The Guardian Loop for Discord Clone..."
echo "🛡️ Safety Limit: $MAX_ITERATIONS iterations."

# 1. PRE-FLIGHT CHECK
if [ ! -f "$ARCH_FILE" ]; then
    echo "❌ Error: $ARCH_FILE not found! Create your architecture first."
    exit 1
fi

LAST_TASK_ID=""
STUCK_COUNT=0
MAX_STUCK=2  # Stop if the same task is picked up this many times in a row

while [ $ITERATION_COUNT -lt $MAX_ITERATIONS ]; do
    ((ITERATION_COUNT++))

    # 2. QUERY MEMORY: Resume in-progress tasks first, but skip blocked ones
    # A task is "blocked" if any of its dependencies are still open/in_progress
    TASK_ID=""
    while IFS= read -r candidate; do
        [ -z "$candidate" ] && continue
        # Check if this candidate has unresolved blocking dependencies
        BLOCKED=$(bd show "$candidate" --json 2>/dev/null | jq -r '
            (.[0].dependencies // []) |
            map(select(.type == "blocks")) |
            length > 0
        ')
        if [ "$BLOCKED" = "false" ] || [ -z "$BLOCKED" ]; then
            TASK_ID="$candidate"
            break
        fi
        echo "⏭️  Skipping $candidate (has unresolved dependencies)"
    done < <(bd list --status in_progress --json 2>/dev/null | jq -r 'sort_by(.updated_at) | reverse | .[].id // empty')

    [ -z "$TASK_ID" ] && TASK_ID=$(bd ready --json | jq -r '.[0].id // empty')

    if [ -z "$TASK_ID" ]; then
        echo "✅ No 'ready' beads found. Project is either done or blocked. Ending loop."
        break
    fi

    # Stuck detection: same task picked up too many times in a row
    if [ "$TASK_ID" = "$LAST_TASK_ID" ]; then
        ((STUCK_COUNT++))
        if [ $STUCK_COUNT -ge $MAX_STUCK ]; then
            echo "🔁 STUCK: '$TASK_ID' selected $STUCK_COUNT times in a row without closing. Stopping loop."
            echo "Manually resolve or close this task, then re-run."
            exit 1
        fi
    else
        STUCK_COUNT=0
    fi
    LAST_TASK_ID="$TASK_ID"

    echo "----------------------------------------------------"
    echo "📍 Iteration: $ITERATION_COUNT / $MAX_ITERATIONS"
    echo "📍 Working on: $TASK_ID"

    # 3. CONTEXT GATHERING
    TASK_CONTEXT=$(bd show "$TASK_ID")
    ARCH_CONTEXT=$(cat "$ARCH_FILE")

    # 4. EXECUTION WITH TOKEN GUARD (Capturing output to check for errors)
    # We use a temporary log file to scan for "Rate Limit" or "Token" messages
    $AGENT_CMD <<EOF > session_log.txt 2>&1
# SYSTEM ROLE
You are a Senior Software Engineer. Adhere to architecture and use Beads.

# ARCHITECTURE
$ARCH_CONTEXT

# TASK CONTEXT
$TASK_CONTEXT

# BEADS WORKFLOW COMMANDS (use exactly these)
- Mark in-progress : bd update $TASK_ID --status in_progress
- Close when done  : bd close $TASK_ID
- Add a note       : bd comment $TASK_ID "your message"

# RULES
1. If not already in_progress, run: bd update $TASK_ID --status in_progress
2. Implement the task according to the description and acceptance criteria.
3. When complete, run: bd close $TASK_ID
4. If blocked by an unresolved dependency, run: bd comment $TASK_ID "BLOCKED: <reason>" and exit. Do NOT loop or retry.
5. Exit immediately after completing step 3 or 4.
EOF

    # Capture the exit status
    EXIT_STATUS=$?

    # 5. ERROR & TOKEN HANDLING
    if [ $EXIT_STATUS -ne 0 ]; then
        if grep -qiE "limit reached|rate limit|insufficient quota|you've hit your limit|hit your limit|resets [0-9]" session_log.txt; then
            echo "🛑 TOKEN LIMIT REACHED. Cooling down for $((WAIT_ON_LIMIT / 60)) minutes..."
            sleep $WAIT_ON_LIMIT
            # Decrement count so this 'failed' attempt doesn't count toward MAX_ITERATIONS
            ((ITERATION_COUNT--))
            continue
        else
            echo "❌ CRITICAL ERROR: Agent exited with code $EXIT_STATUS."
            echo "Check 'session_log.txt' for details. Stopping loop for safety."
            exit 1
        fi
    fi

    # 6. PERSISTENCE LAYER: Git Save Point
    TASK_JSON=$(bd show "$TASK_ID" --json)
    TASK_TITLE=$(echo "$TASK_JSON" | jq -r '.[0].title // empty')
    TASK_DESC=$(echo "$TASK_JSON" | jq -r '.[0].description // empty')
    git add .
    git commit -m "Ralph Loop [$ITERATION_COUNT]: $TASK_TITLE" -m "$TASK_DESC"
    
    echo "🔄 Iteration $ITERATION_COUNT complete. Moving to next bead..."
    sleep 5
done

if [ $ITERATION_COUNT -eq $MAX_ITERATIONS ]; then
    echo "🏁 MAX_ITERATIONS reached. Loop stopped to prevent over-burn."
fi
