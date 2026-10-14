#!/usr/bin/env bash
# MonitorVoo — prepara um notebook com Ubuntu Server 24.04 como coletor dedicado.
#
# Pre-requisitos (feitos no instalador do Ubuntu):
#   - disco criptografado (opcao "LVM com criptografia"/LUKS)
#   - OpenSSH server marcado; seu usuario de administracao criado
#   - chave SSH do seu PC copiada:  ssh-copy-id <usuario>@<ip-do-notebook>
#
# Uso (no notebook):
#   sudo bash setup.sh                 # primeira instalacao
#   sudo bash setup.sh                 # rodar de novo e seguro (idempotente)
#
# O que faz:
#   1. atualiza o sistema e liga atualizacoes de seguranca automaticas
#   2. firewall: nada entra (so SSH vindo da rede de casa) e o notebook nao
#      consegue abrir conexoes para outros aparelhos da casa
#   3. SSH so por chave (senha desligada), sem login de root
#   4. DNS criptografado (Quad9 via DNS-over-TLS): o provedor nao ve os sites
#   5. notebook funciona com a tampa fechada e nunca suspende; bateria limitada
#      a 80% quando o hardware permite (vira um no-break)
#   6. usuario de sistema "monitorvoo" sem login, codigo em /opt/monitorvoo,
#      segredos em .env com permissao 600
#   7. timers systemd: coleta de hora em hora e ingestao ANAC semanal
set -euo pipefail

REPO_URL="https://github.com/pedroitan/monitorvoo.git"
APP_DIR="/opt/monitorvoo"
APP_USER="monitorvoo"
ADMIN_USER="${SUDO_USER:-}"

[[ $EUID -eq 0 ]] || { echo "rode com sudo"; exit 1; }
[[ -n "$ADMIN_USER" && "$ADMIN_USER" != "root" ]] || { echo "rode com sudo a partir do seu usuario (nao como root direto)"; exit 1; }

step() { printf '\n==> %s\n' "$*"; }

step "Pacotes e atualizacoes automaticas"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq git python3 python3-venv ufw unattended-upgrades openssh-server
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
# Disco criptografado pede a senha no boot: sem reinicio automatico.
cat >/etc/apt/apt.conf.d/52monitorvoo-no-reboot <<'EOF'
Unattended-Upgrade::Automatic-Reboot "false";
EOF

step "Firewall"
GATEWAY="$(ip route | awk '/^default/ {print $3; exit}')"
LAN_CIDR="$(ip -o -f inet addr show scope global | awk '{print $4; exit}')"
LAN_NET="$(python3 -c "import ipaddress,sys; print(ipaddress.ip_interface(sys.argv[1]).network)" "$LAN_CIDR")"
echo "rede de casa: $LAN_NET, roteador: $GATEWAY"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$LAN_NET" to any port 22 proto tcp comment "SSH so da rede de casa"
# Saida: roteador liberado (DHCP/DNS local); demais aparelhos da casa bloqueados.
ufw allow out to "$GATEWAY" comment "roteador"
for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 fc00::/7; do
  ufw deny out to "$net" comment "isola dos aparelhos da casa"
done
ufw --force enable
ufw status verbose

step "SSH so por chave"
if [[ -s "/home/$ADMIN_USER/.ssh/authorized_keys" ]]; then
  cat >/etc/ssh/sshd_config.d/10-monitorvoo.conf <<EOF
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers $ADMIN_USER
X11Forwarding no
MaxAuthTries 3
EOF
  systemctl reload ssh
  echo "senha desligada; acesso so com a chave de $ADMIN_USER"
else
  echo "AVISO: /home/$ADMIN_USER/.ssh/authorized_keys vazio — mantive login por senha."
  echo "       Rode 'ssh-copy-id $ADMIN_USER@<ip>' do seu PC e execute este script de novo."
fi

step "DNS criptografado (Quad9, DNS-over-TLS)"
mkdir -p /etc/systemd/resolved.conf.d
cat >/etc/systemd/resolved.conf.d/10-monitorvoo.conf <<'EOF'
[Resolve]
DNS=9.9.9.9#dns.quad9.net 149.112.112.112#dns.quad9.net
FallbackDNS=
DNSOverTLS=yes
DNSSEC=allow-downgrade
EOF
systemctl restart systemd-resolved

step "Tampa fechada, sem suspensao, bateria"
mkdir -p /etc/systemd/logind.conf.d
cat >/etc/systemd/logind.conf.d/10-monitorvoo.conf <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
EOF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null
systemctl restart systemd-logind || true
for bat in /sys/class/power_supply/BAT*/charge_control_end_threshold; do
  [[ -w "$bat" ]] || continue
  cat >/etc/systemd/system/monitorvoo-battery.service <<EOF
[Unit]
Description=Limita carga da bateria a 80%
[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo 80 > $bat'
[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now monitorvoo-battery.service
  echo "bateria limitada a 80% ($bat)"
done
# Tela apaga sozinha apos 1 minuto (economia e menos calor).
if ! grep -q consoleblank /etc/default/grub; then
  sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 consoleblank=60"/' /etc/default/grub
  update-grub >/dev/null 2>&1 || true
fi

step "Usuario e codigo"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --depth 50 "$REPO_URL" "$APP_DIR"
fi
git config --system --add safe.directory "$APP_DIR"
mkdir -p "$APP_DIR/logs" "$APP_DIR/raw"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q --upgrade pip
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/collectors/requirements.txt"
if [[ ! -f "$APP_DIR/.env" ]]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "AVISO: preencha $APP_DIR/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) com: sudo nano $APP_DIR/.env"
fi
chown -R root:root "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/logs" "$APP_DIR/raw"
chown root:"$APP_USER" "$APP_DIR/.env"
chmod 640 "$APP_DIR/.env"
# logs antigos apagados apos 30 dias
echo "e $APP_DIR/logs - - - 30d" >/etc/tmpfiles.d/monitorvoo.conf
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=500M\n' >/etc/systemd/journald.conf.d/10-monitorvoo.conf
systemctl restart systemd-journald

step "Timers systemd"
install -m 644 "$APP_DIR"/deploy/linux/systemd/*.service "$APP_DIR"/deploy/linux/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
if grep -q '^SUPABASE_SERVICE_ROLE_KEY=.\+' "$APP_DIR/.env"; then
  systemctl enable --now monitorvoo-study.timer monitorvoo-anac.timer
  systemctl list-timers 'monitorvoo-*'
else
  echo "Timers instalados mas NAO ligados: preencha o .env e rode"
  echo "  sudo systemctl enable --now monitorvoo-study.timer monitorvoo-anac.timer"
fi

step "Pronto"
cat <<EOF
Comandos uteis:
  journalctl -u monitorvoo-study -f                 # acompanhar a coleta
  systemctl list-timers 'monitorvoo-*'              # proximas execucoes
  sudo -u $APP_USER $APP_DIR/.venv/bin/python -m collectors.study --plan   # o que a proxima hora faria
  sudo bash $APP_DIR/deploy/linux/update.sh         # atualizar o codigo
EOF
