FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Scan index.js for version detection queries
RUN node -e " \
  const fs = require('fs'); \
  const file = '/usr/src/app/docker/index.js'; \
  if (fs.existsSync(file)) { \
    const content = fs.readFileSync(file, 'utf8'); \
    ['select version', 'version()', 'version_comment'].forEach(term => { \
      const idx = content.toLowerCase().indexOf(term); \
      if (idx !== -1) { \
        console.log('FOUND term:', term, 'at', idx); \
        console.log(content.substring(idx - 100, idx + 200)); \
      } \
    }); \
  } \
"

# Unset empty DB secrets that would cause JSON parse errors
CMD ["sh", "-c", "if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; /usr/src/appEntry/start.sh"]
EXPOSE 8080