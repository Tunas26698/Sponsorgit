# SponsorGit — Master Plan

> Nền tảng kết nối nhà quảng cáo (Advertiser) với các chủ dự án mã nguồn mở (Maintainer) thông qua banner tài trợ trên GitHub README.

---

## 1. Ý tưởng cốt lõi

SponsorGit là một **Sponsorship Marketplace** (sàn kết nối tài trợ) đứng giữa hai bên:

| Bên | Vai trò | Động lực |
|---|---|---|
| **Maintainer** (Publisher) | Chủ repo GitHub có nhiều star/traffic | Muốn kiếm tiền từ dự án Open Source |
| **Advertiser** (Khách hàng) | Công ty SaaS, DevTool, Cloud | Muốn tiếp cận tệp lập trình viên chất lượng cao |

**Cách hoạt động:** Maintainer dán một dòng Markdown vào `README.md` → Hiển thị banner tài trợ từ Advertiser → Maintainer nhận tiền hàng tháng.

---

## 2. Mô hình kiếm tiền (Pricing)

> **Triết lý: Đơn giản, không tracking.**

| Đối tượng | Giá | Chi tiết |
|---|---|---|
| **Advertiser** | **$19/tháng** flat fee per repo slot | Chọn repo theo topic & ngôn ngữ. Hủy bất cứ lúc nào. |
| **Maintainer** | **95% doanh thu** | Nền tảng chỉ giữ 5%. Payout hàng tháng qua Stripe. |

- Không dùng CPM/CPC vì không có cơ chế tracking user trên GitHub.
- Beta: Miễn phí 2 tháng đầu, không cần thẻ tín dụng.

---

## 3. Cơ chế kỹ thuật

### 3.1 Cách nhúng banner vào README

GitHub chỉ render Markdown thuần (không chạy JS, không cho iframe). Giải pháp duy nhất là dùng **Image Tag**:

```markdown
[![Sponsored by Vercel](https://api.sponsorgit.com/v1/badge/abc123)](https://sponsorgit.com/c/abc123)
```

**Luồng hoạt động:**
1. Khi developer mở README trên GitHub, trình duyệt gửi request tải ảnh từ `api.sponsorgit.com/v1/badge/abc123`.
2. Server SponsorGit nhận request → Chọn chiến dịch quảng cáo phù hợp → Trả về ảnh banner (SVG hoặc PNG).
3. Nếu developer click vào ảnh → Đi qua `sponsorgit.com/c/abc123` → Server ghi nhận click → Redirect (302) tới website nhà quảng cáo.

### 3.2 Vấn đề GitHub Camo Proxy

> ⚠️ QUAN TRỌNG

GitHub không tải ảnh trực tiếp từ URL gốc. Thay vào đó, GitHub dùng hệ thống **Camo Proxy** để tải ảnh từ server bạn, cache lại, rồi mới phục vụ cho người xem.

**Hệ quả:**
- Ảnh bị cache → Nếu không xử lý HTTP headers đúng, banner sẽ không cập nhật khi đổi chiến dịch quảng cáo.
- Không đếm được lượt xem thực tế của từng người dùng cuối (chỉ GitHub gọi server 1 lần).

**Giải pháp:**
- Set HTTP Header: `Cache-Control: no-cache, no-store, must-revalidate` và `Expires: 0`.
- Dùng format `.svg` để GitHub xử lý tốt hơn.

---

## 4. Hệ thống xác minh (Verification Pipeline)

### Bài toán: Làm sao biết Maintainer đã gắn banner đúng?

### Cách 1: GitHub API + Cron Job (✅ Chính — Bắt buộc cho MVP)

**Luồng:**
1. Maintainer đăng ký repo trên nền tảng.
2. Server cấp đoạn markdown chứa **unique ID**.
3. **Cron job chạy mỗi 12 giờ:**
   - Gọi API: `GET https://api.github.com/repos/{owner}/{repo}/readme`
   - GitHub trả về nội dung README dạng base64.
   - Decode → Tìm kiếm (string match) xem đoạn `api.sponsorgit.com/v1/badge/{unique_id}` có tồn tại không.
4. **Kết quả:**
   - ✅ Tìm thấy → Status: `ACTIVE` → Tiếp tục trả tiền.
   - ❌ Không thấy → Status: `PAUSED` → Gửi email cảnh báo → Tạm dừng phân phối ads.

**Rate Limit:** GitHub API cho phép 5,000 request/giờ (dùng token). Đủ cho hàng nghìn repo.

### Cách 2: Image Request Log (Bổ trợ)

- Nếu server nhận được request cho URL `badge/{id}` → Banner đang live.
- Không nhận request trong 24h → Khả năng cao đã bị gỡ.
- **Dùng làm tín hiệu bổ trợ**, không phải nguồn chính (vì Camo cache).

### Cách 3: GitHub Webhooks (Nâng cao — Scale sau)

- Yêu cầu Maintainer cấp quyền OAuth khi đăng ký.
- Đăng ký Webhook trên repo, lắng nghe `push` event.
- Mỗi khi có commit → GitHub gọi ngược server → Kiểm tra README ngay lập tức.
- **Real-time**, nhưng phức tạp hơn.

### Tổng hợp:

| Phương pháp | Độ chính xác | Độ khó | Thời điểm triển khai |
|---|---|---|---|
| GitHub API + Cron | 100% | Dễ | MVP |
| Image Request Log | ~80% | Rất dễ | MVP |
| Webhook | 100% real-time | Trung bình | V2 |

---

## 5. Tuân thủ luật GitHub (Legal Compliance)

> Đã kiểm tra Terms of Service & Acceptable Use Policies (cập nhật đến tháng 3/2026).

### ✅ Được phép:
- Chèn ảnh tĩnh (static images), link và text quảng cáo/tài trợ trong `README.md` của repo mình sở hữu.
- Dùng thẻ ảnh Markdown chuẩn `[![alt](image)](link)`.
- Maintainer tự nguyện gắn banner vào repo của chính họ.

### ❌ Không được phép:
- Biến repo thành nơi *chỉ* để hiển thị quảng cáo (mục đích chính phải là host code/tài liệu).
- Dùng bot tự động comment/spam link quảng cáo vào Issue hoặc PR của repo người khác.
- Nội dung quảng cáo lừa đảo, "get-rich-quick", hoặc chứa mã độc.

### Kết luận:
Mô hình SponsorGit **hoàn toàn hợp pháp** vì:
- Maintainer tự nguyện chèn banner vào repo của chính mình.
- Nội dung quảng cáo là các sản phẩm DevTool/SaaS có chất lượng (curated).
- Không có tracking pixel, không cookies, không vi phạm quyền riêng tư.

---

## 6. Đối thủ cạnh tranh & Bài học

| Tên | Mô hình | Trạng thái | Bài học |
|---|---|---|---|
| **GitAds (gitads.io)** | Banner động trong README, CPM | Hoạt động nhỏ | Chưa bùng nổ vì UX phức tạp |
| **CodeSponsor** | Chèn ads vào README | ❌ Đã đóng (2017) | Bị GitHub chặn do chính sách (nhưng GitHub đã nới lỏng từ đó) |
| **Carbon Ads** | Ads trên website Dev Docs | ✅ Rất thành công | Không nhúng vào GitHub, chỉ website |
| **EthicalAds** | Ads không tracking trên website | ✅ Thành công | Tệp khách hàng giống, nhưng khác kênh phân phối |
| **GitHub Sponsors** | Donation/Tài trợ trực tiếp | ✅ Chính thức | Không phải Ad Network, không tự động hóa |

**Lợi thế cạnh tranh của SponsorGit:**
- Nhắm đúng vào README trên GitHub (chưa ai làm tốt).
- Pricing đơn giản ($19 flat), không cần tracking phức tạp.
- 95% chia cho maintainer — cao nhất thị trường.

---

## 7. Chiến lược Go-to-Market

### Phase 1: Validate (Hiện tại)
- [x] Landing Page + Waitlist form.
- [ ] Thu thập email từ cả Maintainer và Advertiser.
- [ ] Mục tiêu: 100 đăng ký Maintainer + 20 đăng ký Advertiser.

### Phase 2: MVP Build
- [ ] Backend API: Serve banner image, track clicks, verify README.
- [ ] Dashboard cho Maintainer: Xem doanh thu, quản lý repo.
- [ ] Dashboard cho Advertiser: Upload banner, chọn repo, thanh toán $19/tháng qua Stripe.
- [ ] Hệ thống Cron verification (GitHub API).

### Phase 3: Growth
- [ ] Tìm 10-20 repo có 1k+ stars để pilot miễn phí.
- [ ] Tạo case study: "Repo X kiếm được $Y/tháng nhờ SponsorGit".
- [ ] Đăng lên Hacker News, Product Hunt, Reddit r/opensource.

---

## 8. Tech Stack đề xuất (cho MVP)

| Layer | Công nghệ |
|---|---|
| Frontend (Landing) | HTML/CSS/JS tĩnh (đã có) |
| Frontend (Dashboard) | Next.js hoặc Vite + React |
| Backend API | Node.js (Express/Fastify) hoặc Python (FastAPI) |
| Database | PostgreSQL (Supabase hoặc Neon) |
| Image serving | SVG generation on-the-fly hoặc pre-rendered PNG |
| Payment | Stripe (Subscriptions + Connect cho payout) |
| Cron Jobs | GitHub Actions hoặc Vercel Cron |
| Hosting | Vercel / Railway / Fly.io |

---

## 9. Cấu trúc dự án Landing Page hiện tại

```
github-sponsor-landing/
├── index.html      # Cấu trúc HTML chính
├── style.css       # CSS Lean Tech dark theme
└── script.js       # Logic form waitlist
```

**Các section trên Landing Page:**
1. Navbar (với link Pricing)
2. Hero (Tiêu đề + Waitlist form + Thống kê)
3. Features (Ethical, Drop-in, Premium)
4. How it Works (3 bước + Code window demo)
5. Pricing ($19/mo Advertiser, 95% Maintainer)
6. Footer
