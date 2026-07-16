FROM baserow/baserow:1.29.1

# Copy custom source code or assets to overwrite defaults
# (If customizations directory is empty or has a placeholder, this will copy the directory structure)
COPY customizations/ /baserow/customizations/

# Script to apply customizations to baserow files before starting
RUN if [ -d "/baserow/customizations" ]; then \
      cp -r /baserow/customizations/* /baserow/ || true; \
      rm -rf /baserow/customizations; \
    fi

EXPOSE 80 443