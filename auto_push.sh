#!/bin/bash
# Auto git push at each completed 10-episode boundary for the 1301-1400 batch.
set -euo pipefail

cd /root/RI

DIR="burmese-episodes/1301-1400"
TRACK="track.md"
LAST_PUSH_FILE="/root/RI/.last_push_count"

count=$(find "$DIR" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
last_push=$(cat "$LAST_PUSH_FILE" 2>/dev/null || echo "0")

# Push only when a completed decile boundary is reached: 10,20,...,100.
target=$(( (count / 10) * 10 ))

if [ "$target" -le "$last_push" ] || [ "$target" -eq 0 ]; then
    echo "NO_PUSH: $count episodes done (last push at $last_push; next boundary $((last_push + 10)))"
    exit 0
fi

# Only commit up to the completed boundary. Example target=80 => episodes 1301-1380.
end_episode=$((1300 + target))
total="$end_episode"

sed -i "s/- Burmese translated episodes:.*/- Burmese translated episodes: $total/" "$TRACK"

git add "$TRACK" reader/manifest.json 2>/dev/null || true
for ep in $(seq -w 1301 "$end_episode"); do
    file="$DIR/${ep}.md"
    [ -f "$file" ] && git add "$file"
done

if git diff --cached --quiet; then
    echo "$target" > "$LAST_PUSH_FILE"
    echo "NO_CHANGES: boundary $target reached but nothing staged"
    exit 0
fi

git commit -m "Translate episodes $((1300 + last_push + 1))-$end_episode [auto-push]"
git push origin main

echo "$target" > "$LAST_PUSH_FILE"
echo "PUSHED: episodes $((1300 + last_push + 1))-$end_episode (boundary $target/$count)"
