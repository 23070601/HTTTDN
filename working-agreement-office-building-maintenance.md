# WORKING AGREEMENT

## COCOON VIETNAM SALES & DISTRIBUTION MANAGEMENT SYSTEM

**Version:** 1.0
**Date:** 2026-05-16
**Applies to:** All code, database, API, UI, analytics, inventory, customer management, dealer management, documentation, tests, and Git workflow in this project.

---

# 1. Mục đích

Tài liệu này là **bộ quy tắc vận hành kỹ thuật** để team phát triển hệ thống quản lý bán hàng và phân phối của Cocoon Vietnam một cách:

* thống nhất;
* logic;
* ít conflict;
* dễ review;
* dễ mở rộng;
* dễ maintain;
* phản ánh đúng nghiệp vụ thực tế của Cocoon Vietnam.

Hệ thống tập trung vào:

* quản lý bán mỹ phẩm thuần chay;
* quản lý tồn kho thành phẩm và nguyên liệu địa phương;
* quản lý khách hàng và loyalty;
* quản lý đơn hàng đa kênh;
* quản lý đại lý và công nợ;
* phân tích doanh thu và hành vi khách hàng.

---

# 2. Nguyên tắc nền tảng

## Rule 2.1 — Consistency quan trọng hơn sở thích cá nhân

Nếu có nhiều cách đều hợp lý, ưu tiên cách đang được dùng trong project.

## Rule 2.2 — Không có “ngầm hiểu”

Mọi workflow, naming, API contract, RBAC, business rule hoặc UI behavior ảnh hưởng nhiều phần phải được document rõ.

## Rule 2.3 — Backend là nơi enforce business rules

Frontend hỗ trợ UX.
Backend phải chịu trách nhiệm:

* RBAC;
* validation;
* pricing logic;
* loyalty calculation;
* debt calculation;
* stock validation;
* workflow;
* audit log.

## Rule 2.4 — Một thay đổi phải update đủ artifact liên quan

Nếu đổi:

* workflow;
* enum;
* database;
* API shape;
* pricing logic;
* loyalty logic;
* inventory logic;

thì phải update:

* code;
* ERD;
* API spec;
* frontend mapping;
* seed;
* docs.

## Rule 2.5 — Không merge code “chạy được nhưng không thống nhất”

Code không được merge nếu phá:

* naming convention;
* feature boundary;
* workflow;
* API contract;
* source of truth.

## Rule 2.6 — Ưu tiên PR nhỏ, dễ review

Task nhỏ, commit rõ ràng, diff dễ đọc.

---

# 3. Phạm vi áp dụng

Agreement này áp dụng cho:

* frontend;
* backend;
* database;
* analytics;
* inventory;
* customer management;
* dealer management;
* loyalty system;
* order management;
* API;
* docs;
* test;
* Git workflow.

Hệ thống gồm các module chính:

* Auth & RBAC
* Product Management
* Inventory Management
* Raw Material Management
* Order Management
* Customer & Loyalty
* Dealer & Debt Management
* Sales Analytics
* Dashboard & Reporting
* Audit Logs
* Notifications

---

# 4. Source of Truth

## Rule 4.1 — Mỗi concern chỉ có một nguồn sự thật chính

| Concern          | Source of Truth            |
| ---------------- | -------------------------- |
| Business scope   | Proposal                   |
| Workflow         | Use Case + Business Rules  |
| Data model       | ERD + migrations           |
| API contract     | OpenAPI/docs/api           |
| UI behavior      | docs/ui hoặc wireframe     |
| Folder structure | cocoon-folder-structure.md |
| Team rules       | Working Agreement          |

---

# 5. Kiến trúc hệ thống

## Rule 5.1 — Kiến trúc tổng thể

Hệ thống đi theo hướng:

* web-based monolithic architecture;
* module-based organization;
* REST API;
* RBAC.

## Rule 5.2 — 3-layer architecture

### Presentation Layer

* pages
* components
* forms
* UI state

### Application Layer

* services
* business rules
* workflow
* loyalty engine
* inventory calculation
* analytics aggregation

### Data Layer

* repositories
* ORM/database
* migrations
* queries

## Rule 5.3 — Không bypass layer

Không cho phép:

* UI query DB trực tiếp;
* controller viết business logic lớn;
* frontend tự validate stock;
* frontend tự tính loyalty points;
* module truy cập DB module khác trực tiếp.

---

# 6. Module chuẩn của hệ thống

Các module chuẩn:

* auth
* users
* dashboard
* products
* product-categories
* inventory
* raw-materials
* stock-transactions
* orders
* customers
* loyalty
* dealers
* debts
* analytics
* reports
* notifications
* audit-logs
* master-data
* common

---

# 7. Quy tắc chia việc giữa 2 dev

## Dev A — Frontend & Customer Experience

Phụ trách:

* Customer Home
* Product Catalog
* Product Detail
* Cart & Checkout
* Loyalty UI
* Customer Profile
* Shared UI components

## Dev B — Backend & Internal System

Phụ trách:

* Inventory
* Raw Material
* Dealer Management
* Debt Management
* Analytics
* Dashboard
* Audit Logs
* Database & workflow core

## Shared ownership

* API contract
* ERD
* Folder structure
* Coding convention
* PR review
* Documentation

---

# 8. Ngôn ngữ nghiệp vụ chuẩn

| Khái niệm     | Tên chuẩn         |
| ------------- | ----------------- |
| Khách hàng    | customer          |
| Đại lý        | dealer            |
| Đơn hàng      | order             |
| Thành phẩm    | product           |
| Nguyên liệu   | raw_material      |
| Giao dịch kho | stock_transaction |
| Công nợ       | debt              |
| Điểm thưởng   | loyalty_points    |
| Doanh thu     | revenue           |
| Tồn kho       | inventory         |
| Kênh bán hàng | sales_channel     |

---

# 9. Workflow và business rules

## Rule 9.1 — Trạng thái đơn hàng chuẩn

* Pending
* Confirmed
* Processing
* Shipping
* Delivered
* Cancelled
* Returned

## Rule 9.2 — Không tự tạo status mới

Nếu thêm status mới phải update:

* seed;
* enum;
* frontend mapping;
* API docs;
* test.

## Rule 9.3 — Inventory không được âm

Không cho phép:

* checkout vượt tồn kho;
* xuất kho vượt số lượng hiện có.

## Rule 9.4 — Loyalty point calculation phải centralized

Không tính loyalty ở frontend.

## Rule 9.5 — Dealer debt phải có transaction history

Mọi thay đổi công nợ phải log đầy đủ.

## Rule 9.6 — Raw material phải traceable

Nguyên liệu phải lưu:

* nguồn gốc;
* supplier;
* quantity;
* import date;
* expiry date nếu có.

---

# 10. Database rules

## Rule 10.1 — Migration bắt buộc cho mọi thay đổi schema

## Rule 10.2 — Naming chuẩn

### Table

snake_case

Ví dụ:

* products
* raw_materials
* stock_transactions

### Foreign key

`<entity>_id`

### Timestamp

* created_at
* updated_at

---

# 11. API contract rules

## Rule 11.1 — API spec là contract chính thức

## Rule 11.2 — Prefix API chuẩn

```txt
/api/v1
```

## Rule 11.3 — Response format chuẩn

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "Product is out of stock"
  }
}
```

---

# 12. Security rules

## Rule 12.1 — Backend phải enforce RBAC

Frontend chỉ hỗ trợ UX.

## Rule 12.2 — Không trust data từ client

Không trust:

* role;
* product price;
* loyalty point;
* debt amount;
* stock quantity.

## Rule 12.3 — Upload policy

Cho phép:

* .jpg
* .jpeg
* .png
* .webp

## Rule 12.4 — Secrets không commit vào repo

---

# 13. UI/UX rules

## Rule 13.1 — Status mapping phải thống nhất

Cùng status phải cùng:

* màu;
* badge;
* label;
* icon.

## Rule 13.2 — Mọi màn hình phải có:

* loading state;
* empty state;
* error state;
* success state.

## Rule 13.3 — Dashboard phải realtime-friendly

Dashboard phải hỗ trợ:

* KPI cards;
* charts;
* filters;
* analytics.

## Rule 13.4 — Product Catalog phải hỗ trợ filter

Filter theo:

* ingredient;
* category;
* price;
* skin concern;
* vegan tags.

---

# 14. Folder structure & naming

## Rule 14.1 — Feature-first structure

## Rule 14.2 — Không tạo folder mơ hồ

Không dùng:

* misc
* temp
* final
* helper2

## Rule 14.3 — Naming chuẩn

| Item              | Convention |
| ----------------- | ---------- |
| folder/file       | kebab-case |
| class             | PascalCase |
| variable/function | camelCase  |

---

# 15. Testing strategy

## Rule 15.1 — Flow bắt buộc phải test

* login/logout;
* checkout;
* inventory deduction;
* loyalty calculation;
* dealer debt update;
* RBAC;
* stock alert;
* analytics aggregation.

## Rule 15.2 — Bug fix nên có regression test

---

# 16. Git workflow rules

## Rule 16.1 — Không push trực tiếp vào main

## Rule 16.2 — Branch naming

```txt
feat/<module>-<feature>
fix/<module>-<bug>
docs/<area>
refactor/<area>
```

Ví dụ:

```txt
feat/orders-checkout-flow
feat/inventory-stock-alert
fix/loyalty-point-calculation
```

## Rule 16.3 — Conventional commits

Ví dụ:

```txt
feat(products): add product catalog filtering
fix(inventory): prevent negative stock quantity
```

---

# 17. Code review rules

Reviewer phải check:

* workflow;
* RBAC;
* inventory integrity;
* API contract;
* analytics accuracy;
* folder boundary;
* naming consistency;
* database consistency.

---

# 18. Definition of Done

Task chỉ được coi là Done khi:

* code chạy local;
* lint/typecheck pass;
* test pass;
* API spec update nếu cần;
* migration update nếu cần;
* docs update nếu cần;
* đã review;
* merge đúng workflow.

---

# 19. Change management

Các thay đổi sau bắt buộc có decision note:

* đổi inventory workflow;
* đổi loyalty logic;
* đổi pricing logic;
* đổi debt calculation;
* đổi API contract lớn;
* đổi folder structure;
* đổi RBAC.

Format:

```txt
docs/decisions/YYYY-MM-DD-topic.md
```

---

# 20. Environment rules

Repo phải có:

* README.md
* .env.example
* migrate script
* seed script
* run-dev script

---

# 21. Communication rules

## Daily async update

Mỗi dev update:

* hôm qua làm gì;
* hôm nay làm gì;
* blocker hiện tại.

## Cross-cutting changes phải sync trước

Ví dụ:

* auth;
* inventory;
* analytics;
* loyalty;
* pricing;
* API contract.

---

# 22. Business-critical invariants

Các invariant không được phá:

* Inventory không âm.
* Loyalty point phải chính xác.
* Dealer debt phải traceable.
* Audit log phải ghi lại action quan trọng.
* Dashboard phải dùng dữ liệu thật.
* Raw material phải có nguồn gốc rõ ràng.
* Customer chỉ thấy dữ liệu của chính mình.
* Manager có quyền xem toàn hệ thống.

---

# 23. Checklist kickoff

* [ ] Scope V1
* [ ] ERD final
* [ ] API spec
* [ ] Folder structure
* [ ] Role matrix
* [ ] Workflow matrix
* [ ] Git workflow
* [ ] UI sitemap
* [ ] Analytics KPI list

---

# 24. Checklist mở PR

* [ ] Branch đúng convention
* [ ] Commit đúng convention
* [ ] Lint pass
* [ ] Test pass
* [ ] Không còn debug code
* [ ] Docs đã update
* [ ] Migration đã update nếu cần
* [ ] Có screenshot nếu đổi UI

---

# 25. Final note

Nếu có conflict giữa:

* tốc độ và maintainability;
* code nhanh và consistency;
* sở thích cá nhân và architecture;

thì dự án này ưu tiên:

* maintainability;
* readability;
* scalability;
* business correctness;
* workflow consistency;
* data integrity.
