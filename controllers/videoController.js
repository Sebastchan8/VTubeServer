const connection = require('../config/db')
const exiftool = require('exiftool-vendored').exiftool;

exports.getVideos = async (req, res) => {
    try {
        const [rows] = await connection.query(`
            SELECT 
                v.*, 
                c.username, 
                c.profile_path
            FROM videos v, channels c
            WHERE v.channel_id = c.channel_id`);
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).send('Getting All Videos error!');
    }
}

exports.getChannelVideos = async (req, res) => {
    try {        
        const channelId = req.params.id;
        const [rows] = await connection.query(`
            SELECT 
                v.*, 
                c.username, 
                c.profile_path
            FROM videos v, channels c
            WHERE v.channel_id = c.channel_id
            AND c.channel_id = ?`,
            [channelId]);
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).send('Getting My Videos error!');
    }
}

exports.getSubscriptionsVideos = async (req, res) => {
    try {
        const [rows] = await connection.query(`
            SELECT 
                v.*, 
                c.username, 
                c.profile_path
            FROM videos v, channels c, subscribers s
            WHERE v.channel_id = c.channel_id
            AND c.channel_id = s.channel_id_main
            AND s.channel_id_subscriber = ?`,
            [req.session.user.channel_id]);
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).send('Getting Subscriptions Videos error!');
    }
}

exports.getLikedVideos = async (req, res) => {
    try {
        const [rows] = await connection.query(`
            SELECT 
                v.*, 
                c.username, 
                c.profile_path
            FROM videos v, channels c, ratings r
            WHERE v.channel_id = c.channel_id
            AND r.item_id = v.video_id
            AND r.item_type = 'video'
            AND r.rating_type = 'like'
            AND r.channel_id = ?`,
            [req.session.user.channel_id]);
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).send('Getting Liked Videos error!');
    }
}

exports.getSearchedVideos = async (req, res) => {
    try {
        const { query } = req.params;
        const queryString = '%' + query + '%';

        const [rows] = await connection.query(`
            SELECT 
                v.*, 
                c.username
            FROM videos v, channels c
            WHERE v.channel_id = c.channel_id
            AND (v.title LIKE ? OR c.username LIKE ? OR v.description LIKE ?)
        `, [queryString, queryString, queryString, queryString, queryString, queryString]);
        console.log(query)
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).send('Getting Searched Videos error!');
    }
}

exports.uploadVideo = async (req, res) => {
    try {
        const { title, description } = req.body;
        const id = req.session.user.channel_id;
        const thumbnailPath = req.files['thumbnail'][0].path;
        const videoPath = req.files['video'][0].path;

        exiftool
            .read(videoPath, ['-Duration'])
            .then((tags) => {
                const videoDuration = tags.Duration.substring(2,tags.Duration.length);//
                console.log(title, description, thumbnailPath, videoPath, videoDuration, id);

                const query = `INSERT INTO videos(channel_id, title, description, thumbnail_path, video_path, duration)
                VALUES (?, ?, ?, ?, ?, ?)`;

                const values = [id, title, description, thumbnailPath, videoPath, videoDuration];
                console.log(values)
                connection.query(query, values);

                return connection.query(`
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
            })
            .then(([rows]) => {
                let subscription_status = 0;
                res.json([{ ...rows[0], subscription_status}]);
            })
            .catch((error) => {
                console.log(error);
                res.status(500).send('Uploading video error!');
            });
    } catch (error) {
        console.log(error);
        res.status(500).send('Uploading video error!');
    }
};

exports.watchVideo = async (req, res) => {
    try {
        const video_id = req.params.id;

        const [videoRows] = await connection.query(`
            SELECT 
                v.video_id,
                v.video_path, 
                v.title, 
                v.description, 
                v.views,
                v.upload_date,
                c.profile_path,
                c.username,
                c.channel_id, 
                COUNT(DISTINCT s.subscription_id) AS subscriptions_num,
                COUNT(DISTINCT r.rating_id) AS likes_num, 
                COUNT(DISTINCT com.comment_id) AS comments_num
            FROM videos v
            JOIN channels c ON v.channel_id = c.channel_id
            LEFT JOIN subscribers s ON c.channel_id = s.channel_id_main
            LEFT JOIN ratings r ON r.item_type = 'video' AND r.item_id = v.video_id AND r.rating_type = 'like'
            LEFT JOIN comments com ON v.video_id = com.video_id
            WHERE v.video_id = ?
            GROUP BY v.video_id`,
            [video_id]
        );

        const [commentsRows] = await connection.query(`
            SELECT 
            c.profile_path, 
            c.username, 
            com.comment_id,
            com.comment_date, 
            com.comment_text,
            COUNT(DISTINCT r.rating_id) AS likes_num
            FROM comments com
            JOIN channels c ON com.channel_id = c.channel_id
            LEFT JOIN ratings r ON r.item_type = 'comment' AND r.item_id = com.comment_id AND r.rating_type = 'like'
            WHERE com.video_id = ?
            GROUP BY com.comment_id`,
            [video_id]
        );

        const channelId = videoRows[0].channel_id
        const visitorChannelId = req.session.user.channel_id
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

        let rating_status;
        const [rating] = await connection.query(`
                SELECT * FROM ratings WHERE item_type = 'video' AND item_id = ? AND channel_id = ?`,
            [channelId, visitorChannelId]);
        if(rating.length == 0){
            rating_status = 0;
        }else if(rating[0].rating_type == 'like'){
            rating_status = 1;
        }else
            rating_status = -1;

        res.json({
            "video": {...videoRows[0], subscription_status, rating_status},
            "comments": commentsRows.reverse(),
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Watching video error!');
    }
};