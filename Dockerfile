FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Scan all text files in /usr/src/app (excluding node_modules) for the restriction
RUN node -e " \
  const fs = require('fs'); \
  const path = require('path'); \
  function search(dir) { \
    try { \
      const files = fs.readdirSync(dir); \
      for (const file of files) { \
        const fullPath = path.join(dir, file); \
        if (file === 'node_modules' || file === '.git') continue; \
        const stat = fs.statSync(fullPath); \
        if (stat.isDirectory()) { \
          search(fullPath); \
        } else if (stat.isFile() && /\\.(js|json|html|css)$/.test(file)) { \
          const content = fs.readFileSync(fullPath, 'utf8'); \
          const idx = content.toLowerCase().indexOf('planetscale'); \
          if (idx !== -1) { \
            console.log('=================== FOUND ==================='); \
            console.log('File:', fullPath); \
            console.log(content.substring(Math.max(0, idx - 150), Math.min(content.length, idx + 350))); \
            console.log('=================== END ==================='); \
          } \
        } \
      } \
    } catch (e) { \
      console.log('Error searching', dir, e.message); \
    } \
  } \
  search('/usr/src/app'); \
"

# Unset empty DB secrets that would cause JSON parse errors
CMD ["sh", "-c", "if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; /usr/src/appEntry/start.sh"]
EXPOSE 8080