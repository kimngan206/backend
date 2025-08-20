const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
// const bcrypt = require('bcryptjs'); // Không cần thư viện bcryptjs cho form liên hệ
require('dotenv').config(); // Đảm bảo dotenv được tải để sử dụng biến môi trường

const app = express();

// --- Cấu hình CORS ---
const corsOptions = {
    origin: 'https://kimngan206.github.io',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// --- Cấu hình kết nối PostgreSQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(client => {
        console.log('✅ Đã kết nối thành công tới PostgreSQL!');
        client.release();
    })
    .catch(err => {
        console.error('❌ Lỗi kết nối PostgreSQL:', err.message);
    });

// =============== API Endpoints ===============

// API xử lý form liên hệ
app.post('/api/contacts', async (req, res) => { // Đổi endpoint từ /api/contact sang /api/contacts cho rõ ràng
    const { full_name, email, phone_number, request_type, car_type, budget, detailed_message } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!full_name || !email || !phone_number) {
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin bắt buộc: Họ và tên, Email, Số điện thoại!' });
    }

    try {
        // Có thể thêm kiểm tra email/số điện thoại đã tồn tại nếu muốn, nhưng thường không cần cho form liên hệ
        // Nếu bạn muốn ngăn chặn việc gửi liên hệ trùng lặp quá nhanh, có thể thêm logic ở đây
        // Ví dụ: kiểm tra nếu có một liên hệ với cùng email/số điện thoại trong X phút gần đây

        await pool.query(
            'INSERT INTO contacts (full_name, email, phone_number, request_type, car_type, budget, detailed_message) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [full_name, email, phone_number, request_type, car_type, budget, detailed_message]
        );

        return res.status(201).json({ success: true, message: 'Gửi thông tin liên hệ thành công! Chúng tôi sẽ sớm liên hệ với bạn.' });
    } catch (err) {
        console.error('Lỗi khi gửi liên hệ:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi gửi liên hệ!' });
    }
});


// =============== Khởi động server ===============
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
    console.log(`Đang chờ yêu cầu từ frontend: ${corsOptions.origin}`);
});
