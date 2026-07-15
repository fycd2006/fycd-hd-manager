FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Scan compiled docker folder for references to TiDB
RUN node -e " \
  const fs = require('fs'); \
  const path = require('path'); \
  function search(dir) { \
    try { \
      const files = fs.readdirSync(dir); \
      for (const file of files) { \
        const fullPath = path.join(dir, file); \
        const stat = fs.statSync(fullPath); \
        if (stat.isDirectory()) { \
          search(fullPath); \
        } else if (stat.isFile() && /\\.(js|json)$/.test(file)) { \
          const content = fs.readFileSync(fullPath, 'utf8'); \
          const idx = content.toLowerCase().indexOf('tidb'); \
          if (idx !== -1) { \
            console.log('=================== FOUND ==================='); \
            console.log('File:', fullPath); \
            console.log(content.substring(Math.max(0, idx - 150), Math.min(content.length, idx + 350))); \
            console.log('=================== END ==================='); \
          } \
        } \
      } \
    } catch (e) {} \
  } \
  search('/usr/src/app/docker'); \
"

# Unset empty DB secrets and normalize database prefix to pg:// at startup
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