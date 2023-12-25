const connection = require('../config/db');


exports.updateChannel = async (req, res) => {
    console.log(req.files);
    console.log(req.body);
    try {
        const { username, email, password, description } = req.body;
        const id = req.session.user.channel_id;

        const [duplicated] = await connection.query(
            `SELECT * FROM channels WHERE email = ? AND NOT channel_id = ?`,
            [email, id]
        );

        if(duplicated && duplicated.length > 0){
            return res.status(401).send('Email already registered');
        }


        const [files] = await connection.query(
            `SELECT profile_path, banner_path FROM channels WHERE channel_id = ?`,
            [id]
        );

        let profilePath = files[0].profile_path;
        let bannerPath = files[0].profile_path;

        if (req.files['profile'] != undefined) {
            profilePath = req.files['profile'][0].path;
        }
        if (req.files['banner'] != undefined) {
            bannerPath = req.files['banner'][0].path;
        }
        // console.log(username, email, password, description, profilePath, bannerPath, id);
        const [updateRows] = await connection.query(
            `UPDATE channels
            SET username = ?, email = ?, password = ?, channel_description = ?,
            profile_path = ?, banner_path = ?
            WHERE channel_id = ?`,
            [username, email, password, description, profilePath, bannerPath, id]
        );

        let subscription_status = 0;
        const [rows] = await connection.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT s.subscription_id) num_subscribers,
                COUNT(DISTINCT v.video_id) num_videos
            FROM channels c
            LEFT JOIN subscribers s ON c.channel_id = s.channel_id_main
            LEFT JOIN videos v ON c.channel_id = v.channel_id
            WHERE c.channel_id = ?
            GROUP BY c.channel_id`,
        [id]);
        res.json([{ ...rows[0], subscription_status}]);
    } catch (error) {
        console.log(error);
        res.status(500).send('Updating channel error!');
    }
};


exports.addChannel = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const [rows] = await connection.query('INSERT INTO channels(username, email, password) VALUES (?, ?, ?)',
            [username, email, password]);
        res.send({ rows });
    } catch (error) {
        console.log(error);
        res.status(500).send('Saving channel error!');
    }
}

exports.getChannel = async (req, res) => {
    try {
        const channelId = req.params.id;
        const visitorChannelId = req.session.user.channel_id;

        let subscription_status;
        if(channelId == visitorChannelId){
            subscription_status = 0;
        }else{
            const [sub] = await connection.query(`
                SELECT * FROM subscribers WHERE channel_id_main = ? AND channel_id_subscriber = ?`,
            [channelId, visitorChannelId]);
            if(sub.length === 0){
                subscription_status = -1;
            }else{
                subscription_status = 1;
            }

        }
        const [rows] = await connection.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT s.subscription_id) num_subscribers,
                COUNT(DISTINCT v.video_id) num_videos
            FROM channels c
            LEFT JOIN subscribers s ON c.channel_id = s.channel_id_main
            LEFT JOIN videos v ON c.channel_id = v.channel_id
            WHERE c.channel_id = ?
            GROUP BY c.channel_id`,
        [channelId]);
        res.json([{ ...rows[0], subscription_status}]);
    } catch (error) {
        console.log(error);
        res.status(500).send('Getting channel error!');
    }
}

exports.deleteChannel = async (req, res) => {
    try {
        const channel_id = req.session.user.channel_id
        const [rows] = await connection.query('DELETE FROM channels WHERE channel_id = ?', [channel_id]);
        const [rows2] = await connection.query('DELETE FROM comments WHERE channel_id = ?', [channel_id]);
        const [rows3] = await connection.query('DELETE FROM ratings WHERE channel_id = ?', [channel_id]);
        const [rows4] = await connection.query('DELETE FROM subscribers WHERE channel_id_subscriber = ?', [channel_id]);
        const [rows5] = await connection.query('DELETE FROM videos WHERE channel_id = ?', [channel_id]);
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).send('Deleting channel error!');
    }
}