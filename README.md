# Hangul Pixel

Trang web đo chữ tiếng Hàn trong ảnh; JavaScript thuần, chạy OCR Tesseract.js 6.0.1 trên thiết bị. Không cần API key hoặc backend.

## Chạy trên Windows

Cài Python 3, mở terminal trong thư mục dự án:

    python -m http.server 8000 --directory dist

Mở http://localhost:8000. Cần mạng lần đầu để tải Tesseract, WebAssembly và mô hình tiếng Hàn. Không mở bằng file://. Ảnh không tải lên dịch vụ OCR.

## Sử dụng

Chọn/kéo nhiều ảnh, bấm Phân tích. Ảnh được xếp tự nhiên theo tên. Box hiển thị chiều cao trên ảnh gốc. Chọn tab ký tự hoặc dòng. Bấm hàng chiều cao để tô sáng và dùng mũi tên chuyển kết quả. Có CSV tổng hợp và JSON chi tiết. Kết quả tồn tại trong phiên trang; xuất trước khi đóng.

## Cách đo và giới hạn

Ảnh dài chia lát chồng lấn; OCR trên ảnh phóng lớn tối đa 4 lần. Tọa độ quy đổi lại về gốc. Bounding box thu gọn theo độ tương phản với nền ước lượng ở biên. Tọa độ x,y,w,h; cạnh cuối không bao gồm. Chữ nghiêng đo theo trục ảnh. Trùng lặp được lọc theo độ chồng lấn, có thể nhầm ký tự rất sát nhau.

Đây là bản đầu thử nghiệm. OCR có thể nhận nhầm tranh thành chữ Hàn với độ tin cậy cao, bỏ sót chữ hoặc phân đoạn sai. Ảnh 130 px bề ngang có chữ chỉ vài pixel nên kết quả không đủ tin cậy để coi là phép đo chính xác. Hãy dùng ảnh gốc độ phân giải cao và đối chiếu khung. Màu cam đánh dấu OCR thấp, chữ rất nhỏ, hình dạng bất thường hoặc vùng không thu gọn được. Màu xanh không bảo đảm chính xác. Bộ lọc OCR >=70 chỉ lọc độ tin cậy nhận dạng, không xác nhận độ tin cậy số đo. Không suy ra cỡ font Photoshop.

Bộ nhớ tăng theo số ảnh tải; OCR thực hiện tuần tự, có dừng sau lát hiện tại, ảnh hiển thị lazy loading và content-visibility. Không có lưu dự án hoặc chỉnh khung thủ công.

## Kiểm chứng

Đã kiểm tra cú pháp JavaScript, luồng tải ảnh mẫu và OCR thật trong Chrome. Chưa có bộ dữ liệu gán nhãn để đánh giá độ chính xác số đo.

## Bản v2
- Sao chép danh sách FileList trước khi reset ô chọn tệp, giữ toàn bộ ảnh trong lượt tải.
- Tìm nét trên ảnh gốc trong vùng mở rộng quanh khung OCR; giữ nét tương phản yếu liên thông với nét chính, không cộng cố định 1–3 px vào số đo.
- Đánh dấu cần kiểm tra khi nét chạm biên vùng tìm kiếm.
- Nhận diện kỹ dùng hai chế độ phân trang OCR 11/12 và gộp vùng trùng; có thể tắt để giảm thời gian.
- Bỏ ứng viên OCR dưới 35; ngưỡng này là bộ lọc thực nghiệm, không bảo đảm độ chính xác.
- Chưa hiệu chuẩn độ chính xác trên tập ảnh có nhãn. Chữ dính tranh, nét quá mờ hoặc ký tự bị tách sai vẫn cần kiểm tra.

## Bản v3
- Tải lần lượt từng tệp, hiển thị ngay và báo lỗi theo tên; nhận thêm tệp có MIME rỗng nhưng phần mở rộng hợp lệ. Khóa phân tích trong lúc tải.
- Hiển thị hàng đợi và tiến độ theo ảnh; tạo OCR worker riêng cho từng ảnh; lỗi một ảnh không ngăn ảnh sau.
- Bỏ content-visibility trên trang ảnh; bổ sung liên kết đến từng ảnh.
- Đọc lại các dòng phát hiện được trong vùng cắt riêng khi bật nhận diện kỹ. Không thể phục hồi vùng mà tất cả lượt OCR đều bỏ sót.
- Bộ lọc thực nghiệm dùng ngữ cảnh dòng, đồng thuận giữa lượt OCR, hình dạng và độ tin cậy. Mặc định ẩn kết quả cần kiểm tra, hiển thị số lượng và cho bật lại. Việc ẩn không chứng minh vùng đó không phải chữ.
- Kiểm tra: node --check dist/app.js; node tests/regression.cjs. Kiểm tra hồi quy dùng OCR giả lập để xác minh hàng đợi, không đo độ chính xác OCR.
- Kiểm thử chọn nhiều tệp qua trình duyệt chưa hoàn tất do công cụ trình duyệt bị timeout; chưa thể kết luận đã tái hiện và sửa đúng lỗi của người dùng.
