# Antam Clinic Backend (Express.js)

Dự án Backend nền tảng cho Hệ thống Quản trị Phòng khám Đa chi nhánh An Tâm (Antam Clinic System).  
Xây dựng trên nền tảng **Node.js (ES Modules)** và **Express.js**, tích hợp kết nối phân tán đa cơ sở dữ liệu **PostgreSQL** (S0: Trung tâm, S1..S3: Chi nhánh).

---

## 1. Yêu cầu môi trường

- **Node.js**: >= 20.x (Khuyến nghị 22+)
- **PostgreSQL**: Cụm Docker multi-site chạy ở các port:
  - S0 (Hub): `5430` (`ql_phongkham_hub`)
  - S1 (Cầu Giấy): `5431` (`ql_phongkham_cn1`)
  - S2 (Đống Đa): `5432` (`ql_phongkham_cn2`)
  - S3 (Ba Đình): `5433` (`ql_phongkham_cn3`)

---

## 2. Cài đặt và khởi chạy

### Cài đặt dependencies:
```bash
npm install
```

### Thiết lập biến môi trường:
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

### Chạy ứng dụng:
- **Chế độ phát triển (Watch mode - Node 22+)**:
  ```bash
  npm run dev
  ```
- **Chế độ production**:
  ```bash
  npm start
  ```

---

## 3. Kiến trúc Đa cơ sở (Multi-site)

Hệ thống hỗ trợ định tuyến truy vấn đến đúng cơ sở thông qua:
1. **Header HTTP**: `X-Site: S1` (hoặc `S0`, `S2`, `S3`)
2. **Query Parameter**: `?site=S1`
3. **Mặc định**: Lấy từ biến môi trường `DEFAULT_SITE` (mặc định là `S1`).

Middleware `siteContext` sẽ tự động gắn kết nối cơ sở dữ liệu tương ứng vào `req.db` và mã chi nhánh vào `req.site`.

---

## 4. Các Endpoint mẫu sẵn có

- **Kiểm tra trạng thái kết nối 4 cơ sở CSDL**:
  ```http
  GET /api/health
  ```
- **Lấy danh sách chi nhánh (Master Data từ Hub S0)**:
  ```http
  GET /api/master/chi-nhanh
  ```
- **Lấy danh mục thuốc (theo site hiện tại)**:
  ```http
  GET /api/master/thuoc
  Header: X-Site: S1
  ```
- **Lấy danh mục dịch vụ (theo site hiện tại)**:
  ```http
  GET /api/master/dich-vu
  Header: X-Site: S2
  ```

---

## 5. Cấu trúc thư mục

```
backend/
├── public/                 # Chứa bundle build của Frontend (SPA)
├── src/
│   ├── config/
│   │   ├── database.js     # Pool kết nối 4 cơ sở dữ liệu (S0, S1, S2, S3)
│   │   └── env.js          # Load và validate biến môi trường
│   ├── controllers/        # Xử lý logic tầng Controller
│   ├── middlewares/        # Middlewares (siteContext, errorHandler, notFound)
│   ├── routes/             # Định nghĩa API routes
│   ├── services/           # Nghiệp vụ business logic
│   ├── app.js              # Cấu hình Express app
│   └── server.js           # Khởi động HTTP server và quản lý tiến trình
├── .env.example            # Mẫu cấu hình môi trường
├── package.json
└── README.md
```
