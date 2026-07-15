FROM nocodb/nocodb:latest
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
# Unset empty DB secrets that would cause JSON parse errors
CMD ["sh", "-c", "if [ -z \"$(echo $NC_DB_JSON | tr -d ' ')\" ]; then unset NC_DB_JSON; fi; if [ -z \"$(echo $NC_DB | tr -d ' ')\" ]; then unset NC_DB; fi; /usr/src/appEntry/start.sh"]
EXPOSE 8080