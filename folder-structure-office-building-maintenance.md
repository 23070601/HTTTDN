# Folder Structure Proposal

## SALES MANAGEMENT SYSTEM FOR COCOON VIETNAM

---

# 1. Kết luận nghiên cứu

Một folder structure chuyên nghiệp cho hệ thống **Sales Management System (SMS)** của Cocoon Vietnam không chỉ là cây thư mục “đẹp” mà phải:

* phản ánh đúng **kiến trúc hệ thống bán hàng đa kênh**;
* thể hiện rõ các **module nghiệp vụ** như đơn hàng, khách hàng, kho, loyalty, dashboard;
* giúp team dễ tìm code, dễ mở rộng và dễ bảo trì;
* hỗ trợ quản lý rõ ràng giữa:

  * frontend,
  * backend,
  * database,
  * analytics,
  * reports,
  * inventory,
  * customer management;
* ưu tiên tổ chức theo **feature/domain** thay vì chỉ chia theo technical type;
* hỗ trợ phát triển dashboard quản trị, báo cáo KPI và hệ thống CRM;
* phù hợp với workflow thực tế của Cocoon Vietnam:

  * bán hàng đa kênh,
  * quản lý nguyên liệu địa phương,
  * loyalty khách hàng,
  * quản lý đại lý,
  * phân tích doanh thu.

---

# 2. Tiêu chí thiết kế được áp dụng cho dự án này

Folder structure được thiết kế dựa trên các tiêu chí:

### 1. Kiến trúc phải nhìn thấy được từ cây thư mục

Repo phải thể hiện rõ:

* frontend
* backend
* database
* reports
* analytics
* docs
* scripts
* infrastructure

---

### 2. Tổ chức theo feature/domain trước

Không tổ chức toàn bộ code theo kiểu:

* `components/`
* `controllers/`
* `services/`

ở cấp cao nhất.

Thay vào đó tổ chức theo domain:

* orders
* customers
* inventory
* products
* dealers
* analytics
* loyalty
* dashboard

---

### 3. Colocation cho các thành phần liên quan

Những file thay đổi cùng nhau nên đặt gần nhau:

* API
* DTO
* validation
* UI components
* hooks
* services
* tests

---

### 4. Shared chỉ chứa thành phần dùng chung

`shared/` chỉ chứa:

* reusable UI
* common hooks
* utility functions
* constants
* permissions

Không biến shared thành “sọt rác”.

---

### 5. Rõ public/internal boundary

Các thành phần nội bộ phải tách riêng:

* `_internal/`
* `_components/`
* `_services/`

để tránh dependency lộn xộn.

---

### 6. Tối ưu cho teamwork

Structure phải giúp nhiều thành viên code song song:

* ít conflict merge
* dễ review
* dễ onboarding

---

### 7. Bám sát nghiệp vụ của Cocoon Vietnam

Folder structure phản ánh trực tiếp các nghiệp vụ:

* Omnichannel Orders
* CRM & Loyalty
* Inventory Management
* Raw Material Tracking
* Dealer Management
* Sales Analytics
* KPI Dashboard
* Audit Logs
* RBAC

---

# 3. Quyết định kiến trúc cho hệ thống

## 3.1. Cấp Repository

Sử dụng mô hình **single repository**:

* `frontend/` → giao diện người dùng
* `backend/` → REST API + business logic
* `database/` → schema + migration + trigger
* `docs/` → UML, ERD, API docs
* `scripts/` → automation scripts
* `infra/` → docker, deployment

---

## 3.2. Cấp Frontend

Frontend tổ chức theo:

* app
* pages
* features
* shared
* assets

---

## 3.3. Cấp Backend

Backend tổ chức theo:

* modules
* common
* config

---

## 3.4. Cấp Feature/Module

Mỗi feature đại diện cho một domain nghiệp vụ:

* auth
* products
* orders
* customers
* inventory
* loyalty
* dealers
* analytics
* reports
* dashboard
* audit-logs

---

# 4. Folder Structure đề xuất

```text
sales-management-system-cocoon/
│
├── README.md
├── .gitignore
├── .editorconfig
├── .env.example
├── docker-compose.yml
│
├── docs/
│   ├── proposal/
│   ├── uml/
│   ├── erd/
│   ├── api/
│   ├── testing/
│   ├── reports/
│   └── onboarding/
│
├── database/
│   ├── schema/
│   ├── migrations/
│   ├── seeds/
│   ├── triggers/
│   ├── procedures/
│   ├── views/
│   └── backup/
│
├── scripts/
│   ├── db/
│   ├── seed/
│   ├── analytics/
│   └── deployment/
│
├── infra/
│   ├── docker/
│   ├── nginx/
│   ├── env/
│   └── deploy/
│
├── frontend/
│   ├── public/
│   │   ├── images/
│   │   ├── icons/
│   │   └── illustrations/
│   │
│   └── src/
│       ├── app/
│       │   ├── router/
│       │   ├── layouts/
│       │   ├── providers/
│       │   ├── guards/
│       │   └── store/
│       │
│       ├── pages/
│       │   ├── auth/
│       │   ├── dashboard/
│       │   ├── products/
│       │   ├── orders/
│       │   ├── customers/
│       │   ├── inventory/
│       │   ├── dealers/
│       │   ├── analytics/
│       │   ├── reports/
│       │   └── profile/
│       │
│       ├── features/
│       │   ├── auth/
│       │   ├── products/
│       │   ├── categories/
│       │   ├── orders/
│       │   ├── payments/
│       │   ├── shipping/
│       │   ├── customers/
│       │   ├── loyalty/
│       │   ├── inventory/
│       │   ├── raw-materials/
│       │   ├── stock-in-out/
│       │   ├── dealers/
│       │   ├── analytics/
│       │   ├── dashboard/
│       │   ├── reports/
│       │   ├── notifications/
│       │   ├── audit-logs/
│       │   └── users/
│       │
│       ├── shared/
│       │   ├── ui/
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── constants/
│       │   ├── validation/
│       │   └── types/
│       │
│       ├── assets/
│       │   ├── styles/
│       │   ├── animations/
│       │   └── cocoon-branding/
│       │
│       └── tests/
│           ├── integration/
│           └── e2e/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   ├── decorators/
│   │   │   ├── interceptors/
│   │   │   ├── filters/
│   │   │   ├── exceptions/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── products/
│   │   │   ├── categories/
│   │   │   ├── inventory/
│   │   │   ├── raw-materials/
│   │   │   ├── stock-transactions/
│   │   │   ├── orders/
│   │   │   ├── order-items/
│   │   │   ├── payments/
│   │   │   ├── shipping/
│   │   │   ├── customers/
│   │   │   ├── loyalty/
│   │   │   ├── dealers/
│   │   │   ├── debt-management/
│   │   │   ├── dashboard/
│   │   │   ├── analytics/
│   │   │   ├── reports/
│   │   │   ├── notifications/
│   │   │   ├── audit-logs/
│   │   │   └── health/
│   │   │
│   │   └── jobs/
│   │       ├── inventory-alert.job.ts
│   │       ├── loyalty-update.job.ts
│   │       └── analytics-refresh.job.ts
│   │
│   ├── uploads/
│   └── tests/
│
└── .github/
    └── workflows/
```

---

# 5. Nguyên tắc bắt buộc khi sử dụng structure này

1. Không tạo folder chung chung như:

   * misc
   * temp
   * random
   * helper

---

2. Shared chỉ chứa thứ dùng chung thật sự.

---

3. Business logic không đặt trong UI page.

---

4. Mỗi feature phải có boundary rõ ràng:

* API
* service
* validation
* DTO
* types
* components

---

5. Không để toàn bộ validation hoặc DTO vào global nếu chỉ dùng cho một module.

---

6. Tests nên colocate gần feature nếu framework hỗ trợ.

---

7. Cây thư mục phải phản ánh:

* workflow nghiệp vụ,
* phân quyền RBAC,
* dashboard quản trị,
* vận hành kho,
* CRM,
* loyalty,
* omnichannel sales.

---

# 6. Recommendation for Technology Stack

Nếu chưa chốt công nghệ, lựa chọn phù hợp cho dự án:

| Layer          | Technology              |
| -------------- | ----------------------- |
| Frontend       | React + TypeScript      |
| Backend        | NestJS + TypeScript     |
| Database       | PostgreSQL / SQL Server |
| ORM            | Prisma / TypeORM        |
| Authentication | JWT + RBAC              |
| Charts         | Recharts / Chart.js     |
| Deployment     | Docker + Nginx          |

---

# 7. Tóm tắt

Folder structure này được thiết kế nhằm hỗ trợ:

* quản lý bán hàng đa kênh,
* quản lý kho và nguyên liệu,
* loyalty & CRM,
* phân tích doanh thu,
* dashboard quản trị,
* khả năng mở rộng hệ thống,
* teamwork hiệu quả,
* và maintainability lâu dài cho hệ thống Sales Management System của Cocoon Vietnam.
