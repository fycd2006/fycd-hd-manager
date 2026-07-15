FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Print masked NC_DB to log for debugging, clean empty values, and normalize prefix
CMD ["sh", "-c", "\
  if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; \
  if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; \
  if [ -n \"$NC_DB\" ]; then \
    echo \"NC_DB length: ${#NC_DB}\"; \
    echo \"NC_DB masked: $(echo $NC_DB | sed 's/:[^:@]*@/:***@/')\"; \
    export NC_DB=$(echo $NC_DB | tr -d '\\r' | sed 's/^postgresql:\\/\\//pg:\\/\\//; s/^postgres:\\/\\//pg:\\/\\//'); \
    echo \"NC_DB normalized: $(echo $NC_DB | sed 's/:[^:@]*@/:***@/')\"; \
  fi; \
  /usr/src/appEntry/start.sh"]
EXPOSE 8080