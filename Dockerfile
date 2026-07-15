FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Hot-patch NocoDB backend and frontend to treat Vitess/TiDB connections as standard MySQL
RUN node -e " \
  const fs = require('fs'); \
  const path = require('path'); \
  const files = ['/usr/src/app/docker/index.js']; \
  const guiDir = '/usr/src/app/docker/nc-gui/_nuxt'; \
  if (fs.existsSync(guiDir)) { \
    fs.readdirSync(guiDir).forEach(f => { \
      if (f.endsWith('.js')) files.push(path.join(guiDir, f)); \
    }); \
  } \
  files.forEach(file => { \
    if (fs.existsSync(file)) { \
      let content = fs.readFileSync(file, 'utf8'); \
      const original = content; \
      content = content.replace(/VitessClient/g, 'MysqlClient'); \
      content = content.replace(/TidbClient/g, 'MysqlClient'); \
      if (content !== original) { \
        fs.writeFileSync(file, content, 'utf8'); \
        console.log('Patched database dialect restriction in:', file); \
      } \
    } \
  }); \
"

# Unset empty DB secrets that would cause JSON parse errors
CMD ["sh", "-c", "if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; /usr/src/appEntry/start.sh"]
EXPOSE 8080