FROM node:21-bookworm-slim
WORKDIR /opt/NPA
COPY . .
RUN npm install
EXPOSE 9080
CMD [ "node", "app.js", "--logs", "./logs", "--level", "info", "--port", "9080", "--application", "apaf" ]