FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Scan entire app folder tree during build to find which files contain isEeUI
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
        } else if (stat.isFile() && /\\.(js|json)$/.test(file)) { \
          try { \
            const content = fs.readFileSync(fullPath, 'utf8'); \
            if (content.includes('isEeUI') || content.includes('isEEFeatureBlocked')) { \
              console.log('FOUND MATCH IN:', fullPath); \
            } \
          } catch (e) {} \
        } \
      } \
    } catch (e) {} \
  } \
  search('/usr/src/app'); \
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