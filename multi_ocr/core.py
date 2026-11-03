"""Original-pixel measurement and cross-engine fusion. No calibrated probability is inferred."""
import hashlib
import json
import math
import re
import statistics
import uuid
from difflib import SequenceMatcher
from pathlib import Path

ENGINES = ('tesseract', 'paddle', 'easy')
VIEWS = ('original', 'contrast')
PIPELINE_VERSION = 'multi-1.0'


def korean(text):
    return any('\uac00' <= c <= '\ud7a3' or '\u1100' <= c <= '\u11ff' or '\u3130' <= c <= '\u318f' for c in text)


def normalized(text):
    return ''.join(c for c in text if c.isalnum())


def similarity(a, b):
    a, b = normalized(a), normalized(b)
    return SequenceMatcher(None, a, b).ratio() if a and b else 0


def iou(a, b):
    x = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    y = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    intersection = x*y
    return intersection / max(1, (a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection)


def tiles(width, height, tile_height=1280, overlap=192):
    if overlap >= tile_height:
        raise ValueError('Overlap must be smaller than tile height')
    top = 0
    while top < height:
        bottom = min(height, top+tile_height)
        yield (0, top, width, bottom)
        if bottom == height:
            break
        top += tile_height-overlap


def measure_ink(image, box):
    import cv2
    import numpy as np
    W, H = image.size
    x0, y0, x1, y1 = box
    pad = max(4, min(14, math.ceil((y1-y0)*.18)))
    x, y = max(0, math.floor(x0)-pad), max(0, math.floor(y0)-pad)
    right, bottom = min(W, math.ceil(x1)+pad), min(H, math.ceil(y1)+pad)
    if right <= x or bottom <= y:
        return None
    gray = np.asarray(image.crop((x, y, right, bottom)).convert('L'))
    edge = np.concatenate((gray[0], gray[-1], gray[:, 0], gray[:, -1]))
    bg = float(np.median(edge))
    delta = bg-gray.astype(float) if bg >= 128 else gray.astype(float)-bg
    weak = (delta >= 18).astype('uint8')
    n, labels, stats, _ = cv2.connectedComponentsWithStats(weak, 8)
    seed = np.zeros_like(weak, dtype=bool)
    sx0, sy0 = max(0, math.floor(x0)-x), max(0, math.floor(y0)-y)
    sx1, sy1 = min(right-x, math.ceil(x1)-x), min(bottom-y, math.ceil(y1)-y)
    seed[sy0:sy1, sx0:sx1] = True
    ids = set(int(v) for v in labels[seed & (delta >= 55)] if v)
    ids = [i for i in ids if stats[i, cv2.CC_STAT_AREA] >= 2]
    if not ids:
        return {'box': [max(0, math.floor(x0)), max(0, math.floor(y0)), min(W, math.ceil(x1)), min(H, math.ceil(y1))], 'refined': False, 'clipped': False}
    left = min(int(stats[i, 0]) for i in ids)
    top = min(int(stats[i, 1]) for i in ids)
    r = max(int(stats[i, 0]+stats[i, 2]) for i in ids)
    b = max(int(stats[i, 1]+stats[i, 3]) for i in ids)
    clipped = left == 0 or top == 0 or r == right-x or b == bottom-y
    return {'box': [x+left, y+top, x+r, y+b], 'refined': True, 'clipped': clipped}


def is_legitimate_candidate(observation):
    text = observation.get('text', '').strip()
    hangul = [c for c in text if '\uac00' <= c <= '\ud7a3']
    if not hangul:
        return False
    box = observation.get('box', [0, 0, 0, 0])
    w, h = box[2] - box[0], box[3] - box[1]
    if w < 10 or h < 10:
        return False
    if len(hangul) <= 2 and (w > 220 or h > 200):
        return False
    if observation.get('engine') == 'tesseract':
        noise = [c for c in text if c in '|.,\'"0-9-_~=/:;`^*+[]{}()<>']
        if len(noise) >= len(hangul) and len(hangul) <= 2:
            return False
    return True


def fuse(observations, image):
    """Same-engine passes never count as independent votes; retain all provenance."""
    groups = []
    # Prefer stable longer text first, avoid merging separate neighboring words into a line.
    for observation in sorted(observations, key=lambda r: -len(normalized(r['text']))):
        if not is_legitimate_candidate(observation):
            continue
        match = None
        best = 0
        for group in groups:
            anchor = group[0]
            if anchor.get('kind', 'line') != observation.get('kind', 'line'):
                continue
            score = iou(anchor['box'], observation['box'])
            if score >= .45 and score > best:
                best, match = score, group
        if match is None:
            groups.append([observation])
        else:
            match.append(observation)
    output = []
    for group in groups:
        kind = group[0].get('kind', 'line')
        seed = [statistics.median(r['box'][i] for r in group) for i in range(4)]
        measured = measure_ink(image, seed)
        if not measured:
            continue
        x0, y0, x1, y1 = measured['box']
        if y1-y0 < 2 or x1-x0 < 1:
            continue
        # Select text by independent-engine support, not by comparing incompatible confidence scales.
        representative = max(group, key=lambda a: len({b['engine'] for b in group if similarity(a['text'], b['text']) >= .75}))
        sources = sorted({r['engine'] for r in group})
        agreeing = sorted({r['engine'] for r in group if similarity(representative['text'], r['text']) >= .75})
        variants = sorted({r['text'].strip() for r in group})
        reasons = []
        if len(agreeing) < 2:
            reasons.append('Chỉ một công nghệ nhận diện hoặc chưa đồng thuận nội dung')
        if any(similarity(representative['text'], t) < .5 for t in variants):
            reasons.append('Nội dung OCR mâu thuẫn')
        if measured['clipped']:
            reasons.append('Nét chạm biên vùng đo, có thể dính tranh hoặc bị cắt')
        if not measured['refined']:
            reasons.append('Chưa xác định được nét trên ảnh gốc')
        if any(r.get('rotated') for r in group):
            reasons.append('Chữ nghiêng: đo theo trục ảnh, chưa hiệu chỉnh góc')
        if kind == 'symbol':
            reasons.append('Khung ký tự từ Tesseract, chưa có công nghệ thứ hai xác nhận phân đoạn')
        output.append({'id': hashlib.sha256(json.dumps([kind,seed,representative['text']]).encode()).hexdigest()[:24], 'kind': kind, 'text': representative['text'].strip(),
                       'x': x0, 'y': y0, 'w': x1-x0, 'h': y1-y0,
                       'refined': measured['refined'], 'clipped': measured['clipped'],
                       'confidence': None, 'review': bool(reasons), 'reviewReasons': reasons,
                       'engines': sources, 'agreeingEngines': agreeing, 'variants': variants,
                       'sources': group, 'method': 'original_pixels_axis_aligned'})
    return sorted(output, key=lambda r: (r['y'], r['x'], r['kind']))


def prepare(image, view):
    import cv2
    import numpy as np
    if view == 'original':
        return image.convert('RGB')
    from PIL import Image
    gray = np.asarray(image.convert('L'))
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    return Image.fromarray(gray).convert('RGB')


def atomic_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    temporary.replace(path)
