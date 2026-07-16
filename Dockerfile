FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Scan entire app folder tree during build to find K2 definition
RUN node -e " \
  const fs = require('fs'); \
  const file = '/usr/src/app/docker/nc-gui/_nuxt/BGeeiuXx.js'; \
  if (fs.existsSync(file)) { \
    const content = fs.readFileSync(file, 'utf8'); \
    // Find where K2 is imported or declared \
    const idx = content.indexOf('T(K2)'); \
    if (idx !== -1) { \
      console.log('T(K2) context:', content.substring(idx - 100, idx + 100)); \
      // Let's locate the import statement for K2 in the file header \
      const header = content.substring(0, 10000); \
      let pos = 0; \
      while (true) { \
        const importIdx = header.indexOf('K2', pos); \
        if (importIdx === -1) break; \
        console.log('Import K2 context:', header.substring(importIdx - 50, importIdx + 50)); \
        pos = importIdx + 2; \
      } \
    } \
  } \
"

# Clean empty Space Secrets and translate standard PostgreSQL URL to NocoDB custom format at startup
CMD ["sh", "-c", "\
  if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; \
  if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; \
  if [ -n \"$NC_DB\" ]; then \
    export NC_DB=$(node -e \" \
      const urlString = process.env.NC_DB.trim(); \
      try { \
        if (urlString.startsWith('postgres://') || urlString.startsWith('postgresql://')) { \
          const url = new URL(urlString); \
          const host = url.hostname; \
          const port = url.port || '5432'; \
          const user = url.username; \
          const password = url.password; \
          const database = url.pathname.replace(/^\\//, ''); \
          let newUrl = 'pg://' + host + ':' + port + '?'; \
          if (user) newUrl += 'u=' + encodeURIComponent(user) + '&'; \
          if (password) newUrl += 'p=' + encodeURIComponent(password) + '&'; \
          if (database) newUrl += 'd=' + encodeURIComponent(database) + '&'; \
          url.searchParams.forEach((val, key) => { \
            if (!['u', 'user', 'p', 'password', 'd', 'database'].includes(key)) { \
              newUrl += key + '=' + encodeURIComponent(val) + '&'; \
            } \
          }); \
          if (newUrl.endsWith('&') || newUrl.endsWith('?')) newUrl = newUrl.slice(0, -1); \
          console.log(newUrl); \
        } else { \
          console.log(urlString); \
        } \
      } catch (e) { \
        console.log(urlString); \
      } \
    \"); \
  fi; \
  /usr/src/appEntry/start.sh"]
EXPOSE 8080