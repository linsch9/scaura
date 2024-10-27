# Use an official Node runtime as a parent image
FROM node:16

RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxshmfence1 \
    libxcb1 \
    libdbus-1-3 \
    libfontconfig1 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxtst6 \
    libglib2.0-0 \
    libnss3 \
    libnss3-tools \
    libnspr4 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-dev \
    gtk2-engines-pixbuf \
    xdg-utils

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application's source code to the working directory
COPY . .

# Open the port the app runs on
EXPOSE 3000

# Start the app
CMD [ "npm", "start" ]
