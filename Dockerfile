# Verwende das offizielle Basisbild von Puppeteer
FROM ghcr.io/puppeteer/puppeteer:23.6.0

# Setze den Nicht-interaktiven Modus für apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Füge das Google Chrome Repository hinzu und installiere Chrome
RUN apt-get update && apt-get install -y google-chrome-stable

# Setze Umgebungsvariablen für Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Arbeitsverzeichnis setzen
WORKDIR /usr/src/app

# Kopiere die package.json und package-lock.json Dateien
COPY package*.json ./

# Installiere Node.js Abhängigkeiten
RUN npm ci

# Kopiere den Rest des Anwendungs-Codes
COPY . .

# Startkommando setzen
CMD ["node", "server.js"]
