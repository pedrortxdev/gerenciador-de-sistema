#!/bin/bash

# Pega o diretório atual onde o script está rodando
PROJECT_DIR=$(pwd)
CURRENT_USER=$(whoami)

echo "--- Configurando System Manager 24/7 ---"
echo "Diretório do Projeto: $PROJECT_DIR"
echo "Usuário: $CURRENT_USER"

# 1. Criar Serviço do Backend (Go)
echo "Criando serviço do Backend..."
cat <<EOF > /etc/systemd/system/pixelcraft-backend.service
[Unit]
Description=Pixelcraft System Manager Backend
After=network.target

[Service]
User=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PROJECT_DIR/backend/system-manager
Restart=always
RestartSec=3
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
EOF

# 2. Criar Serviço do Frontend (Next.js)
echo "Criando serviço do Frontend..."
cat <<EOF > /etc/systemd/system/pixelcraft-frontend.service
[Unit]
Description=Pixelcraft System Manager Frontend
After=network.target pixelcraft-backend.service

[Service]
User=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR/frontend
# Usa o npm start (que roda o next start)
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=3010

[Install]
WantedBy=multi-user.target
EOF

# 3. Ativar e Iniciar
echo "Recarregando Systemd..."
systemctl daemon-reload

echo "Ativando serviços para iniciar no boot..."
systemctl enable pixelcraft-backend
systemctl enable pixelcraft-frontend

echo "Iniciando serviços agora..."
# Para serviços antigos se existirem e reinicia
systemctl restart pixelcraft-backend
systemctl restart pixelcraft-frontend

echo "--- CONCLUÍDO! ---"
echo "Verifique o status com:"
echo "  systemctl status pixelcraft-backend"
echo "  systemctl status pixelcraft-frontend"
