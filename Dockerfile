FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV NC_CLOUD=true

# Hot-patch: Bypass the TiDB/Vitess connection restriction regex in NocoDB backend
RUN node -e " \
  const fs = require('fs'); \
  const file = '/usr/src/app/docker/index.js'; \
  if (fs.existsSync(file)) { \
    let content = fs.readFileSync(file, 'utf8'); \
    const target = '/' + String.fromCharCode(92) + 'b(Tidb|Vitess)' + String.fromCharCode(92) + 'b/i'; \
    const replacement = '/' + String.fromCharCode(92) + 'b(NonExistentDbName)' + String.fromCharCode(92) + 'b/i'; \
    if (content.includes(target)) { \
      content = content.split(target).join(replacement); \
      fs.writeFileSync(file, content, 'utf8'); \
      console.log('Successfully patched TiDB/Vitess regex block!'); \
    } else { \
      console.log('Pattern not found - check might be obfuscated differently.'); \
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