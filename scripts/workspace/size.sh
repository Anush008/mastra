#!/usr/bin/env bash
echo "┏━━━ 🔍 Analyze package size $(pwd) ━━━━━━━━━━━━━━━━━━━"
pnpm lerna run size --stream
