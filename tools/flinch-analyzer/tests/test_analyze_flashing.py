import json, sys, tempfile, unittest
from pathlib import Path
import cv2, numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analyze_flashing import analyze_video, main
class AnalyzerTests(unittest.TestCase):
 def setUp(self): self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
 def tearDown(self): self.tmp.cleanup()
 def video(self,name,levels,fps=30):
  p=self.root/f'{name}.mp4'; w=cv2.VideoWriter(str(p),cv2.VideoWriter_fourcc(*'mp4v'),fps,(32,32))
  if not w.isOpened(): self.skipTest('OpenCV mp4v encoder unavailable')
  for level in levels: w.write(np.full((32,32,3),level,dtype=np.uint8))
  w.release(); return p
 def segments_video(self,name,segments,texture=False):
  p=self.root/f'{name}.mp4'; w=cv2.VideoWriter(str(p),cv2.VideoWriter_fourcc(*'mp4v'),30,(32,32))
  if not w.isOpened(): self.skipTest('OpenCV mp4v encoder unavailable')
  yy,xx=np.indices((32,32)); pattern=np.where((xx//4+yy//4)%2==0,-24,24)
  for level,duration in segments:
   gray=np.clip(level+pattern,0,255).astype(np.uint8) if texture else np.full((32,32),level,dtype=np.uint8)
   frame=np.stack([gray]*3,axis=2)
   for _ in range(round(duration*30)): w.write(frame)
  w.release(); return p
 def test_static_empty(self):
  r=analyze_video(self.video('static',[80]*90)); self.assertEqual(r['cues'],[]); self.assertEqual(r['schemaVersion'],1)
 def test_repeated_exact_transitions(self):
  levels=[80]*30+[240]*6+[10]*6+[240]*6+[10]*6+[240]*6+[80]*30
  r=analyze_video(self.video('repeat',levels),sample_fps=30,threshold=.2,min_duration=.2,repetition_min=3)
  c=next(c for c in r['cues'] if c['type']=='candidate_flashing_pattern')
  self.assertEqual(c['evidence']['transitionTimesSeconds'],[1.,1.2,1.4,1.6,1.8,2.])
  self.assertEqual((c['startSeconds'],c['endSeconds']),(.967,2.))
 def test_min_duration_filters_short_repeated_burst(self):
  levels=[80]*30+[240]*2+[10]*2+[240]*2+[80]*54
  path=self.video('short-burst',levels)
  filtered=analyze_video(path,sample_fps=15,repetition_min=3,min_duration=.2)
  unfiltered=analyze_video(path,sample_fps=15,repetition_min=3,min_duration=0)
  # A too-short repeated burst should not produce a pattern or separate transition cues.
  self.assertEqual(filtered['cues'],[])
  self.assertTrue(any(c['type']=='candidate_flashing_pattern' for c in unfiltered['cues']))
 def test_single_transition(self):
  r=analyze_video(self.video('single',[20]*30+[230]*30),sample_fps=30)
  c=next(c for c in r['cues'] if c['type']=='candidate_brightness_change')
  self.assertEqual(c['evidence']['transitionTimesSeconds'],[1.])
 def test_repeated_scene_cuts_can_be_misclassified_as_flashing(self):
  path=self.segments_video('repeated-cuts',[(60,2),(220,.5),(60,.5),(220,.5),(60,.5),(220,.5),(80,3)],texture=True)
  result=analyze_video(path)
  self.assertTrue(any(c['type']=='candidate_flashing_pattern' for c in result['cues']))
 def test_low_amplitude_alternation_is_still_reported(self):
  path=self.segments_video('low-amplitude',[(80,2)]+[(v,.5) for v in [140,84]*4]+[(80,2)])
  result=analyze_video(path)
  cue=next(c for c in result['cues'] if c['type']=='candidate_flashing_pattern')
  self.assertGreaterEqual(cue['evidence']['directionReversals'],2)
 def test_scene_cut_before_flashing_widens_candidate_interval(self):
  path=self.segments_video('adjacent-cut',[(80,1.5),(220,.5),(30,.5),(220,.5),(30,.5),(220,.5),(30,.5),(80,4)])
  result=analyze_video(path)
  cue=next(c for c in result['cues'] if c['type']=='candidate_flashing_pattern')
  # The preceding cut is grouped into the candidate; this captures the known timing limitation.
  self.assertLess(cue['startSeconds'],2.0)
  self.assertEqual(cue['endSeconds'],4.0)
 def test_gradual_change(self): self.assertEqual(analyze_video(self.video('gradual',np.linspace(40,220,120).astype(int).tolist()),sample_fps=30)['cues'],[])
 def test_short_boundary(self):
  r=analyze_video(self.video('short',[10]*3+[240]*3),sample_fps=15)
  self.assertEqual(r['analysis']['durationSeconds'],.2)
  self.assertTrue(all(0<=c['startSeconds']<c['endSeconds']<=.2 for c in r['cues']))
 def test_invalid_missing_and_exit(self):
  with self.assertRaises(FileNotFoundError): analyze_video(self.root/'absent.mp4')
  self.assertEqual(main([str(self.root/'absent.mp4')]),2)
 def test_json(self):
  d=json.loads(json.dumps(analyze_video(self.video('json',[50]*30)),sort_keys=True,allow_nan=False))
  self.assertEqual(set(d),{'schemaVersion','source','analysis','cues'}); self.assertEqual(d['source'],'automated_screening')
if __name__=='__main__': unittest.main()
