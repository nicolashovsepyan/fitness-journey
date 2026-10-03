#!/usr/bin/env python3
"""Take the room out of Nico's Voice Memos takes (the echo).

Two passes, chosen by measuring how fast each word dies away (210 ms raw):
  1. DeepFilterNet: a trained speech-cleanup model; mostly removes the
     background noise (alone: 200 ms).
  2. Late-reverb spectral suppression (Lebart): the echo at any moment is
     predicted from the sound 50 ms earlier and the room's decay time
     (--t60), and that part is turned down, never below --floor.
     Together: 160 ms (medium, t60 0.9 / floor 0.06) or 150 ms (strong,
     t60 1.3 / floor 0.04). WPE was tried first and barely moved it.
tools/build-voice.py then adds a gentle gate on what is left after each word.

Writes audio/voice-src/clean/<take>.wav, which build-voice.py and
build-voice-female.py use when present.

  .venv/bin/pip install deepfilternet torch torchaudio scipy soundfile numpy
  .venv/bin/python tools/dereverb.py [--t60 0.9 --floor 0.06]
"""
import argparse, json, os, subprocess, tempfile
import numpy as np, soundfile as sf
from scipy.signal import stft, istft
from df.enhance import enhance, init_df, load_audio

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--t60', type=float, default=0.9)
ap.add_argument('--floor', type=float, default=0.06)
args = ap.parse_args()
SRC = os.path.join(ROOT, 'audio/voice-src'); OUT = os.path.join(SRC, 'clean'); os.makedirs(OUT, exist_ok=True)
cuts = json.load(open(os.path.join(ROOT, 'tools/voice-cuts.json')))
model, st, _ = init_df()
FS, NPER, HOP, D = 48000, 1024, 256, 0.05

def late_reverb_out(x):
    _, _, X = stft(x, FS, nperseg=NPER, noverlap=NPER - HOP)
    P = np.abs(X) ** 2; Ps = P.copy()
    for i in range(1, P.shape[1]): Ps[:, i] = 0.6 * Ps[:, i - 1] + 0.4 * P[:, i]
    nd = int(D * FS / HOP); rho = 3 * np.log(10) / args.t60
    late = np.zeros_like(P); late[:, nd:] = np.exp(-2 * rho * D) * Ps[:, :-nd]
    G = np.maximum(1 - late / (Ps + 1e-12), args.floor ** 2) ** 0.5
    for i in range(1, G.shape[1]): G[:, i] = 0.7 * G[:, i] + 0.3 * G[:, i - 1]   # no warble
    _, y = istft(X * G, FS, nperseg=NPER, noverlap=NPER - HOP)
    return y[:len(x)]

for name in sorted(set(cuts['sources'].values())):
    tmp = os.path.join(tempfile.mkdtemp(), 'in.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(SRC, name), '-ac', '1', '-ar', str(FS), tmp], check=True)
    audio, _ = load_audio(tmp, sr=st.sr())
    x = enhance(model, st, audio).squeeze().numpy().astype(np.float64)
    y = late_reverb_out(x)
    sf.write(os.path.join(OUT, os.path.splitext(name)[0] + '.wav'), y / max(1e-6, np.max(np.abs(y))) * 0.9, FS)
    print('clean:', name)
