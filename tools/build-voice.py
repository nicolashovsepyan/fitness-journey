#!/usr/bin/env python3
"""Build Nico's coach voice: cut the Voice Memos takes in audio/voice-src
into one small mp3 per piece (audio/voice/<key>.mp3) plus audio/voice/index.json.

The cut points live in tools/voice-cuts.json (source file, start, end per key),
found once by silence detection and checked by transcribing every piece.
Each piece: high-pass, light denoise, the same loudness (-18 dB mean),
a limiter, short fades, a little air at both ends, mono 64 kbps mp3.

Run from the repo root:  python3 tools/build-voice.py
"""
import argparse, json, os, re, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--clean', default=os.path.join(ROOT, 'audio/voice-src/clean'))   # echo-reduced takes (tools/dereverb.py), used when there
ap.add_argument('--out', default=os.path.join(ROOT, 'audio/voice'))
ap.add_argument('--only', default='')
args = ap.parse_args()
SRC, OUT = os.path.join(ROOT, 'audio/voice-src'), args.out
cuts = json.load(open(os.path.join(ROOT, 'tools/voice-cuts.json')))
os.makedirs(OUT, exist_ok=True)
CHAIN = 'highpass=f=80,afftdn=nf=-45'
# a downward expander: what is left of the room after each word sinks further
TAIL = 'agate=threshold=0.025:ratio=3:range=0.12:attack=4:release=70'

def mean_db(path, a, b):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-ss', str(a), '-to', str(b), '-i', path,
                        '-af', CHAIN + ',volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.search(r'mean_volume: (-?[\d.]+)', r).group(1))

index = {}
for key, c in cuts['pieces'].items():
    if args.only and key not in args.only.split(','): continue
    name = cuts['sources'][c['src']]
    clean = os.path.join(args.clean, os.path.splitext(name)[0] + '.wav')
    src = clean if os.path.exists(clean) else os.path.join(SRC, name)
    a, b = max(0, c['a'] - 0.06), c['b'] + 0.09
    gain = -18.0 - mean_db(src, c['a'], c['b'])
    dur = b - a
    af = f"{CHAIN},{TAIL},volume={gain:.2f}dB,alimiter=limit=0.89:level=false,afade=t=in:d=0.008,afade=t=out:st={dur - 0.04:.3f}:d=0.04"
    out = os.path.join(OUT, f'{key}.mp3')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(a), '-to', str(b), '-i', src, '-af', af,
                    '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', out], check=True)
    index[key] = c['text']
json.dump({'pieces': index}, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)
print(len(index), 'pieces built')
