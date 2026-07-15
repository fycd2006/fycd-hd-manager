FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Read and print the start.sh startup script for debugging
RUN cat /usr/src/appEntry/start.sh

# Unset empty DB secrets and normalize postgresql:// connection strings at startup
CMD ["sh", "-c", "\
  if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; \
  if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; \
  if [ -n \"$NC_DB\" ]; then export NC_DB=$(echo $NC_DB | sed 's/^postgresql:\\/\\//postgres:\\/\\//'); fi; \
  /usr/src/appEntry/start.sh"]
EXPOSE 8080