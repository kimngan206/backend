const express = require('express');

const cors = require('cors');

const { Pool } = require('pg');

const bcrypt = require('bcryptjs'); // Import thư viện bcryptjs

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



// API đăng ký người dùng mới

app.post('/api/register', async (req, res) => {

    const { username, email, phone, password } = req.body;



    if (!username || !email || !phone || !password) {

        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin!' });

    }



    try {

        const check = await pool.query(

            'SELECT * FROM users WHERE email = $1 OR phone = $2',

            [email, phone]

        );



        if (check.rows.length > 0) {

            return res.status(409).json({ success: false, message: 'Email hoặc số điện thoại đã tồn tại!' });

        }



        // Băm mật khẩu trước khi lưu vào cơ sở dữ liệu

        const hashedPassword = await bcrypt.hash(password, 10); // 10 là saltRounds (độ phức tạp của thuật toán băm)



        await pool.query(

            'INSERT INTO users (username, email, phone, password) VALUES ($1, $2, $3, $4)',

            [username, email, phone, hashedPassword] // Lưu mật khẩu đã băm

        );



        return res.status(201).json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' });

    } catch (err) {

        console.error('Lỗi khi đăng ký:', err.message);

        res.status(500).json({ success: false, message: 'Lỗi server khi đăng ký!' });

    }

});



// API đăng nhập người dùng

app.post('/api/login', async (req, res) => {

    const { identifier, password } = req.body;



    if (!identifier || !password) {

        return res.status(400).json({ success: false, message: 'Vui lòng nhập thông tin đăng nhập!' });

    }



    try {

        const result = await pool.query(

            `SELECT * FROM users 

            WHERE email=$1 OR phone=$1 OR username=$1`, // Chỉ tìm người dùng theo identifier

            [identifier]

        );



        if (result.rows.length === 0) {

            return res.status(401).json({ success: false, message: 'Thông tin đăng nhập không đúng!' });

        }



        const user = result.rows[0];

        // So sánh mật khẩu người dùng nhập (đã được băm) với mật khẩu đã băm trong DB

        const isMatch = await bcrypt.compare(password, user.password);



        if (isMatch) {

            res.status(200).json({ success: true, message: 'Đăng nhập thành công!', user: { id: user.id, username: user.username, email: user.email, phone: user.phone } }); // Tránh trả về mật khẩu

        } else {

            res.status(401).json({ success: false, message: 'Thông tin đăng nhập không đúng!' });

        }

    } catch (err) {

        console.error('Lỗi khi đăng nhập:', err.message);

        res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập!' });

    }

});



// API lấy danh sách tất cả người dùng

app.get('/api/admin', async (req, res) => {

    try {

        const result = await pool.query('SELECT username, email, phone FROM users');

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

