const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    try {
        console.log('Setting puppeteer cache directory...');
        process.env.PUPPETEER_CACHE_DIR = path.resolve(__dirname, '.cache/puppeteer');

        console.log('Downloading the Chromium browser...');
        await puppeteer.launch(); // Das wird den erforderlichen Chromium-Browser herunterladen
        console.log('Chromium browser downloaded successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error downloading the Chromium browser:', err);
        process.exit(1);
    }
})();
