#!/bin/zsh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

clear
printf "\nWRITE Settlement Manager — 一键发布\n"
printf "====================================\n"
printf "步骤 1：GitHub\n步骤 2：Cloudflare Pages\n\n"

"$ROOT/1_发布到GitHub.command"
"$ROOT/2_发布到Cloudflare.command"
