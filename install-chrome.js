const puppeteer = require('puppeteer');

async function installChrome() {
    try {
        console.log('Downloading the Chromium browser...');
        await puppeteer.launch(); // Das wird den erforderlichen Chromium-Browser herunterladen
        console.log('Chromium browser downloaded successfully.');
    } catch (error) {
        console.error('Error downloading the Chromium browser:', error);
        process.exit(1);
    }
}

installChrome();
