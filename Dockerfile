FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Find where the block is implemented in the compiled JS bundle
RUN node -e " \
  const fs = require('fs'); \
  const file = '/usr/src/app/docker/index.js'; \
  if (fs.existsSync(file)) { \
    const content = fs.readFileSync(file, 'utf8'); \
    const idx = content.indexOf('Vitess/Planetscale/TiDB'); \
    if (idx !== -1) { \
      console.log('=================== FOUND ==================='); \
      console.log(content.substring(idx - 200, idx + 300)); \
      console.log('=================== END ==================='); \
    } else { \
      console.log('Vitess/Planetscale/TiDB string not found in index.js'); \
    } \
  } else { \
    console.log('index.js file not found'); \
  } \
"

# Unset empty DB secrets that would cause JSON parse errors
CMD ["sh", "-c", "if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; /usr/src/appEntry/start.sh"]
EXPOSE 8080