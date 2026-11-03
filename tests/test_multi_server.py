import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'multi_ocr'))
import server
from core import ENGINES

class FakeEngine:
    calls=[]
    failed=None
    def __init__(self,engine,folder):self.engine=engine
    def recognize(self,path,view):
        self.calls.append((self.engine,view))
        if self.engine==self.failed:raise RuntimeError('Simulated engine failure')
        return {'ok':True,'version':'test-only','rows':[{'text':'안녕','box':[20,20,60,40],'kind':'line','confidence':.9}]}
    def close(self):pass

class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.patches=[patch.object(server,'DATA',self.root),patch.object(server,'Engine',FakeEngine)]
        for p in self.patches:p.start()
        FakeEngine.calls=[];FakeEngine.failed=None
        folder=self.root/'case';folder.mkdir()
        Image.new('RGB',(100,1400),'white').save(folder/'input',format='PNG')
        self.job={'id':'case','name':'sample.png','requestedEngines':list(ENGINES),'state':'queued','results':[]}
    def tearDown(self):
        for p in self.patches:p.stop()
        self.temp.cleanup()
    def test_three_engines_two_views_every_tile(self):
        server.run_job(self.job)
        self.assertEqual(self.job['state'],'complete')
        self.assertEqual(self.job['completedPasses'],12)
        self.assertEqual(len(FakeEngine.calls),12)
        self.assertTrue(all(r['state']=='complete' for r in self.job['engineReports']))
        FakeEngine.calls=[]
        server.run_job(self.job)
        self.assertEqual(FakeEngine.calls,[])
        self.assertEqual(self.job['state'],'complete')
    def test_failure_is_partial_and_other_engines_continue(self):
        FakeEngine.failed='paddle'
        server.run_job(self.job)
        self.assertEqual(self.job['state'],'partial')
        states={r['engine']:r['state'] for r in self.job['engineReports']}
        self.assertEqual(states,{'tesseract':'complete','paddle':'error','easy':'complete'})
        self.assertTrue(any(e=='easy' for e,v in FakeEngine.calls))

if __name__=='__main__':unittest.main()
