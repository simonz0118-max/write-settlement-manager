#!/bin/zsh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
clear
printf "\nWRITE Settlement Manager v5 — 一键更新\n"
printf "=======================================\n\n"
"$ROOT/1_发布到GitHub.command"
"$ROOT/2_发布到Cloudflare.command"
printf "\n✅ V5 已更新到 GitHub 与 Cloudflare\n"
printf "GitHub: https://github.com/simonz0118-max/write-settlement-manager\n"
printf "网站:   https://write-settlement-manager.pages.dev/\n\n"
open "https://github.com/simonz0118-max/write-settlement-manager"
