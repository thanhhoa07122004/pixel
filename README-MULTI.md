# Hangul Pixel — quét nhiều công nghệ

Bản này giữ giao diện đọc ảnh theo chiều dọc, thêm backend Python chạy trên máy Windows.
Mỗi ảnh phải thử **Tesseract + PaddleOCR + EasyOCR**. Mỗi bộ đọc cả bản màu gốc và bản tăng tương phản CLAHE: **6 lượt cho mỗi lát ảnh**, các lát chồng nhau 192 px. Ảnh gốc không bị thu nhỏ; mọi tọa độ và số đo được đưa về ảnh gốc sau khi áp dụng hướng EXIF.

## Cài trên Windows

1. Cài **Python 3.10 64-bit**, bật Python Launcher (lệnh `py -3.10`).
2. Giải nén gói nguồn vào thư mục như `E:\HangulPixelMulti`.
3. Chạy `setup-multi.bat`. Script tạo ba môi trường riêng để tránh xung đột Paddle/Torch. Lần đầu tải thư viện và mô hình có thể lâu, cần mạng và vài GB trống. Script dùng CPU.
4. Cài Tesseract 5 theo trang dự án: https://tesseract-ocr.github.io/tessdoc/Installation.html . Chọn dữ liệu Korean. Nếu thiếu, lấy `kor.traineddata` từ https://github.com/tesseract-ocr/tessdata_fast/blob/main/kor.traineddata và đặt trong thư mục `tessdata` của Tesseract.
5. Nếu Tesseract không ở `C:\Program Files\Tesseract-OCR\tesseract.exe` và chưa có trong PATH, đặt biến `TESSERACT_CMD` thành đường dẫn của bạn.
6. Chạy `start-multi.bat`. Khi cửa sổ hiện địa chỉ, mở **http://127.0.0.1:8765**. Giữ cửa sổ chạy trong lúc xử lý.

Bản website được lưu trên mạng chỉ có chế độ Tesseract trong trình duyệt. **Ba bộ Python chạy trong bản tại địa chỉ localhost ở trên**, không thể chạy bằng việc đánh dấu một nút trên trang hosted.

## Sử dụng

- Tải nhiều JPG/PNG/WEBP; xếp theo tên tự nhiên.
- Chế độ “Quét nhiều công nghệ” tự bật khi backend cục bộ kết nối được.
- Bấm Phân tích. Ảnh xử lý theo hàng đợi, mỗi bộ OCR chạy lần lượt để hạn chế RAM. Một ảnh hoặc một bộ lỗi được báo riêng, không bị tính là thành công.
- Trạng thái ghi tên bộ, kiểu ảnh, lát đang xử lý và số lượt. Chỉ khi cả ba bộ hoàn tất mọi lát và hai kiểu ảnh mới ghi “Xong đủ 3 công nghệ”.
- Bấm khung để xem nguồn, các nội dung khác nhau và điểm OCR gốc của từng nguồn.
- Mặc định chuyển sang tab Dòng chữ và hiện kết quả cần kiểm tra để không làm người dùng tưởng vùng bị ẩn là chưa quét.
- Tab ký tự chỉ chứa khung ký tự thực do Tesseract xuất. Paddle/Easy trả vùng dòng; **không chia đều dòng thành ký tự**. Ký tự chưa được bộ thứ hai xác nhận phân đoạn luôn ghi cần kiểm tra.
- JSON chứa nguồn và trạng thái từng bộ. CSV tổng hợp theo bộ lọc hiện tại.

## Tiếp tục khi gián đoạn

Backend lưu ảnh và kết quả từng lượt trong `local-data/`. Khi khởi động lại, chọn lại cùng ảnh rồi Phân tích: chương trình dùng lại các lượt thành công và chạy phần còn thiếu. Không tự chạy lại lượt thành công chỉ vì một bộ khác bị lỗi.

Ảnh được giữ trên ổ đĩa máy bạn để tiếp tục, không gửi ảnh cho API OCR bên ngoài. Tải mô hình lần đầu vẫn cần kết nối máy chủ của các dự án OCR. Đóng backend rồi xóa `local-data/` nếu muốn xóa dữ liệu, buộc quét lại hoặc đã đổi phiên bản mô hình. Không mở thư mục này ra Internet.

## Cách gộp và đo

- Chỉ các công nghệ khác nhau mới được tính là nguồn độc lập. Hai ảnh tiền xử lý của Tesseract vẫn chỉ là một nguồn.
- Gộp theo giao nhau vùng và loại dòng/ký tự; giữ mọi nội dung khác nhau trong provenance.
- Nội dung giống nhau từ ít nhất hai bộ, cùng vùng và đo được nét, có thể vào nhóm không cần kiểm tra; đây là quy tắc thực nghiệm, **không phải xác suất chính xác đã hiệu chuẩn**.
- Không so sánh trực tiếp điểm tin cậy giữa các bộ, không tự tạo “độ tin cậy tổng hợp 99%”.
- Đo phần nét tương phản trên ảnh gốc, khung mở rộng chỉ để tìm nét. Không cộng cố định 1–3 px.
- Nét chạm biên, chữ nghiêng, nội dung xung đột hoặc chỉ một bộ nhận được đều giữ kết quả và đánh dấu.
- Nhiều OCR có thể cùng bỏ sót hoặc cùng nhận nhầm tranh; không có bảo đảm nhận đủ chữ hoặc đúng từng pixel.

## Kiểm tra và giới hạn

- `node --check dist/app.js`
- `node tests/regression.cjs`
- `.venv\Scripts\python.exe -m unittest discover -s tests -p "test_multi*.py" -v`
- Các kiểm tra thuật toán dùng hình tổng hợp để xác minh tọa độ/nét mờ, không đo độ chính xác trên tập dữ liệu có nhãn.
- Bản cài Windows chưa được chạy thử trên Windows trong môi trường này. Kết quả kiểm tra OCR thực tế ghi trong `VALIDATION-MULTI.md`.
- Ảnh dài có thể cần nhiều thời gian trên CPU: 3 công nghệ x 2 kiểu ảnh x số lát; đây không phải 6 lệnh cho cả tệp bất kể chiều dài. Không đóng cửa sổ backend khi đang chạy.

## Tham khảo chính thức

- EasyOCR: https://jaided.ai/easyocr/documentation/
- PaddleOCR 3.x: https://www.paddleocr.ai/v3.0.0/en/version3.x/pipeline_usage/OCR.html
- Tesseract: https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html
