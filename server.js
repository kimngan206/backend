const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config(); // Đảm bảo dotenv được tải để sử dụng biến môi trường

const app = express();

// --- Cấu hình CORS ---
// Thay thế 'https://kimngan206.github.io' bằng tên miền chính xác của trang web của bạn trên GitHub Pages.
// Đảm bảo không có dấu '/' ở cuối.
const corsOptions = {
    origin: 'https://kimngan206.github.io', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Chỉ cho phép các phương thức cần thiết
    allowedHeaders: ['Content-Type', 'Authorization'], // Thêm Authorization nếu bạn dùng token sau này
};

// Áp dụng middleware CORS với cấu hình đã tạo
app.use(cors(corsOptions));
app.use(express.json()); // Middleware để phân tích cú pháp JSON trong body request

// --- Cấu hình kết nối PostgreSQL ---
// RẤT QUAN TRỌNG: Sử dụng biến môi trường cho chuỗi kết nối cơ sở dữ liệu.
// Bạn cần đặt biến môi trường DATABASE_URL trên Render.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // SỬ DỤNG BIẾN MÔI TRƯỜNG Ở ĐÂY!
    ssl: { rejectUnauthorized: false } // Đảm bảo điều này nếu bạn đang dùng Render/Supabase
});

// Kiểm tra kết nối cơ sở dữ liệu khi khởi động server
pool.connect()
    .then(client => {
        console.log('✅ Đã kết nối thành công tới PostgreSQL!');
        client.release(); // Giải phóng client ngay lập tức
    })
    .catch(err => {
        console.error('❌ Lỗi kết nối PostgreSQL:', err.message);
        // Có thể thoát ứng dụng nếu không kết nối được DB
        // process.exit(1); 
    });


// =============== API Endpoints ===============

// API đăng ký người dùng mới
app.post('/api/register', async (req, res) => {
    const { username, email, phone, password } = req.body;

    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!username || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin!' });
    }

    try {
        // Kiểm tra xem email hoặc số điện thoại đã tồn tại chưa
        const check = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR phone = $2',
            [email, phone]
        );

        if (check.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Email hoặc số điện thoại đã tồn tại!' });
        }

        // Chèn thông tin người dùng mới vào cơ sở dữ liệu
        // LƯU Ý BẢO MẬT: Mật khẩu NÊN được mã hóa (hash) trước khi lưu vào DB.
        // Ví dụ: sử dụng bcryptjs.
        await pool.query(
            'INSERT INTO users (username, email, phone, password) VALUES ($1, $2, $3, $4)',
            [username, email, phone, password]
        );

        return res.status(201).json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
    } catch (err) {
        console.error('Lỗi khi đăng ký:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi đăng ký!' });
    }
});

// API đăng nhập người dùng
app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body; // identifier có thể là email, số điện thoại hoặc username

    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập thông tin đăng nhập!' });
    }

    try {
        // Tìm người dùng theo email, số điện thoại hoặc username và kiểm tra mật khẩu
        const result = await pool.query(
            `SELECT * FROM users 
            WHERE (email=$1 OR phone=$1 OR username=$1) 
            AND password=$2`, // LƯU Ý BẢO MẬT: So sánh mật khẩu đã mã hóa
            [identifier, password]
        );

        if (result.rows.length > 0) {
            // Đăng nhập thành công, có thể trả về thông tin người dùng hoặc token JWT
            res.status(200).json({ success: true, message: 'Đăng nhập thành công!', user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Thông tin đăng nhập không đúng!' });
        }
    } catch (err) {
        console.error('Lỗi khi đăng nhập:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập!' });
    }
});

// API lấy danh sách tất cả người dùng (chỉ để kiểm tra, không nên dùng trong production nếu không có xác thực)
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, email, phone FROM users'); // Tránh trả về mật khẩu
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách người dùng:', err.message);
        res.status(500).json({ error: 'Lỗi server khi lấy danh sách người dùng!' });
    }
});

// =============== Khởi động server ===============
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
    console.log(`Đang chờ yêu cầu từ frontend: ${corsOptions.origin}`);
});
