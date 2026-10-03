#!/usr/bin/env python3
"""Build Nico's coach voice: cut the Voice Memos takes in audio/voice-src
into one small mp3 per piece (audio/voice/<key>.mp3) plus audio/voice/index.json.

The cut points live in tools/voice-cuts.json (source file, start, end per key),
found once by silence detection and checked by transcribing every piece.
Each piece: high-pass, light denoise, the same loudness (-18 dB mean),
a limiter, short fades, a little air at both ends, mono 64 kbps mp3.

Run from the repo root:  python3 tools/build-voice.py
"""
import json, os, re, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'audio/voice-src'), os.path.join(ROOT, 'audio/voice')
cuts = json.load(open(os.path.join(ROOT, 'tools/voice-cuts.json')))
os.makedirs(OUT, exist_ok=True)
CHAIN = 'highpass=f=80,afftdn=nf=-45'

def mean_db(path, a, b):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-ss', str(a), '-to', str(b), '-i', path,
                        '-af', CHAIN + ',volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.search(r'mean_volume: (-?[\d.]+)', r).group(1))

index = {}
for key, c in cuts['pieces'].items():
    src = os.path.join(SRC, cuts['sources'][c['src']])
    a, b = max(0, c['a'] - 0.06), c['b'] + 0.12
    gain = -18.0 - mean_db(src, c['a'], c['b'])
    dur = b - a
    af = f"{CHAIN},volume={gain:.2f}dB,alimiter=limit=0.89:level=false,afade=t=in:d=0.008,afade=t=out:st={dur - 0.04:.3f}:d=0.04"
    out = os.path.join(OUT, f'{key}.mp3')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(a), '-to', str(b), '-i', src, '-af', af,
                    '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', out], check=True)
    index[key] = c['text']
json.dump({'pieces': index}, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)
print(len(index), 'pieces built')
