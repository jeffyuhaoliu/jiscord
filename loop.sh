#!/bin/bash

# --- CONFIGURATION ---
AGENT_CMD="claude" 
ARCH_FILE="architecture.md"
MAX_ITERATIONS=15      # Safeguard against infinite loops
WAIT_ON_LIMIT=3600    # Seconds to wait if rate limited (1 hour)
ITERATION_COUNT=0

echo "🚀 Initializing The Guardian Loop for Discord Clone..."
echo "🛡️ Safety Limit: $MAX_ITERATIONS iterations."

# 1. PRE-FLIGHT CHECK
if [ ! -f "$ARCH_FILE" ]; then
    echo "❌ Error: $ARCH_FILE not found! Create your architecture first."
    exit 1
fi

while [ $ITERATION_COUNT -lt $MAX_ITERATIONS ]; do
    ((ITERATION_COUNT++))
    
    # 2. QUERY MEMORY: Get the next ready task
    TASK_ID=$(bd ready --ids-only | head -n 1)

    if [ -z "$TASK_ID" ]; then
        echo "✅ No 'ready' beads found. Project is either done or blocked. Ending loop."
        break
    fi

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

# RULES
1. Run 'bd start $TASK_ID'.
2. If success: 'bd finish $TASK_ID'. 
3. If failure/stuck: 'bd note $TASK_ID' with detailed logs.
4. Exit immediately after the Beads command.
EOF

    # Capture the exit status
    EXIT_STATUS=$?

    # 5. ERROR & TOKEN HANDLING
    if [ $EXIT_STATUS -ne 0 ]; then
        if grep -qiE "limit reached|rate limit|insufficient quota" session_log.txt; then
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
    git add .
    git commit -m "Ralph Loop [$ITERATION_COUNT]: Processed $TASK_ID"
    
    echo "🔄 Iteration $ITERATION_COUNT complete. Moving to next bead..."
    sleep 5
done

if [ $ITERATION_COUNT -eq $MAX_ITERATIONS ]; then
    echo "🏁 MAX_ITERATIONS reached. Loop stopped to prevent over-burn."
fi
