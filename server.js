const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Pool kết nối PostgreSQL (Render sẽ cung cấp DATABASE_URL trong Environment Variables)
const pool = new Pool({
    connectionString: "postgresql://web_user_db_user:lpQH2GJfok6LXAXBONWk8MZUAWF1M3EZ@dpg-d2gc2pbuibrs73e78fq0-a.oregon-postgres.render.com/web_user_db",
    ssl: { rejectUnauthorized: false }
});


// =============== API ===============

// API đăng ký
app.post('/api/register', async (req, res) => {
    const { username, email, phone, password } = req.body;

    try {
        // Kiểm tra trùng email/sđt
        const check = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR phone = $2',
            [email, phone]
        );

        if (check.rows.length > 0) {
            return res.json({ success: false, message: 'Email hoặc số điện thoại đã tồn tại!' });
        }

        // Insert user
        await pool.query(
            'INSERT INTO users (username, email, phone, password) VALUES ($1, $2, $3, $4)',
            [username, email, phone, password]
        );

        return res.json({ success: true, message: 'Đăng ký thành công!' });
    } catch (err) {
        console.error("❌ Lỗi chi tiết:", err);
        res.status(500).json({ success: false, message: 'Lỗi server!', error: err.message });
    }

});

// API đăng nhập
app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;

    try {
        const result = await pool.query(
            `SELECT * FROM users 
       WHERE (email=$1 OR phone=$1 OR username=$1) 
       AND password=$2`,
            [identifier, password]
        );

        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.json({ success: false, message: 'Thông tin đăng nhập không đúng!' });
        }
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: 'Lỗi server!' });
    }
});

// API lấy danh sách người dùng
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// =============== Khởi động server ===============
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
