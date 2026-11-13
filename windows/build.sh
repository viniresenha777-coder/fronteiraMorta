#!/usr/bin/env bash
# Gera o FronteiraMorta.exe (Windows 64 bits) com o jogo da pasta web/ embutido.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf game
cp -r ../web game
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H windowsgui -s -w" -o FronteiraMorta.exe .
rm -rf game
echo "Pronto: windows/FronteiraMorta.exe"
