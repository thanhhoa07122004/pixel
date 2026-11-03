# HƯỚNG DẪN DEPLOY LÊN VERCEL

## 1. Lưu ý quan trọng về Vercel và các mô hình AI

* **Vercel** là nền tảng máy chủ không trạng thái (Serverless) chuyên cho Frontend. Giới hạn của Vercel:
  * Bộ nhớ tối đa: 1GB RAM.
  * Giới hạn kích thước gói: 50MB (Free) - 250MB (Pro).
  * Thời gian chạy tối đa: 15 giây.
* **3 mô hình OCR trong dự án này (PaddleOCR + EasyOCR + Tesseract)**:
  * Nặng hơn **5GB** (PyTorch, PaddlePaddle, bộ dữ liệu font/model AI).
  * Cần tối thiểu **4GB RAM** và mất 30–60 giây để quét một trang truyện dài.
  * 👉 **Do đó, Vercel KHÔNG THỂ chạy được 3 mô hình Python backend.**

Tuy nhiên, **giao diện web (Frontend)** của dự án có sẵn chế độ **OCR tiếng Hàn trực tiếp trên trình duyệt (Tesseract.js WebAssembly)**, chế độ này chạy cực kỳ mượt mà trên Vercel mà không cần bất kỳ máy chủ nào!

---

## 2. Cách deploy trang web lên Vercel trong 2 phút

Đã có sẵn file cấu hình [vercel.json](file:///e:/hangul-pixel-multi-ocr/vercel.json).

### Cách A: Dùng Vercel CLI (Nhanh nhất)
1. Mở cửa sổ PowerShell hoặc CMD tại thư mục dự án này.
2. Gõ lệnh:
   ```bash
   npx vercel
   ```
3. Đăng nhập bằng tài khoản Vercel (GitHub/Email).
4. Nhấn **Enter** chấp nhận các cài đặt mặc định:
   * Set up and deploy? -> `Y`
   * Which scope? -> Chọn tài khoản của bạn
   * Link to existing project? -> `N`
   * Project name? -> Giữ nguyên hoặc đặt tên (ví dụ: `hangul-pixel-ocr`)
   * Directory located? -> `./`
5. Sau 30 giây, Vercel sẽ cấp cho bạn một đường link web chính thức dạng:
   `https://hangul-pixel-ocr.vercel.app`

### Cách B: Đẩy lên GitHub rồi import vào Vercel
1. Đẩy code lên GitHub repository của bạn.
2. Vào trang [vercel.com](https://vercel.com) -> Bấm **Add New Project**.
3. Chọn repository GitHub vừa tạo.
4. Ở phần **Build and Output Settings**, thư mục Output sẽ tự nhận diện là `dist`.
5. Bấm **Deploy**.

---

## 3. Nếu bạn muốn chạy ĐỦ 3 CÔNG NGHỆ (PaddleOCR + EasyOCR + Tesseract) trên Cloud MIỄN PHÍ

Nếu bạn cần sức mạnh của cả 3 mô hình AI trên nền tảng Cloud:
* Hãy dùng **Hugging Face Spaces** (miễn phí **16GB RAM**, hỗ trợ Docker):
  1. Tạo tài khoản tại [huggingface.co](https://huggingface.co).
  2. Tạo một **New Space**, chọn **Docker** (Blank).
  3. Tải các file trong dự án (bao gồm `Dockerfile` đã tạo sẵn) lên Space đó.
  4. Hệ thống sẽ tự động build và cấp cho bạn link web chạy đủ cả 3 mô hình AI 24/7!

