const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const WebSocket = require('ws');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

const CLIENT_ID = '1300054950092603392';
const CLIENT_SECRET = '3W0SfGwr-e29xqK4Ne31K9EyUrXq2PLd';
const CALLBACK_URL = 'http://localhost:3000/auth/discord/callback';

const maxConcurrency = 10;
const scrapeTimeout = 60000; // 60 Sekunden Timeout für das Scrapen

passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(session({
    secret: 'YOUR_SESSION_SECRET',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    req.session.username = req.user.username; // Benutzernamen speichern
    res.redirect('/access.html');
});

app.get('/logout', (req, res) => {
    req.logout(err => {
        res.redirect('/');
    });
});

app.get('/profile', checkAuth, (req, res) => {
    res.json(req.user);
});

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });
const progressClients = {};

wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    let userId;

    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message);
        const soundcloudUsername = parsedMessage.soundcloudUsername;
        const discordUsername = parsedMessage.discordUsername;
        userId = discordUsername; // Benutzer-ID aufgrund des Discord-Usernames

        if (soundcloudUsername && discordUsername) {
            try {
                progressClients[userId] = ws;
                await getFullNetwork(discordUsername, soundcloudUsername, userId);
                ws.send(JSON.stringify({ redirect: true }));
            } catch (error) {
                console.error(error);
                ws.send(JSON.stringify({ error: 'Error generating network' }));
            }
        }
    });

    ws.on('close', () => {
        if (userId && progressClients[userId]) {
            delete progressClients[userId];
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
    });
});

function sendProgress(userId, progress, data) {
    const ws = progressClients[userId];
    if (ws) {
        ws.send(JSON.stringify({ progress, data }));
    }
}

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
        const profileImageElement = document.querySelector('.userAvatarBadge .sc-artwork.sc-artwork-placeholder-2.image__full');
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
    const browser = await puppeteer.launch({ headless: true });
    const mainPage = await browser.newPage();
    const userUrl = `https://soundcloud.com/${soundcloudUsername}/following`;
    const { mainProfile, followings: followings1 } = await scrapeFollowings(userId, mainPage, userUrl, true);

    const followings2 = [];
    const queue = [...followings1];
    let activeCount = 0;
    const totalFollowings = followings1.length;
    let processedFollowings = 0;

    const networkFileName = `${discordUsername}-network.json`;
    const networkFilePath = path.join(__dirname, 'public', 'networks', networkFileName);

    if (!fs.existsSync(path.join(__dirname, 'public', 'networks'))) {
        fs.mkdirSync(path.join(__dirname, 'public', 'networks'));
    }

    async function processQueue() {
        while (queue.length > 0 && activeCount < maxConcurrency) {
            const following = queue.shift();
            activeCount++;

            processedFollowings++;
            const progress = Math.floor((processedFollowings / totalFollowings) * 100);
            sendProgress(discordUsername, progress, { followings2 }); // Fortschritt und Daten senden

            const message = `Scraping followings of ${following.username}...`;
            console.log(message);

            try {
                const newPage = await browser.newPage();
                const followingUrl = `${following.profileLink}/following`;
                const { followings: nestedFollowings } = await scrapeFollowings(userId, newPage, followingUrl, false);
                followings2.push({ username: following.username, followings: nestedFollowings });

                // Netzwerkinformationen nach jedem Batch speichern
                const currentData = { mainProfile, followings1, followings2 };
                fs.writeFileSync(networkFilePath, JSON.stringify(currentData, null, 2));
                await newPage.close();

                sendProgress(discordUsername, progress, currentData); // Daten nach dem Speichern senden
            } catch (error) {
                console.error(`Error scraping followings of ${following.username}:`, error);
            }

            activeCount--;
            await processQueue();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    await processQueue();

    const result = { mainProfile, followings1, followings2 };
    fs.writeFileSync(networkFilePath, JSON.stringify(result, null, 2));

    await browser.close();
    return result;
}