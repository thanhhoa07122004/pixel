@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
 echo ========================================================
 echo [LOI] Chua cai dat moi truong!
 echo Vui long nhap dup file setup-multi.bat truoc de cai dat.
 echo ========================================================
 pause
 exit /b 1
)

echo ========================================================
echo   HANGUL PIXEL MULTI OCR - DANG KHOI CHAY TRANG WEB...
echo ========================================================
echo.
echo [1] Dang mo trinh duyet toi dia chi: http://127.0.0.1:8765
echo [2] May chu backend dang khoi dong...
echo.
echo De dung ung dung, ban chi can dong cua so nay.
echo ========================================================
echo.

start "" "http://127.0.0.1:8765"
".venv\Scripts\python.exe" multi_ocr\server.py
pause
