"""Pre-download OCR models and resources so they are cached locally on disk.
Once downloaded to the user's cache, subsequent OCR runs will never need to download them again.
"""
import sys
import numpy as np

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def preload_easy():
    print("=== [1/2] Đang tải mô hình EasyOCR (Korean + English) ===")
    print("CRAFT detection model (~85MB) + Korean recognition model...")
    import easyocr
    reader = easyocr.Reader(['ko', 'en'], gpu=False)
    dummy = np.full((64, 128, 3), 255, dtype=np.uint8)
    reader.readtext(dummy)
    print(">>> EasyOCR đã hoàn tất tải và lưu vào bộ nhớ đệm!\n")

def preload_paddle():
    print("=== [2/2] Đang tải mô hình & font PaddleOCR (Korean PP-OCRv3) ===")
    print("Detection model + Korean recognition model + font files...")
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(lang='korean', ocr_version='PP-OCRv3', device='cpu',
                    use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False)
    dummy = np.full((64, 128, 3), 255, dtype=np.uint8)
    ocr.predict(dummy)
    print(">>> PaddleOCR đã hoàn tất tải và lưu vào bộ nhớ đệm!\n")

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if target == 'easy':
        preload_easy()
    elif target == 'paddle':
        preload_paddle()
    else:
        try:
            preload_easy()
        except Exception as e:
            print(f"Lỗi khi tải EasyOCR: {e}")
        try:
            preload_paddle()
        except Exception as e:
            print(f"Lỗi khi tải PaddleOCR: {e}")
