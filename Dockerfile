FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# List files in /usr/src/app
RUN node -e " \
  const fs = require('fs'); \
  const path = require('path'); \
  function list(dir) { \
    try { \
      const files = fs.readdirSync(dir); \
      for (const f of files) { \
        const p = path.join(dir, f); \
        const s = fs.statSync(p); \
        if (s.isDirectory()) { \
          console.log('DIR:', p); \
          if (f !== 'node_modules' && f !== '.git') { \
            list(p); \
          } \
        } else { \
          console.log('FILE:', p); \
        } \
      } \
    } catch (e) {} \
  } \
  list('/usr/src/app'); \
"

# Unset empty DB secrets that would cause JSON parse errors
CMD ["sh", "-c", "if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; /usr/src/appEntry/start.sh"]
EXPOSE 8080