#!/usr/bin/env bash
echo "┏━━━ 🧹 CLEAN $(pwd) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm rimraf dist *.tsbuildinfo
