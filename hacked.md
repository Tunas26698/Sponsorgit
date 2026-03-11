# SponsorGit — Security Audit (White Hat)

> Tài liệu này là kết quả kiểm tra bảo mật của toàn bộ hệ thống SponsorGit.
> Cập nhật lần cuối: 2026-03-11

---

## 🏗️ Attack Surface tổng quan

```
ADVERTISER ──upload banner──► [SponsorGit Server] ──SVG──► GitHub Camo ──► Developer
                               /v1/badge/:repoId             (proxy)
                 click ──────► /click/:repoId ──redirect──► Advertiser site
```

---

## ✅ Những gì KHÔNG thể bị tấn công (by design)

| Attack | Lý do an toàn |
|--------|--------------|
| XSS qua SVG | GitHub Camo convert SVG → PNG, strip toàn bộ script & event handler |
| Track IP user thật | Camo ẩn hoàn toàn IP người xem, server chỉ thấy IP của Camo |
| Đọc code trong repo | Image tag không có read access vào repo |
| Write vào repo người khác | Server không có GitHub write permission |
| Steal GitHub token | Không có JS execution trong Markdown image |
| CSRF | Không có form submit, không có cookie trong flow |

---

## 🔴 HIGH — Cần fix trước khi launch

### 1. SQL/NoSQL Injection qua `repoId`

**Vector:**
```
GET /v1/badge/' OR '1'='1
GET /v1/badge/; DROP TABLE campaigns; --
GET /v1/badge/{"$gt": ""}
```

**Vulnerable code:**
```js
// ❌ KHÔNG BAO GIỜ LÀM THẾ NÀY
db.query(`SELECT * FROM campaigns WHERE repo_id = '${repoId}'`)
```

**Fix:**
```js
// ✅ Parameterized query
db.query('SELECT * FROM campaigns WHERE repo_id = $1', [repoId])

// ✅ Validate repoId format trước
if (!/^[a-zA-Z0-9_-]{1,100}$/.test(repoId)) {
  return res.status(400).send('Invalid repo ID')
}
```

---

### 2. SSRF qua banner URL của Advertiser

**Vector:** Advertiser tạo campaign với `bannerUrl = http://169.254.169.254/latest/meta-data/` (AWS metadata endpoint) → Server tự leak cloud credentials.

**Vulnerable code:**
```js
// ❌ KHÔNG fetch URL từ advertiser
const banner = await fetch(campaign.bannerUrl)
```

**Fix:**
```js
// ✅ Chỉ cho phép upload banner lên S3/CDN của SponsorGit
// Không bao giờ fetch URL ngoài từ server
// Banner URL trong DB chỉ được phép có dạng: https://cdn.sponsorgit.com/...
const ALLOWED_CDN = 'https://cdn.sponsorgit.com'
if (!campaign.bannerUrl.startsWith(ALLOWED_CDN)) {
  throw new Error('Invalid banner URL')
}
```

---

### 3. Rate Limit / DoS trên Badge Endpoint

**Vector:**
```bash
# Flood server → tất cả badge trên mọi repo đều break
for i in {1..10000}; do
  curl https://api.sponsorgit.com/v1/badge/sponsorgit &
done
```

**Hệ quả:** Server quá tải → maintainer không nhận tiền, advertiser không hiện banner.

**Fix:**
```js
const rateLimit = require('express-rate-limit')

app.use('/v1/badge', rateLimit({
  windowMs: 60_000,      // 1 phút
  max: 60,               // 60 req/min per IP
  skip: (req) => {
    // Whitelist GitHub Camo — không rate limit Camo
    return req.headers['user-agent']?.includes('github-camo')
  }
}))

app.use('/click', rateLimit({
  windowMs: 60_000,
  max: 30
}))
```

---

### 4. Path Traversal qua `repoId`

**Vector:**
```
GET /v1/badge/../../admin/config
GET /v1/badge/%2e%2e%2f%2e%2e%2fadmin
```

**Vulnerable code:**
```js
// ❌ Nếu dùng repoId để đọc file
const template = fs.readFileSync(`./banners/${repoId}.svg`)
```

**Fix:**
```js
// ✅ Validate chặt format, không dùng repoId trực tiếp làm path
if (!/^[a-zA-Z0-9_-]{1,100}$/.test(repoId)) {
  return res.status(400).send('Invalid')
}
// Dùng DB lookup, không dùng filesystem
```

---

## 🟡 MEDIUM — Quan trọng nhưng có thể làm sau

### 5. Cache Poisoning qua HTTP Headers

**Vector:**
```
GET /v1/badge/sponsorgit
X-Forwarded-Host: evil.com
X-Original-URL: /v1/badge/evil-ad
```

Nếu server dùng headers để generate response, hacker poison Camo cache → mọi người xem repo đó thấy banner giả.

**Fix:**
```js
// Không bao giờ trust X-Forwarded-* để generate SVG content
// Chỉ lấy repoId từ req.params, không từ headers
```

---

### 6. Enum tất cả Repo & Campaign

**Vector:**
```
GET /v1/badge/vercel    → 200 (có sponsor)
GET /v1/badge/google    → 200 (có sponsor)
GET /v1/badge/nobody    → 404 (không có)
```

Hacker scan để biết repo nào đang có sponsor, từ đó tìm cách target.

**Fix:**
- Response SVG không chứa thông tin nhạy cảm (price, revenue, email)
- Trả về default banner cho repo không tìm thấy (thay vì 404)
- Rate limit aggressive scanning

---

### 7. Malicious Redirect qua Click URL

**Vector:** Nếu DB bị inject hoặc `/click/:id` bị tấn công → redirect user đến phishing site.

**Fix:**
```js
app.get('/click/:repoId', async (req, res) => {
  const campaign = await db.getCampaign(req.params.repoId)
  
  // ✅ Whitelist domain cho phép
  const url = new URL(campaign.redirectUrl)
  const BLOCKED = ['evil.com', 'phishing.net'] // blacklist
  if (BLOCKED.includes(url.hostname)) {
    return res.status(403).send('Blocked')
  }
  
  // ✅ Chỉ redirect HTTP/HTTPS
  if (!['http:', 'https:'].includes(url.protocol)) {
    return res.status(400).send('Invalid protocol')
  }
  
  res.redirect(302, campaign.redirectUrl)
})
```

---

### 8. Banner Spoofing / Brand Impersonation

**Vector:** Advertiser upload banner giả mạo:
```
"⚠️ GitHub Security Alert — Click to verify your account"
"🎁 You won GitHub Pro — Claim now"
"Sponsored by GitHub" (logo giả)
```

**Fix:**
- Maintainer review banner trước khi accept (đã có trong flow)
- ToS rõ ràng cấm: brand impersonation, urgency/fear-based, fake rewards
- Thêm "Report this ad" button cho developer thấy banner xấu
- Human review với repo lớn (>10k stars)

---

## 🟢 LOW — Nice to have

### 9. Subresource Integrity cho Badge CDN

Nếu serve banner từ CDN, thêm integrity hash để detect tampering.

### 10. Audit Log

Log tất cả: banner upload, campaign approve/deny, banner changes — để forensics khi có incident.

```js
await auditLog.write({
  action: 'BANNER_SERVED',
  repoId,
  campaignId: campaign.id,
  camoIp: req.ip,
  timestamp: new Date()
})
```

---

## 📋 Pre-Launch Security Checklist

```
HIGH (bắt buộc):
□ Validate repoId: /^[a-zA-Z0-9_-]{1,100}$/
□ Parameterized DB queries — không string concat
□ Rate limit badge + click endpoints
□ Banner lưu trên CDN của mình, không fetch URL ngoài
□ Validate redirect URL — chỉ HTTP/HTTPS

MEDIUM (trước public launch):
□ Không trust X-Forwarded-* headers để generate content
□ Response SVG không leak campaign metadata
□ ToS cấm brand impersonation + reporting mechanism

LOW (sau launch):
□ Audit log mọi action
□ Alert khi detect scanning pattern bất thường
□ CDN subresource integrity
□ Penetration test chuyên nghiệp trước Series A
```

---

## 🏆 Kết luận

**Điểm tốt:** Cơ chế image tag qua GitHub Camo đã tự mitigate phần lớn attack XSS/tracking. Đây là thiết kế an toàn by default.

**Rủi ro chính:** Ở tầng **application** (injection, SSRF, redirect abuse) — không phải tầng kỹ thuật. Nếu build đúng từ đầu với parameterized queries + CDN-only banner + rate limit → hệ thống rất an toàn.

**Ưu tiên:** Fix HIGH trước khi có user thật. MEDIUM trước khi public launch.
