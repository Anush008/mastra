#!/usr/bin/env bash
echo "┏━━━ 🎯 TEST: $(pwd) ━━━━━━━━━━━━━━━━━━━"
pnpm lerna run test --stream
