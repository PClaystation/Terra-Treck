const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = 3000;

// Load SSL cert
const privateKey = fs.readFileSync('/etc/letsencrypt/live/mpmc.ddns.net/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/mpmc.ddns.net/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

let fetch_count = 0;

app.use(cors());
app.use(bodyParser.json());

// Store steps with timestamp
app.post('/steps', (req, res) => {
    const { userId, steps } = req.body;

    if (!userId || !steps) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    const log = {
        userId,
        steps,
        timestamp: new Date().toISOString()
    };

    fs.appendFile('steps.log', JSON.stringify(log) + '\n', err => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to save data' });
        }
        res.status(200).json({ success: true });
    });
});

// Get all steps by user
app.get('/steps/:userId', (req, res) => {
    const { userId } = req.params;

    console.log("fetched data", fetch_count);
    fetch_count += 1;

    fs.readFile('steps.log', 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read log' });

        const entries = data.trim().split('\n').map(line => JSON.parse(line));
        const userSteps = entries.filter(entry => entry.userId === userId);
        res.json(userSteps);
    });
});

https.createServer(credentials, app).listen(PORT, () => {
    console.log(`HTTPS server running on port ${PORT}`);
});

