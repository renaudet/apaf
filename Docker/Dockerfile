FROM node:21-bookworm-slim
WORKDIR /opt/NPA
COPY . .
RUN npm install
EXPOSE 9080
ENV APAF_COUCH_DB_HOST=192.168.2.204
ENV APAF_COUCH_DB_PORT=5984
ENV APAF_COUCH_DB_USER=admin
ENV APAF_COUCH_DB_USER_PASSWD=admin4couch
ENV NPA_SESSIONS_COUCH_DB_HOST=192.168.2.204
ENV NPA_SESSIONS_COUCH_DB_PORT=5984
ENV NPA_SESSIONS_COUCH_DB_USER=admin
ENV NPA_SESSIONS_COUCH_DB_USER_PASSWD=admin4couch
ENV NODE_PATH=/opt/NPA/node_modules
ENV WORKSPACE_LOC=/opt/NPA/workspace
ENV SMTP_USER=smtpUser
ENV SMTP_PASSWD=smtpPasswd
CMD [ "node", "app.js", "--logs", "./logs", "--level", "info", "--port", "9080", "--application", "apaf" ]