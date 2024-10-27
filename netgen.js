const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const scrapeTimeout = 60000; // 60 Sekunden Timeout für das Scrapen

async function scrapeFollowings(userId, page, url, fullScroll = false, timeout = 5000) {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    async function scrollToBottom(page, timeout) {
        const scrollStep = 200;
        let lastHeight = 0;
        let currentTime = 0;

        while (currentTime < timeout) {
            const newHeight = await page.evaluate('document.body.scrollHeight');
            if (newHeight === lastHeight) {
                currentTime += scrollStep;
            } else {
                currentTime = 0;
                lastHeight = newHeight;
            }
            await page.evaluate(step => {
                window.scrollBy(0, step);
            }, scrollStep);
            await new Promise(res => setTimeout(res, 100));
        }
    }

    if (fullScroll) {
        await scrollToBottom(page, timeout);
    } else {
        const scrollStep = 200;
        let lastHeight = 0;
        const startTime = Date.now();

        while ((Date.now() - startTime) < scrapeTimeout) {
            const newHeight = await page.evaluate('document.body.scrollHeight');
            if (newHeight === lastHeight) {
                break;
            }
            lastHeight = newHeight;

            await page.evaluate(step => {
                window.scrollBy(0, step);
            }, scrollStep);

            await new Promise(res => setTimeout(res, 100));
        }
    }

    await page.waitForSelector('.lazyLoadingList__list');

    const mainProfile = await page.evaluate(() => {
        const profileImageElement = document.querySelector('.userAvatarBadge .sc-artwork.image__full');
        const profileImage = profileImageElement ? profileImageElement.style.backgroundImage.slice(5, -2) : '';
        const avatarSpan = document.querySelector('.userAvatarBadge-avatar-link span');
        const mainUsername = avatarSpan ? avatarSpan.getAttribute('aria-label').slice(0, -9) : '';

        return {
            username: mainUsername,
            profileLink: window.location.href.split('/following')[0],
            profileImage
        };
    });

    const followings = await page.$$eval('.userBadgeListItem', elements => {
        return elements.map(el => {
            const profileLink = el.querySelector('.userBadgeListItem__heading').href;
            const username = el.querySelector('.userBadgeListItem__heading').textContent.trim();
            const profileImageElement = el.querySelector('.userBadgeListItem__image .image__full');
            const profileImage = profileImageElement ? profileImageElement.style.backgroundImage.slice(5, -2) : '';
            return { username, profileLink, profileImage };
        });
    });

    return { mainProfile, followings };
}

async function getFullNetwork(discordUsername, soundcloudUsername, userId) {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    });
    const mainPage = await browser.newPage();
    const userUrl = `https://soundcloud.com/${soundcloudUsername}/following`;
    const { mainProfile, followings: followings1 } = await scrapeFollowings(userId, mainPage, userUrl, true);

    const followings2 = [];
    const queue = [...followings1];
    let activeCount = 0;
    const maxConcurrency = 2; // Adjust based on your needs
    const networkFileName = `${discordUsername}-network.json`;
    const networkFilePath = path.join(__dirname, 'public', 'networks', networkFileName);

    if (!fs.existsSync(path.join(__dirname, 'public', 'networks'))) {
        fs.mkdirSync(path.join(__dirname, 'public', 'networks'));
    }

    async function processQueue() {
        while (queue.length > 0 && activeCount < maxConcurrency) {
            const following = queue.shift();
            activeCount++;

            const progressMessage = `Scraping followings of ${following.username}`;
            console.log(progressMessage);

            try {
                const newPage = await browser.newPage();
                const followingUrl = `${following.profileLink}/following`;
                const { followings: nestedFollowings } = await scrapeFollowings(userId, newPage, followingUrl, false);
                followings2.push({ username: following.username, followings: nestedFollowings });

                const currentData = { mainProfile, followings1, followings2 };
                fs.writeFileSync(networkFilePath, JSON.stringify(currentData, null, 2));
                await newPage.close();
            } catch (error) {
                console.error(`Error scraping followings of ${following.username}:`, error);
            }

            activeCount--;
            await new Promise(resolve => setTimeout(resolve, 500));
            await processQueue();  // Ensure continuation of processing
        }
    }

    await processQueue();

    const result = { mainProfile, followings1, followings2 };
    fs.writeFileSync(networkFilePath, JSON.stringify(result, null, 2));

    await browser.close();
    return result;
}

module.exports = {
    scrapeFollowings,
    getFullNetwork
};
