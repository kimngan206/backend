const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// --- Cấu hình CORS ---
const corsOptions = {
    origin: 'https://kimngan206.github.io', // Đảm bảo URL này chính xác với frontend của bạn
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
        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (username, email, phone, password) VALUES ($1, $2, $3, $4)',
            [username, email, phone, hashedPassword]
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
            WHERE email=$1 OR phone=$1 OR username=$1`,
            [identifier]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Thông tin đăng nhập không đúng!' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            res.status(200).json({ success: true, message: 'Đăng nhập thành công!', user: { id: user.id, username: user.username, email: user.email, phone: user.phone } });
        } else {
            res.status(401).json({ success: false, message: 'Thông tin đăng nhập không đúng!' });
        }
    } catch (err) {
        console.error('Lỗi khi đăng nhập:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập!' });
    }
});

// API lấy danh sách tất cả người dùng (cho trang admin)
app.get('/api/admin', async (req, res) => {
    try {
        // Lấy thêm cột 'id' để frontend có thể sử dụng cho chức năng xóa
        const result = await pool.query('SELECT id, username, email, phone FROM users ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách người dùng:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách người dùng!' });
    }
});

// API xóa người dùng theo ID
app.delete('/api/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
        if (result.rowCount > 0) {
            res.status(200).json({ success: true, message: `Người dùng với ID ${userId} đã được xóa thành công.` });
        } else {
            res.status(404).json({ success: false, message: `Không tìm thấy người dùng với ID ${userId}.` });
        }
    } catch (err) {
        console.error('Lỗi khi xóa người dùng:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa người dùng!' });
    }
});

// API xử lý form liên hệ
app.post('/api/contacts', async (req, res) => {
    const { full_name, email, phone_number, request_type, car_type, budget, detailed_message } = req.body;

    if (!full_name || !email || !phone_number) {
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin bắt buộc: Họ và tên, Email, Số điện thoại!' });
    }

    try {
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

// ============ API Endpoints cho Sản phẩm ============

// API: Lấy danh sách tất cả sản phẩm
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, price, description, image_url FROM products ORDER BY id ASC');
        // Đổi tên cột image_url thành image để khớp với frontend
        const products = result.rows.map(product => ({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price), // Chuyển đổi về số float
            description: product.description,
            image: product.image_url // Đổi tên cột
        }));
        res.status(200).json(products);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách sản phẩm:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách sản phẩm!' });
    }
});

// API: Lấy thông tin sản phẩm theo ID
app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const result = await pool.query('SELECT id, name, price, description, image_url FROM products WHERE id = $1', [productId]);
        if (result.rows.length > 0) {
            const product = result.rows[0];
            // Đổi tên cột image_url thành image để khớp với frontend
            res.status(200).json({
                id: product.id,
                name: product.name,
                price: parseFloat(product.price), // Chuyển đổi về số float
                description: product.description,
                image: product.image_url // Đổi tên cột
            });
        } else {
            res.status(404).json({ success: false, message: `Không tìm thấy sản phẩm với ID ${productId}.` });
        }
    } catch (err) {
        console.error('Lỗi khi lấy thông tin sản phẩm:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông tin sản phẩm!' });
    }
});

// API: Thêm sản phẩm mới
app.post('/api/manage_product', async (req, res) => {
    const { name, price, description, image } = req.body; // image tương ứng với image_url

    if (!name || !price || !image) {
        return res.status(400).json({ success: false, message: 'Tên, giá và URL hình ảnh sản phẩm là bắt buộc!' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO products (name, price, description, image_url) VALUES ($1, $2, $3, $4) RETURNING id, name, price, description, image_url',
            [name, price, description || null, image] // description có thể null
        );
        const newProduct = result.rows[0];
        res.status(201).json({ success: true, message: 'Thêm sản phẩm thành công!', product: {
            id: newProduct.id,
            name: newProduct.name,
            price: parseFloat(newProduct.price),
            description: newProduct.description,
            image: newProduct.image_url
        }});
    } catch (err) {
        console.error('Lỗi khi thêm sản phẩm:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi thêm sản phẩm!' });
    }
});

// API: Cập nhật sản phẩm theo ID
app.put('/api/manage_product/:id', async (req, res) => {
    const productId = req.params.id;
    const { name, price, description, image } = req.body; // image tương ứng với image_url

    if (!name || !price || !image) {
        return res.status(400).json({ success: false, message: 'Tên, giá và URL hình ảnh sản phẩm là bắt buộc!' });
    }

    try {
        const result = await pool.query(
            'UPDATE products SET name = $1, price = $2, description = $3, image_url = $4 WHERE id = $5 RETURNING id, name, price, description, image_url',
            [name, price, description || null, image, productId]
        );

        if (result.rowCount > 0) {
            const updatedProduct = result.rows[0];
            res.status(200).json({ success: true, message: 'Cập nhật sản phẩm thành công!', product: {
                id: updatedProduct.id,
                name: updatedProduct.name,
                price: parseFloat(updatedProduct.price),
                description: updatedProduct.description,
                image: updatedProduct.image_url
            }});
        } else {
            res.status(404).json({ success: false, message: `Không tìm thấy sản phẩm với ID ${productId}.` });
        }
    } catch (err) {
        console.error('Lỗi khi cập nhật sản phẩm:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật sản phẩm!' });
    }
});

// API: Xóa sản phẩm theo ID
app.delete('/api/manage_product/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [productId]);
        if (result.rowCount > 0) {
            res.status(200).json({ success: true, message: `Sản phẩm với ID ${productId} đã được xóa thành công.` });
        } else {
            res.status(404).json({ success: false, message: `Không tìm thấy sản phẩm với ID ${productId}.` });
        }
    } catch (err) {
        console.error('Lỗi khi xóa sản phẩm:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa sản phẩm!' });
    }
});

// =============== Khởi động server ===============
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
    console.log(`Đang chờ yêu cầu từ frontend: ${corsOptions.origin}`);
});
