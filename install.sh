#!/usr/bin/env bash
# Instala ou atualiza o Bot de Ofertas numa máquina Ubuntu (ex.: Oracle Cloud Always Free).
# Uso: bash install.sh   (rode de novo a qualquer momento para atualizar)
set -euo pipefail

REPO="${REPO:-https://github.com/felippejandrade/bot-ofertas.git}"
DIR="$HOME/bot-ofertas"
PORT="${PORT:-3000}"

echo "==> Instalando dependências do sistema"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git curl iptables-persistent

# Máquinas com 1 GB (ex.: Google Cloud e2-micro) precisam de swap para instalar sem travar
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 1500000 ] && ! swapon --show | grep -q .; then
	echo "==> Criando 1 GB de swap"
	sudo fallocate -l 1G /swapfile
	sudo chmod 600 /swapfile
	sudo mkswap /swapfile >/dev/null
	sudo swapon /swapfile
	echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
	echo "==> Instalando Node.js 22"
	curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
	sudo apt-get install -y nodejs
fi

if [ -d "$DIR/.git" ]; then
	echo "==> Atualizando o código"
	git -C "$DIR" pull --ff-only
else
	echo "==> Baixando o código"
	git clone "$REPO" "$DIR"
fi

cd "$DIR"
npm ci --omit=dev

if [ ! -f .env ]; then
	echo
	read -rsp "Crie uma senha para acessar o painel: " SENHA < /dev/tty
	echo
	printf 'PAINEL_SENHA=%s\nPORT=%s\n' "$SENHA" "$PORT" > .env
	chmod 600 .env
fi

echo "==> Configurando o serviço (liga sozinho quando a máquina reinicia)"
sudo tee /etc/systemd/system/bot-ofertas.service >/dev/null <<EOF
[Unit]
Description=Bot de Ofertas
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$DIR
EnvironmentFile=$DIR/.env
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable bot-ofertas >/dev/null
sudo systemctl restart bot-ofertas

echo "==> Liberando a porta $PORT no firewall da máquina"
if ! sudo iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null; then
	sudo iptables -I INPUT 5 -p tcp --dport "$PORT" -j ACCEPT
	sudo netfilter-persistent save >/dev/null
fi

IP="$(curl -s https://ifconfig.me || echo SEU_IP)"
echo
echo "Pronto! Abra no navegador: http://$IP:$PORT"
echo "Ver registros: sudo journalctl -u bot-ofertas -f"
