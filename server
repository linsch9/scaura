// server.js

const express = require('express');
const WebSocket = require('ws');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const { getFullNetwork } = require('./netgen');

const app = express();
const port = process.env.PORT || 3000; // Use the provided port or default to 3000

app.use(express.json());
app.use(express.static('public'));

// Load values from environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;

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
    secret: process.env.SESSION_SECRET,
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

function checkNetworkFileExists(discordUsername) {
    const networkFileName = `${discordUsername}-network.json`;
    const networkFilePath = path.join(__dirname, 'public', 'networks', networkFileName);

    return new Promise((resolve, reject) => {
        fs.readFile(networkFilePath, 'utf8', (err, data) => {
            if (err) {
                reject(new Error('Network file not found'));
            } else {
                try {
                    const networkData = JSON.parse(data);
                    resolve(networkData);
                } catch (parseError) {
                    reject(new Error('Error parsing network file'));
                }
            }
        });
    });
}

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });
const progressClients = {};

wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    let userId;
    let heartbeatInterval;

    function heartbeat() {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        } else {
            clearInterval(heartbeatInterval);
            if (userId && progressClients[userId]) {
                delete progressClients[userId];
                console.log(`WebSocket for ${userId} removed`);
            }
        }
    }

    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message);
        const soundcloudUsername = parsedMessage.soundcloudUsername;
        const discordUsername = parsedMessage.discordUsername;

        if (soundcloudUsername && discordUsername) {
            userId = discordUsername;
            console.log(`Received message from ${userId}`);
            progressClients[userId] = ws;
            console.log(`WebSocket for ${userId} registered`);

            heartbeatInterval = setInterval(heartbeat, 30000); // Keep-alive alle 30 Sekunden

            try {
                const result = await getFullNetwork(discordUsername, soundcloudUsername, userId);
                ws.send(JSON.stringify({ data: result }));
            } catch (error) {
                console.error(error);
                ws.send(JSON.stringify({ error: 'Error generating network' }));
            }
        } else {
            console.log('SoundCloud username or Discord username missing');
        }
    });

    ws.on('close', () => {
        if (userId && progressClients[userId]) {
            delete progressClients[userId];
            console.log(`WebSocket for ${userId} closed`);
        }
        clearInterval(heartbeatInterval);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for ${userId}: ${error}`);
    });

    ws.on('pong', () => {
        console.log('Pong received');
    });
});

function sendProgress(userId, message) {
    const ws = progressClients[userId];
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`Sending progress to ${userId}: ${message}`);
        ws.send(JSON.stringify({ message }));
    } else {
        console.log(`WebSocket for ${userId} not found or not open`);
    }
}
