# Verwende das offizielle Basisbild von Puppeteer
FROM ghcr.io/puppeteer/puppeteer:23.6.0

# Installiere notwendige Tools und Google Chrome
RUN apt-get update && \
    apt-get install -y wget gnupg --no-install-recommends && \
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list' && \
    apt-get update && \
    apt-get install -y google-chrome-stable --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

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
CMD [ "node", "server.js" ]
