#!/usr/bin/env bash
# Atualiza o codigo do coletor (manual, de proposito: nada novo roda com os
# segredos sem voce decidir). Uso: sudo bash /opt/monitorvoo/deploy/linux/update.sh
set -euo pipefail
APP_DIR="/opt/monitorvoo"
[[ $EUID -eq 0 ]] || { echo "rode com sudo"; exit 1; }

cd "$APP_DIR"
before="$(git rev-parse --short HEAD)"
git fetch -q origin main
git log --oneline HEAD..origin/main
git merge -q --ff-only origin/main
"$APP_DIR/.venv/bin/pip" install -q -r collectors/requirements.txt
install -m 644 deploy/linux/systemd/*.service deploy/linux/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
echo "atualizado: $before -> $(git rev-parse --short HEAD)"
