"""One long-lived isolated OCR process. JSON lines in/out; library logs go to stderr."""
import contextlib
import importlib.metadata
import json
import os
import shutil
import sys
import traceback

engine = sys.argv[1]
protocol = sys.stdout
model = None


def load():
    global model
    if model is not None:
        return
    if engine == 'easy':
        import easyocr
        model = easyocr.Reader(['ko', 'en'], gpu=False)
    elif engine == 'paddle':
        from paddleocr import PaddleOCR
        model = PaddleOCR(lang='korean', ocr_version='PP-OCRv3', device='cpu', use_doc_orientation_classify=False,
                          use_doc_unwarping=False, use_textline_orientation=False)
    elif engine == 'tesseract':
        import pytesseract
        command = os.environ.get('TESSERACT_CMD') or shutil.which('tesseract')
        if not command and os.name == 'nt':
            candidate = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            if os.path.isfile(candidate):
                command = candidate
        if not command:
            raise RuntimeError('Chưa cài Tesseract hoặc chưa đặt TESSERACT_CMD')
        pytesseract.pytesseract.tesseract_cmd = command
        if 'kor' not in pytesseract.get_languages(config=''):
            raise RuntimeError('Tesseract chưa có mô hình kor.traineddata')
        model = pytesseract
    else:
        raise ValueError(engine)


def bounds(points):
    return [float(min(p[0] for p in points)), float(min(p[1] for p in points)),
            float(max(p[0] for p in points)), float(max(p[1] for p in points))]


def run(path, view):
    load()
    rows = []
    if engine == 'easy':
        for polygon, text, score in model.readtext(path, detail=1, paragraph=False, canvas_size=1600,
                                                   mag_ratio=1.0, min_size=10, text_threshold=.6, low_text=.4):
            p = [[float(x), float(y)] for x, y in polygon]
            rows.append({'text': text, 'box': bounds(p), 'polygon': p, 'confidence': float(score),
                         'rotated': abs(p[1][1]-p[0][1]) > 3, 'kind': 'line'})
    elif engine == 'paddle':
        for result in model.predict(path):
            # PaddleOCR 3.x OCRResult is dict-like, arrays retain original input coordinates.
            texts, scores = result['rec_texts'], result['rec_scores']
            polygons = result['rec_polys']
            for text, score, polygon in zip(texts, scores, polygons):
                p = [[float(x), float(y)] for x, y in polygon]
                rows.append({'text': text, 'box': bounds(p), 'polygon': p, 'confidence': float(score),
                             'rotated': abs(p[1][1]-p[0][1]) > 3, 'kind': 'line'})
    else:
        from PIL import Image
        im = Image.open(path)
        psm = 11
        config = f'--oem 1 --psm {psm}'
        data = model.image_to_data(im, lang='kor', config=config, output_type=model.Output.DICT, timeout=120)
        groups = {}
        for i, text in enumerate(data['text']):
            txt = text.strip()
            if not txt:
                continue
            conf = float(data['conf'][i])
            if conf < 25 and len(txt) <= 2:
                continue
            key = (data['block_num'][i], data['par_num'][i], data['line_num'][i])
            x, y, w, h = (int(data[k][i]) for k in ('left', 'top', 'width', 'height'))
            groups.setdefault(key, []).append((txt, [x, y, x+w, y+h], conf/100))
        for group in groups.values():
            rows.append({'text': ' '.join(g[0] for g in group),
                         'box': [min(g[1][0] for g in group), min(g[1][1] for g in group),
                                 max(g[1][2] for g in group), max(g[1][3] for g in group)],
                         'confidence': sum(g[2] for g in group)/len(group), 'kind': 'line'})
        # Actual OCR character boxes; never divide a line into equal-width fake characters.
        for line in model.image_to_boxes(im, lang='kor', config=config, timeout=120).splitlines():
            pieces = line.split()
            if len(pieces) < 5:
                continue
            text, left, bottom, right, top = pieces[:5]
            if len(text) == 1 and '\uac00' <= text <= '\ud7a3':
                w = int(right) - int(left)
                h = int(top) - int(bottom)
                if 10 <= w <= 180 and 10 <= h <= 180:
                    rows.append({'text': text, 'box': [int(left), im.height-int(top), int(right), im.height-int(bottom)],
                                 'confidence': None, 'kind': 'symbol'})
    return rows


for line in sys.stdin:
    try:
        request = json.loads(line)
        with contextlib.redirect_stdout(sys.stderr):
            rows = run(request['path'], request['view'])
        package = {'easy': 'easyocr', 'paddle': 'paddleocr', 'tesseract': 'pytesseract'}[engine]
        version = importlib.metadata.version(package)
        response = {'ok': True, 'rows': rows, 'version': version}
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        response = {'ok': False, 'error': str(error)}
    protocol.write(json.dumps(response, ensure_ascii=False)+'\n')
    protocol.flush()
