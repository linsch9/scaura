process.env.PUPPETEER_CACHE_DIR = '/opt/render/.cache/puppeteer';

const puppeteer = require('puppeteer');

async function installChrome() {
    try {
        console.log('Downloading the Chromium browser...');
        await puppeteer.launch(); // Das wird den erforderlichen Chromium-Browser herunterladen
        console.log('Chromium browser downloaded successfully.');
        process.exit(0); // Make sure to exit the process successfully
    } catch (error) {
        console.error('Error downloading the Chromium browser:', error);
        process.exit(1); // Make sure to exit the process with error status
    }
}

installChrome();
