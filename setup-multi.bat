@echo off
setlocal
cd /d "%~dp0"
py -3.10 --version >nul 2>&1
if errorlevel 1 (
 echo Can cai Python 3.10 64-bit, kem Python Launcher.
 pause
 exit /b 1
)
for %%E in (base easy paddle) do (
 call :install %%E
 if errorlevel 1 goto failed
)
echo Da cai thu vien.
echo Dang tien hanh tai truoc mo hinh OCR de cac lan sau khong phai tai lai...
call "%~dp0download-models.bat"
echo.
echo Tesseract can duoc cai rieng, co goi ngon ngu Korean.
echo Xem README-MULTI.md de tai kor.traineddata va kiem tra.
pause
exit /b 0
:install
set "ocr_env=.venv-%1"
if "%1"=="base" set "ocr_env=.venv"
if not exist "%ocr_env%\Scripts\python.exe" py -3.10 -m venv "%ocr_env%"
if errorlevel 1 exit /b 1
"%ocr_env%\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 exit /b 1
"%ocr_env%\Scripts\python.exe" -m pip install -r "multi_ocr\requirements-%1.txt"
exit /b %errorlevel%
:failed
echo Cai dat chua hoan tat. Giu lai loi tren man hinh de kiem tra.
pause
exit /b 1
