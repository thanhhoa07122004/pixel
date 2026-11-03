# HƯỚNG DẪN SỬ DỤNG VÀ DEPLOY HANGUL PIXEL MULTI OCR

Dự án này là một web application hoàn chỉnh gồm giao diện web (HTML/JS/CSS) và backend xử lý OCR bằng 3 mô hình (Tesseract, PaddleOCR, EasyOCR).

Tùy theo nhu cầu của bạn, có 3 cách sử dụng/deploy:

---

## CÁCH 1: Dùng trực tiếp trên máy tính như 1 web app (Khuyến nghị - Nhanh & Mượt nhất)

Bạn không cần tốn tiền thuê server vì máy tính của bạn đã có sẵn 16 luồng CPU cực mạnh để phân tích OCR.

1. Nhấp đúp vào file **`Chay-Web.bat`** (hoặc [start-multi.bat](file:///e:/hangul-pixel-multi-ocr/start-multi.bat)).
2. Trình duyệt mặc định (Chrome/Edge/Cốc Cốc) sẽ **tự động mở trang web** tại:
   `http://127.0.0.1:8765`
3. Kéo thả ảnh truyện tranh/webtoon vào để đo chữ tiếng Hàn như bình thường!
4. Khi không dùng nữa: Chỉ cần đóng cửa sổ màu đen (Command Prompt).

---

## CÁCH 2: Chia sẻ link web ra ngoài Internet (Dùng trên điện thoại hoặc gửi cho bạn bè)

Nếu bạn muốn mở trang web này từ điện thoại hoặc cho người khác truy cập mà không cần thuê máy chủ:

### Cách dùng Cloudflare Tunnel (Miễn phí 100%, bảo mật, có HTTPS):
1. Tải công cụ **`cloudflared`** từ Cloudflare:
   https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
2. Đổi tên file tải về thành `cloudflared.exe` và để vào thư mục dự án này.
3. Chạy `Chay-Web.bat` để bật server.
4. Mở thêm 1 cửa sổ PowerShell/CMD và gõ:
   ```powershell
   .\cloudflared.exe tunnel --url http://127.0.0.1:8765
   ```
5. Cloudflare sẽ tạo cho bạn 1 đường link dạng:
   `https://xxxx-xxxx.trycloudflare.com`
   -> Bạn có thể mở link này trên điện thoại hoặc gửi cho bất kỳ ai để dùng như 1 trang web bình thường!

---

## CÁCH 3: Deploy lên máy chủ Cloud / VPS (Docker)

Nếu bạn muốn trang web chạy 24/7 trên mạng mà không cần bật máy tính:

> **Lưu ý cấu hình VPS:** Vì chạy 3 mô hình AI cùng lúc, máy chủ VPS cần tối thiểu **4GB RAM** (khuyến nghị 8GB RAM trở lên).

1. Đã có sẵn file [Dockerfile](file:///e:/hangul-pixel-multi-ocr/Dockerfile) và [docker-compose.yml](file:///e:/hangul-pixel-multi-ocr/docker-compose.yml).
2. Tải toàn bộ mã nguồn lên VPS (Ubuntu/Debian).
3. Chạy lệnh:
   ```bash
   docker compose up -d --build
   ```
4. Mở cổng `8765` trên VPS hoặc trỏ Nginx Reverse Proxy qua tên miền của bạn (ví dụ `https://hangul-ocr.yourdomain.com`).

