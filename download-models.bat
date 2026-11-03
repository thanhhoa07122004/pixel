@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   TAI TRUOC MO HINH OCR (EASYOCR va PADDLEOCR)
echo ===================================================
echo.
echo [1/2] Dang tai mo hinh cho EasyOCR (khoang 150MB)...
if exist ".venv-easy\Scripts\python.exe" (
    ".venv-easy\Scripts\python.exe" multi_ocr\preload_models.py easy
) else (
    echo [LOI] Chua tim thay moi truong .venv-easy. Hay chay setup-multi.bat truoc!
)

echo.
echo [2/2] Dang tai mo hinh va font cho PaddleOCR (khoang 100MB)...
if exist ".venv-paddle\Scripts\python.exe" (
    ".venv-paddle\Scripts\python.exe" multi_ocr\preload_models.py paddle
) else (
    echo [LOI] Chua tim thay moi truong .venv-paddle. Hay chay setup-multi.bat truoc!
)

echo.
echo ===================================================
echo HOAN TAT! Toan bo model da duoc luu san tren may.
echo Cac lan chay sau se khong bao gio phai tai lai nua.
echo ===================================================
pause
