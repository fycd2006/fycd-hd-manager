FROM docker.io/n8nio/n8n:latest
USER root
ENV N8N_PORT=7860
EXPOSE 7860
USER node
