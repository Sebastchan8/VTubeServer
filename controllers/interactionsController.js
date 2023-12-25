const connection = require('../config/db');

exports.subscribe = async (req, res) => {
    try {
        const { channel_main } = req.body;
        const subscriber = req.session.user.channel_id;

        const [result] = await connection.query(
            'INSERT INTO subscribers (channel_id_main, channel_id_subscriber) VALUES (?, ?)',
            [channel_main, subscriber]
        );

        let subscription_status;
        if(channel_main == subscriber){
            subscription_status = 0;
        }else{
            const [sub] = await connection.query(`
                SELECT * FROM subscribers WHERE channel_id_main = ? AND channel_id_subscriber = ?`,
            [channel_main, subscriber]);
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
        [channel_main]);
        res.json([{ ...rows[0], subscription_status}]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Subscription failed' });
    }
};

exports.unsubscribe = async (req, res) => {
    try {
        const { channel_main } = req.body;
        const subscriber = req.session.user.channel_id;

        const [result] = await connection.query(
            'DELETE FROM subscribers WHERE channel_id_main = ? AND channel_id_subscriber = ?',
            [channel_main, subscriber]
        );
        let subscription_status;
        if(channel_main == subscriber){
            subscription_status = 0;
        }else{
            const [sub] = await connection.query(`
                SELECT * FROM subscribers WHERE channel_id_main = ? AND channel_id_subscriber = ?`,
            [channel_main, subscriber]);
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
        [channel_main]);
        res.json([{ ...rows[0], subscription_status}]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unsubscription failed' });
    }
};

exports.rateItem = async (req, res) => {
    try {
        const { item_id, item_type, rating_type, video_id } = req.body;
        const user_id = req.session.user.channel_id;
        const rating_type_inverse = rating_type == 'like' ? 'dislike':'like'

        const selectQuery = `SELECT * FROM ratings WHERE item_id = ? AND item_type = ? AND rating_type = ? AND channel_id = ?`
        const insertQuery = `INSERT INTO ratings SET item_id = ?, item_type = ?, rating_type = ?, channel_id = ?`
        const deleteQuery = `DELETE FROM ratings WHERE item_id = ? AND item_type = ? AND rating_type = ? AND channel_id = ?`
        const normalValues = [item_id, item_type, rating_type, user_id];
        const inverseValues = [item_id, item_type, rating_type_inverse, user_id];

        console.log("NORMAL: ", normalValues)

        const [rating] = await connection.query(selectQuery, normalValues);
        const [rating_inverse] = await connection.query(selectQuery,inverseValues);
        
        if(rating.length == 0 && rating_inverse.length == 0){
            const [out1] = await connection.query(insertQuery, normalValues);
        }
        if( (rating.length == 1 && rating_inverse.length == 0 && rating_type == 'like') ||
        (rating.length == 0 && rating_inverse.length == 1 && rating_type == 'dislike') ){
            const [out2] = await connection.query(deleteQuery, normalValues);
        }
        if( (rating.length == 1 && rating_inverse.length == 0 && rating_type == 'dislike') ||
        (rating.length == 0 && rating_inverse.length == 1 && rating_type == 'like') ){
            const [out3] = await connection.query(deleteQuery, inverseValues);
            const [out4] = await connection.query(insertQuery, normalValues);
        }
        
        //----


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
        const [rating_video] = await connection.query(`
                SELECT * FROM ratings WHERE item_type = 'video' AND item_id = ? AND channel_id = ?`,
            [channelId, visitorChannelId]);
        if(rating_video.length == 0){
            rating_status = 0;
        }else if(rating_video[0].rating_type == 'like'){
            rating_status = 1;
        }else
            rating_status = -1;

        res.json({
            "video": {...videoRows[0], subscription_status, rating_status},
            "comments": commentsRows.reverse(),
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Liking the video failed' });
    }
};


exports.addComment = async (req, res) => {
    try {
        const { video_id, comment_text } = req.body;
        const channel_id = req.session.user.channel_id;

        const [result] = await connection.query(
            'INSERT INTO comments (video_id, channel_id, comment_text) VALUES (?, ?, ?)',
            [video_id, channel_id, comment_text]
        );
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Adding the comment failed' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const [user] = await connection.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT s.subscription_id) num_subscribers,
                COUNT(DISTINCT v.video_id) num_videos
            FROM channels c
            LEFT JOIN subscribers s ON c.channel_id = s.channel_id_main
            LEFT JOIN videos v ON c.channel_id = v.channel_id
            WHERE c.email = ?
            GROUP BY c.channel_id`,
            [email]
        );

        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user[0].password === password) {
            req.session.user = user[0];
            return res.json({ message: 'Login successfully!', user: user[0] });
        } else {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Log in failed' });
    }
};

exports.logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                res.status(500).send('Log out failed');
            } else {
                res.json({ message: 'Logout successfully!'});
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Log out failed' });
    }
};


exports.signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const profile_path = "uploads\\img\\default_profile.svg"
        const banner_path = "uploads\\img\\default_banner.webp"

        const [existingUsers] = await connection.query(
            'SELECT * FROM channels WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Email is already in use' });
        }

        const [result] = await connection.query(
            'INSERT INTO channels (username, email, password, profile_path, banner_path) VALUES (?, ?, ?, ?, ?)',
            [username, email, password, profile_path, banner_path]
        );

        return res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering the user' });
    }
};

exports.addViewsCounter = async (req, res) => {
    try {
        const { video_id } = req.body;

        const [result] = await connection.query(
            'UPDATE videos set views = views + 1 WHERE video_id = ?',
            [video_id]
        );
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Adding views counter failed' });
    }
};
