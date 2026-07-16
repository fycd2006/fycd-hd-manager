FROM baserow/baserow:1.29.1

# Set default env variables for Hugging Face Spaces
ENV DISABLE_VOLUME_CHECK=yes
ENV BASEROW_AMOUNT_OF_WORKERS=1

# Copy custom source code or assets to overwrite defaults
COPY customizations/ /baserow/customizations/

# Script to apply customizations to baserow files before starting
RUN if [ -d "/baserow/customizations" ]; then \
      cp -r /baserow/customizations/* /baserow/ || true; \
      rm -rf /baserow/customizations; \
    fi

ENV BASEROW_PORT=7860
ENV BASEROW_CADDY_ADDRESSES=:7860

EXPOSE 7860