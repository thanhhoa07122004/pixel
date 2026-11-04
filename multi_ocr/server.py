"""Loopback-only local server. One queued image at a time; engine processes isolated."""
import hashlib
import importlib.util
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
import urllib.parse
import uuid
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from PIL import Image, ImageOps
from core import ENGINES, VIEWS, PIPELINE_VERSION, atomic_json, fuse, prepare, tiles

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get('HANGUL_DATA_DIR', ROOT/'local-data')).resolve()
DATA.mkdir(parents=True, exist_ok=True)
Image.MAX_IMAGE_PIXELS = 180_000_000
JOBS = {}
LOCK = threading.RLock()
POOL = ThreadPoolExecutor(max_workers=1)
TOKEN = uuid.uuid4().hex
HOST = os.environ.get('HANGUL_HOST', '127.0.0.1')
PORT = int(os.environ.get('PORT') or os.environ.get('HANGUL_PORT') or '8765')


def executable(engine):
    variable = {'paddle': 'HANGUL_PADDLE_PYTHON', 'easy': 'HANGUL_EASY_PYTHON', 'tesseract': 'HANGUL_TESSERACT_PYTHON'}[engine]
    if os.environ.get(variable):
        return os.environ[variable]
    folder = {'paddle': '.venv-paddle', 'easy': '.venv-easy', 'tesseract': '.venv'}[engine]
    python = ROOT/folder/('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    return str(python) if python.exists() else sys.executable


def capabilities():
    available = []
    for engine in ENGINES:
        package = {'paddle': 'paddleocr', 'easy': 'easyocr', 'tesseract': 'pytesseract'}[engine]
        try:
            probe = subprocess.run([executable(engine), '-c',
                                    'import importlib.util;print(bool(importlib.util.find_spec('+repr(package)+')))'],
                                   capture_output=True, text=True, timeout=15)
            found = probe.returncode == 0 and probe.stdout.strip() == 'True'
        except Exception:
            found = False
        available.append({'engine': engine, 'installed': found,
                          'note': 'Thư viện có sẵn; mô hình được kiểm tra khi chạy' if found else 'Chưa cài thư viện'})
    return {'mode': 'local-multi', 'engines': available, 'views': list(VIEWS), 'pipeline': PIPELINE_VERSION, 'token': TOKEN}


class Engine:
    def __init__(self, engine, folder):
        self.engine = engine
        self.log = open(folder/(engine+'.log'), 'a', encoding='utf-8')
        cpu_threads = str(max(2, min(8, os.cpu_count() or 4)))
        font_candidate = None
        for candidate in [
            r'C:\Windows\Fonts\malgun.ttf',
            r'C:\Windows\Fonts\arial.ttf',
            '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
            '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        ]:
            if os.path.isfile(candidate):
                font_candidate = candidate
                break
        paddlex_cache = str(DATA / '.paddlex')
        Path(paddlex_cache).mkdir(parents=True, exist_ok=True)
        env = dict(os.environ, PYTHONIOENCODING='utf-8', OMP_NUM_THREADS=cpu_threads, MKL_NUM_THREADS=cpu_threads,
                   PADDLE_PDX_CACHE_HOME=paddlex_cache)
        if font_candidate:
            env['PADDLE_PDX_LOCAL_FONT_FILE_PATH'] = font_candidate
        self.process = subprocess.Popen([executable(engine), str(ROOT/'multi_ocr/engine_worker.py'), engine],
                                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.log,
                                        text=True, encoding='utf-8', env=env)
        self.responses = queue.Queue()
        def read():
            for line in self.process.stdout:
                try:
                    self.responses.put(json.loads(line))
                except json.JSONDecodeError:
                    self.log.write(line)
            self.responses.put({'ok': False, 'error': 'Tiến trình OCR đã dừng; xem log'})
        threading.Thread(target=read, daemon=True).start()

    def recognize(self, path, view):
        self.process.stdin.write(json.dumps({'path': str(path), 'view': view})+'\n')
        self.process.stdin.flush()
        try:
            response = self.responses.get(timeout=300)
        except queue.Empty:
            raise TimeoutError('Quá 300 giây cho một lượt OCR; lượt này chưa hoàn tất')
        if not response['ok']:
            raise RuntimeError(response['error'])
        return response

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        self.log.close()


def update(job, **fields):
    with LOCK:
        job.update(fields, updated=time.time())
        atomic_json(DATA/job['id']/'job.json', job)


def run_job(job):
    folder = DATA/job['id']
    observations = []
    selected = job['requestedEngines']
    job_views = job.get('requestedViews') or list(VIEWS)
    reports = {engine: {'engine': engine, 'state': 'pending', 'passesCompleted': 0, 'passesTotal': 0,
                        'errors': [], 'versions': []} for engine in selected}
    try:
        with Image.open(folder/'input') as raw:
            image = ImageOps.exif_transpose(raw).convert('RGB')
        W, H = image.size
        grid = list(tiles(W, H))
        for report in reports.values():
            report['passesTotal'] = len(grid)*len(job_views)
        total = len(grid)*len(job_views)*len(selected)
        update(job, state='running', width=W, height=H, totalPasses=total, completedPasses=0,
               engineReports=list(reports.values()), results=[], message='Đang khởi tạo OCR')
        done = 0
        for engine in selected:
            report = reports[engine]
            process = None
            report['state'] = 'running'
            try:
                for index, tile in enumerate(grid):
                    if job.get('cancel'):
                        break
                    original = image.crop(tile)
                    for view in job_views:
                        if job.get('cancel'):
                            break
                        key = f'{engine}-{index}-{view}'
                        cache = folder/(key+'.json')
                        update(job, message=f'{engine} · {view} · lát {index+1}/{len(grid)}', engineReports=list(reports.values()))
                        if cache.exists():
                            response = json.loads(cache.read_text(encoding='utf-8'))
                        else:
                            if process is None:
                                process = Engine(engine, folder)
                            input_path = folder/(key+'.png')
                            prepare(original, view).save(input_path)
                            try:
                                response = process.recognize(input_path, view)
                            finally:
                                input_path.unlink(missing_ok=True)
                            atomic_json(cache, response)
                        if response['version'] not in report['versions']:
                            report['versions'].append(response['version'])
                        for row in response['rows']:
                            row = dict(row)
                            x0, y0, x1, y1 = row['box']
                            row['box'] = [x0+tile[0], y0+tile[1], x1+tile[0], y1+tile[1]]
                            row.update(engine=engine, view=view, tile=index, engineVersion=response['version'])
                            observations.append(row)
                        report['passesCompleted'] += 1
                        done += 1
                        # Lightweight progress update; skip heavy O(N) ink measurement on every single slice
                        update(job, completedPasses=done, engineReports=list(reports.values()))
                report['state'] = 'cancelled' if job.get('cancel') else 'complete'
            except Exception as error:
                report['state'] = 'error'
                report['errors'].append(str(error))
            finally:
                if process:
                    process.close()
                update(job, engineReports=list(reports.values()), results=fuse(observations, image))
            if job.get('cancel'):
                break
        complete = [engine for engine, report in reports.items() if report['state'] == 'complete']
        state = 'cancelled' if job.get('cancel') else 'complete' if len(complete) == len(selected) else 'partial'
        update(job, state=state, results=fuse(observations, image), message=f'{len(complete)}/{len(selected)} công nghệ hoàn tất',
               observations=observations, engineReports=list(reports.values()))
    except Exception as error:
        update(job, state='error', message=str(error), engineReports=list(reports.values()))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT/'dist'), **kwargs)

    def json(self, data, code=200):
        content = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def allowed(self):
        # Cho phép mọi Host nếu HANGUL_ALLOW_ALL_HOSTS=1 (dành cho deploy qua Internet/LAN/Tunnel)
        if os.environ.get('HANGUL_ALLOW_ALL_HOSTS', '0') == '1':
            return True
        host = self.headers.get('Host', '')
        return host in ('127.0.0.1:8765', 'localhost:8765', f'{HOST}:{PORT}', f'127.0.0.1:{PORT}', f'localhost:{PORT}')

    def do_GET(self):
        if not self.allowed():
            return self.json({'error': 'Host không hợp lệ'}, 403)
        path = urllib.parse.urlsplit(self.path).path
        if path == '/api/health':
            return self.json(capabilities())
        if path.startswith('/api/jobs/'):
            identity = path.removeprefix('/api/jobs/')
            with LOCK:
                job = JOBS.get(identity)
                if not job:
                    return self.json({'error': 'Không tìm thấy tác vụ'}, 404)
                # Do not resend every raw observation on every poll; final export still includes provenance per result.
                response = {k: v for k, v in job.items() if k not in ('observations', 'cancel', 'digest')}
                return self.json(response)
        if path.startswith('/api/'):
            return self.json({'error': 'Không có endpoint này'}, 404)
        return super().do_GET()

    def do_POST(self):
        if not self.allowed() or self.headers.get('X-Hangul-Token') != TOKEN:
            return self.json({'error': 'Phiên cục bộ không hợp lệ; tải lại trang'}, 403)
        parsed = urllib.parse.urlsplit(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if parsed.path.endswith('/cancel'):
            identity = parsed.path.split('/')[-2]
            job = JOBS.get(identity)
            if not job:
                return self.json({'error': 'Không tìm thấy tác vụ'}, 404)
            update(job, cancel=True, message='Dừng sau lượt OCR hiện tại')
            return self.json({'ok': True})
        if parsed.path != '/api/jobs':
            return self.json({'error': 'Không có endpoint này'}, 404)
        try:
            size = int(self.headers.get('Content-Length', 0))
            if size <= 0 or size > 200*1024*1024:
                return self.json({'error': 'Ảnh phải nhỏ hơn 200 MiB'}, 413)
            selected = params.get('engines', [','.join(ENGINES)])[0].split(',')
            if len(set(selected)) < 2 or not set(selected).issubset(ENGINES):
                return self.json({'error': 'Chọn ít nhất hai công nghệ khác nhau'}, 400)
            req_views = params.get('views', [','.join(VIEWS)])[0].split(',')
            valid_views = [v for v in req_views if v in VIEWS] or list(VIEWS)
            name = Path(params.get('name', ['image'])[0].replace('\\', '/')).name
            identity = uuid.uuid4().hex
            folder = DATA/identity
            folder.mkdir()
            digest = hashlib.sha256(PIPELINE_VERSION.encode()+','.join(sorted(selected)).encode()+','.join(sorted(valid_views)).encode())
            remaining = size
            self.connection.settimeout(120)
            with open(folder/'input', 'wb') as out:
                while remaining:
                    data = self.rfile.read(min(1024*1024, remaining))
                    if not data:
                        raise ValueError('Tải tệp bị gián đoạn')
                    digest.update(data)
                    out.write(data)
                    remaining -= len(data)
            with Image.open(folder/'input') as im:
                im.verify()
            # A retry for identical input resumes saved successful passes from its existing job.
            value = digest.hexdigest()
            with LOCK:
                existing = next((j for j in JOBS.values() if j.get('digest') == value), None)
                if existing:
                    (folder/'input').unlink()
                    folder.rmdir()
                    if existing['state'] not in ('running', 'queued', 'complete'):
                        update(existing, state='queued', cancel=False)
                        POOL.submit(run_job, existing)
                    return self.json({'id': existing['id']})
                job = {'id': identity, 'name': name, 'digest': value, 'state': 'queued', 'results': [],
                       'message': 'Đang chờ', 'requestedEngines': selected, 'requestedViews': valid_views,
                       'engineReports': [], 'pipeline': PIPELINE_VERSION,
                       'coordinateSystem': 'EXIF-oriented original pixels; no resampling', 'created': time.time()}
                JOBS[identity] = job
                update(job)
            POOL.submit(run_job, job)
            return self.json({'id': identity}, 202)
        except Exception as error:
            return self.json({'error': str(error)}, 400)


if __name__ == '__main__':
    for path in DATA.glob('*/job.json'):
        try:
            job = json.loads(path.read_text(encoding='utf-8'))
            if job['state'] in ('running', 'queued'):
                job.update(state='interrupted', cancel=False, message='Bị gián đoạn; tải lại cùng ảnh để tiếp tục')
            JOBS[job['id']] = job
        except (ValueError, KeyError):
            pass
    print(f'Hangul Pixel Multi OCR: http://{HOST}:{PORT}', flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
