const express = require('express');
const cors = require('cors');
const session = require('express-session');

const app = express();

app.use(express.json())
app.use(cors())
app.use('/uploads', express.static('uploads'));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

app.get('/', (req, res) => {
    res.send('The server is running!');
});

app.use('/api/channels', require('./routes/channel.route'));
app.use('/api/videos', require('./routes/videos.route'));
app.use('/api/interactions', require('./routes/interactions.route'));


app.listen(3000, () => {
    console.log('Server on port 3000...')
})