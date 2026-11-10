# Antam Clinic Backend (Express.js)

Dự án Backend cho Hệ thống Quản trị Phòng khám Đa chi nhánh An Tâm (Antam Clinic System).  
Xây dựng trên nền tảng **Node.js (ES Modules)** và **Express.js**, tuân thủ nguyên lý kiến trúc phân tán: **Mỗi Backend instance kết nối độc lập tới duy nhất 1 Database tương ứng (1 BE <---> 1 DB)**.

---

## 1. Kiến trúc phân tán 1 BE <---> 1 DB

Mỗi cơ sở (Node) trong mạng lưới bao gồm một cụm dịch vụ tự chủ:
* **Chi nhánh S1 (Cầu Giấy)**: `Backend S1` <---> `Database S1 (ql_phongkham_cn1:5431)`
* **Chi nhánh S2 (Đống Đa)**: `Backend S2` <---> `Database S2 (ql_phongkham_cn2:5432)`
* **Chi nhánh S3 (Ba Đình)**: `Backend S3` <---> `Database S3 (ql_phongkham_cn3:5433)`
* **Trung tâm S0 (Hub)**: `Backend S0` <---> `Database S0 (ql_phongkham_hub:5430)`

> [!NOTE]
> Backend của chi nhánh nào chỉ kết nối và đọc/ghi trên CSDL của chi nhánh đó.  
> - Dữ liệu danh mục chung (Master Data) được CSDL tự động đồng bộ từ Trung tâm S0 về các chi nhánh qua **Logical Replication**.  
> - Báo cáo toàn chuỗi tại Trung tâm S0 truy vấn qua **Foreign Data Wrapper (FDW)** và Global Views ở tầng CSDL.

---

## 2. Cài đặt và cấu hình

### Cài đặt dependencies:
```bash
npm install
```

### Thiết lập biến môi trường:
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

Ví dụ cấu hình cho Backend cơ sở **S1**:
```env
PORT=8080
NODE_ENV=development

# Thông tin cơ sở
SITE_CODE=S1
SITE_NAME=Chi nhánh Cầu Giấy

# CSDL cục bộ tương ứng
DB_HOST=localhost
DB_PORT=5431
DB_NAME=ql_phongkham_cn1
DB_USER=admin
DB_PASS=password123
```

Khi triển khai cho cơ sở khác (ví dụ S2), chỉ cần đổi `SITE_CODE=S2`, `DB_PORT=5432`, `DB_NAME=ql_phongkham_cn2`.

---

## 3. Khởi chạy ứng dụng

- **Chế độ phát triển (Watch mode - Node 22+)**:
  ```bash
  npm run dev
  ```
- **Chế độ production**:
  ```bash
  npm start
  ```

---

## 4. Các Endpoint mẫu sẵn có

- **Kiểm tra trạng thái kết nối CSDL cục bộ**:
  ```http
  GET /api/health
  ```
  Response mẫu:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-11-10T04:55:00.000Z",
    "uptime": 12.34,
    "database": {
      "status": "UP",
      "site": "S1",
      "siteName": "Chi nhánh Cầu Giấy",
      "database": "ql_phongkham_cn1",
      "user": "admin"
    }
  }
  ```

- **Lấy danh mục chi nhánh**:
  ```http
  GET /api/master/chi-nhanh
  ```

- **Lấy danh mục thuốc**:
  ```http
  GET /api/master/thuoc
  ```

- **Lấy danh mục dịch vụ**:
  ```http
  GET /api/master/dich-vu
  ```

---

## 5. Cấu trúc thư mục

```
backend/
├── public/                 # Chứa bundle build của Frontend (SPA)
├── src/
│   ├── config/
│   │   ├── database.js     # Pool kết nối CSDL cục bộ (1 BE <-> 1 DB)
│   │   └── env.js          # Load và validate biến môi trường
│   ├── controllers/        # Tầng Controller xử lý request
│   ├── middlewares/        # Middlewares (siteContext, errorHandler, notFound)
│   ├── routes/             # Định nghĩa API routes
│   ├── services/           # Nghiệp vụ business logic
│   ├── app.js              # Cấu hình Express app
│   └── server.js           # Khởi động HTTP server và quản lý tiến trình
├── .env.example            # Mẫu cấu hình môi trường
├── package.json
└── README.md
```
