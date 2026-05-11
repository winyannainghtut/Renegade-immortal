#!/bin/bash
# Auto git push every 10 translated episodes (1301-1400 batch)
cd /root/RI || exit 1

DIR="burmese-episodes/1301-1400"
TRACK="track.md"

# Count translated episodes in 1301-1400
count=$(find "$DIR" -name "*.md" 2>/dev/null | wc -l)

# Check if we've hit a multiple of 10 and it's new
LAST_PUSH_FILE="/root/RI/.last_push_count"
last_push=$(cat "$LAST_PUSH_FILE" 2>/dev/null || echo "0")

if [ "$count" -ge 10 ] && [ "$count" -ge $((last_push + 10)) ]; then
    # Update track.md
    total=$((1300 + count))
    sed -i "s/- Burmese translated episodes:.*/- Burmese translated episodes: $total/" "$TRACK"
    
    # Git add, commit, push
    git add -A
    git commit -m "Translate episodes 1301-$((1300 + count)) [auto-push]" --allow-empty
    git push origin main
    
    echo "$count" > "$LAST_PUSH_FILE"
    echo "PUSHED: $count episodes translated (total: $total)"
else
    echo "NO_PUSH: $count episodes done (last push at $last_push)"
fi
