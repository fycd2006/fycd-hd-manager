FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Scan node_modules/ for the restriction, skipping heavy utility folders
RUN node -e " \
  const fs = require('fs'); \
  const path = require('path'); \
  const skipFolders = ['lodash', 'babel', 'core-js', 'ajv', 'swagger', 'react', 'vue', 'webpack', 'typescript', 'eslint', 'prettier', 'postcss', 'tailwindcss', 'mime', 'date-fns', 'knex', 'sequelize', 'typeorm', 'graphql', 'nest', 'express']; \
  function search(dir) { \
    try { \
      const files = fs.readdirSync(dir); \
      for (const file of files) { \
        const fullPath = path.join(dir, file); \
        const stat = fs.statSync(fullPath); \
        if (stat.isDirectory()) { \
          if (skipFolders.some(skip => file.toLowerCase().includes(skip))) continue; \
          search(fullPath); \
        } else if (stat.isFile() && /\\.(js|json)$/.test(file)) { \
          if (stat.size > 1000 * 1024) continue; \
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
    } catch (e) {} \
  } \
  search('/usr/src/app/node_modules'); \
"

# Unset empty DB secrets that would cause JSON parse errors
CMD ["sh", "-c", "if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; /usr/src/appEntry/start.sh"]
EXPOSE 8080