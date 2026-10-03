#!/usr/bin/env python3
"""The female coach voice, made from Nico's own takes.

WORLD (pyworld) splits each piece into its pitch, its spectral envelope (the
shape of the throat: the formants) and its breathiness. A female voice is
not just a higher pitch (that is the chipmunk): it is a higher pitch AND
formants moved up a little, because the vocal tract is shorter. So the pitch
is multiplied by PITCH and the envelope stretched by FORMANT, then the voice
is rebuilt and finished like the male pieces (same loudness, fades, mp3).

Needs pyworld, soundfile, numpy (not in the system Python):
  python3 -m venv .venv && .venv/bin/pip install pyworld soundfile numpy
  .venv/bin/python tools/build-voice-female.py [--pitch 1.75 --formant 1.17 --out audio/voice-f]
"""
import argparse, json, os, re, subprocess, tempfile
import numpy as np, pyworld as pw, soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--pitch', type=float, default=1.75)
ap.add_argument('--formant', type=float, default=1.17)
ap.add_argument('--out', default='audio/voice-f')
ap.add_argument('--only', default='')            # comma list of keys, for quick samples
args = ap.parse_args()

cuts = json.load(open(os.path.join(ROOT, 'tools/voice-cuts.json')))
OUT = os.path.join(ROOT, args.out); os.makedirs(OUT, exist_ok=True)
FS = 44100

def warp(env, alpha):
    """stretch a spectral envelope up the frequency axis by alpha"""
    n = env.shape[1]; src = np.arange(n) / alpha
    lo = np.clip(np.floor(src).astype(int), 0, n - 1); hi = np.clip(lo + 1, 0, n - 1); fr = src - np.floor(src)
    return np.ascontiguousarray(env[:, lo] * (1 - fr) + env[:, hi] * fr)

def female(x):
    f0, t = pw.harvest(x, FS, f0_floor=60, f0_ceil=420, frame_period=5)
    sp = pw.cheaptrick(x, f0, t, FS); apr = pw.d4c(x, f0, t, FS)
    y = pw.synthesize(np.ascontiguousarray(f0 * args.pitch), warp(sp, args.formant), warp(apr, args.formant), FS, 5)
    return y / max(1e-6, np.max(np.abs(y))) * 0.8

def mean_db(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.search(r'mean_volume: (-?[\d.]+)', r).group(1))

keys = args.only.split(',') if args.only else list(cuts['pieces'])
tmp = tempfile.mkdtemp()
for key in keys:
    c = cuts['pieces'][key]
    src = os.path.join(ROOT, 'audio/voice-src', cuts['sources'][c['src']])
    a, b = max(0, c['a'] - 0.06), c['b'] + 0.12
    raw = os.path.join(tmp, 'raw.wav'); fem = os.path.join(tmp, 'fem.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(a), '-to', str(b), '-i', src, '-af', 'highpass=f=80,afftdn=nf=-45', '-ac', '1', '-ar', str(FS), raw], check=True)
    x, _ = sf.read(raw); sf.write(fem, female(x.astype(np.float64)), FS)
    gain = -18.0 - mean_db(fem); dur = b - a
    af = f"volume={gain:.2f}dB,alimiter=limit=0.89:level=false,afade=t=in:d=0.008,afade=t=out:st={dur - 0.04:.3f}:d=0.04"
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', fem, '-af', af, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', os.path.join(OUT, f'{key}.mp3')], check=True)
print(len(keys), 'female pieces ->', args.out)
