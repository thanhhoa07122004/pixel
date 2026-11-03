# Kiểm chứng Multi OCR

Đã chạy kiểm tra trên Linux, Python 3.11; chưa chạy trình cài Windows.

Hai vùng được cắt từ ảnh gốc người dùng cung cấp trong ZIP, giữ nguyên pixel:
- 001.jpg: vùng [500,3100,1100,3800), 600 × 700 px.
- 002.jpg: vùng [300,6000,1200,7000), 900 × 1000 px.

| Vùng | Công nghệ | Lượt thành công | Kết quả từng lượt (dòng + ký tự) |
|---|---|---:|---|
| real-crop.png | tesseract | 2/2 | 9, 11 |
| real-crop.png | easy | 2/2 | 2, 2 |
| real-crop.png | paddle | 2/2 | 2, 2 |
| real-crop-002.png | tesseract | 2/2 | 21, 19 |
| real-crop-002.png | easy | 2/2 | 5, 5 |
| real-crop-002.png | paddle | 2/2 | 5, 5 |

Số bản ghi không phải số ký tự đúng. Paddle/Easy chủ yếu trả dòng; Tesseract có thêm khung ký tự.

PaddleOCR nhận được “너넨” và “들어가봐” trong vùng 001; EasyOCR nhận được vùng tương ứng nhưng đọc khác chữ. Tesseract cũng có các biến thể. Kết quả mâu thuẫn được giữ, không đánh đồng mọi bộ đều đúng.

Các lượt trên ảnh tăng tương phản cũng chạy thật. Chưa kiểm chứng toàn bộ hai ảnh dài, chưa có tập nhãn để tính precision/recall hoặc sai số chiều cao.

9 kiểm tra thuật toán/hàng đợi đã qua: hồi phục nét mờ trên/dưới, không tính hai lượt cùng bộ thành hai công nghệ, lưu xung đột, không chia đều ký tự, phủ hết chiều dài ảnh, quét 3 bộ × 2 kiểu ảnh × mọi lát, tiếp tục từ cache, báo partial khi một bộ lỗi và vẫn chạy bộ khác. Kiểm tra hàng đợi dùng OCR giả lập.

Cấu hình Paddle đã chạy: paddlepaddle 3.0.0 + paddleocr 3.0.3 + paddlex 3.0.3. Phải khóa cả PaddleX; để pip tự lấy bản mới gây lỗi khởi tạo.

EasyOCR 1.7.2 chạy thực tế trong môi trường Torch CPU 2.15.0; bộ cài Windows khóa Torch 2.7.1/torchvision 0.22.1 để tương thích Python 3.10, tổ hợp Windows đó chưa được thử ở đây.

Giao diện mới đã qua kiểm tra cú pháp JavaScript và hồi quy logic tải nhiều tệp; chưa kiểm chứng thao tác giao diện end-to-end với backend Python bằng trình duyệt.
