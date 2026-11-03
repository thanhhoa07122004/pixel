import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'multi_ocr'))
import core
import numpy as np
from PIL import Image

class MultiTests(unittest.TestCase):
    def setUp(self):
        a = np.full((50, 100), 255, dtype='uint8')
        a[15:35, 20:60] = 0
        a[13:15, 20:60] = 215
        a[35:37, 20:60] = 215
        self.image = Image.fromarray(a)
    def test_measure_recovers_both_faint_edges(self):
        r=core.measure_ink(self.image,[20,15,60,35])
        self.assertEqual(r['box'],[20,13,60,37])
        self.assertFalse(r['clipped'])
    def test_passes_of_one_engine_are_not_independent(self):
        obs=[{'engine':'tesseract','view':v,'text':'안녕','box':[20,15,60,35]} for v in core.VIEWS]
        rows=core.fuse(obs,self.image)
        self.assertEqual(len(rows),1)
        self.assertTrue(rows[0]['review'])
        self.assertEqual(rows[0]['agreeingEngines'],['tesseract'])
    def test_two_independent_engines_agree(self):
        obs=[{'engine':e,'text':'안녕','box':[20,15,60,35]} for e in ['easy','paddle']]
        r=core.fuse(obs,self.image)[0]
        self.assertFalse(r['review'])
        self.assertEqual(r['confidence'],None)
        self.assertEqual(r['h'],24)
        self.assertEqual(len(r['sources']),2)
    def test_conflict_preserved(self):
        obs=[{'engine':e,'text':t,'box':[20,15,60,35]} for e,t in [('easy','안녕'),('paddle','학교')]]
        r=core.fuse(obs,self.image)[0]
        self.assertTrue(r['review'])
        self.assertEqual(set(r['variants']),{'안녕','학교'})
    def test_character_never_claims_independent_confirmation(self):
        r=core.fuse([{'engine':'tesseract','text':'한','box':[20,15,60,35],'kind':'symbol'}],self.image)[0]
        self.assertTrue(r['review'])
    def test_long_image_tiles_cover_every_row(self):
        for height in [1,1280,1281,22656,34087]:
            spans=list(core.tiles(1440,height))
            self.assertEqual(spans[0][1],0)
            self.assertEqual(spans[-1][3],height)
            for a,b in zip(spans,spans[1:]):self.assertLessEqual(b[1],a[3])
    def test_small_letter_does_not_get_line_height(self):
        obs=[{'engine':'easy','text':'한글','box':[20,15,60,35],'kind':'line'},
             {'engine':'tesseract','text':'한','box':[20,15,40,35],'kind':'symbol'}]
        self.assertEqual(len(core.fuse(obs,self.image)),2)

if __name__=='__main__':unittest.main()
