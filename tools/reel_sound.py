#!/usr/bin/env python3
"""Bande-son originale du reel TikTok (marketing/reel-genz.html, exporté 1,4 × plus lent) : beat, whoosh sur
les transitions, impacts, clics des taps, pièces sur « +690 gold »… Tout est synthétisé ici (aucune musique
protégée). Sortie : WAV 44,1 kHz stéréo, puis tools/mux.swift l'ajoute à la vidéo.
Usage : python3 tools/reel_sound.py sortie.wav [durée en s = 17.64]
"""
import math
import random
import struct
import sys
import wave

SR = 44100
SLOW = 1.4                      # même ralenti que l'export des images
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 17.64
N = int(DUR * SR)
buf = [0.0] * N
rnd = random.Random(7)


def add(t, samples, gain=1.0):
    i0 = int(t * SR)
    for k, v in enumerate(samples):
        i = i0 + k
        if 0 <= i < N:
            buf[i] += v * gain


def env(n, attack, decay):
    a = max(1, int(attack * SR))
    return [min(1.0, k / a) * math.exp(-k / (decay * SR)) for k in range(n)]


def kick(dur=0.35, f0=120, f1=45):
    n = int(dur * SR); out = []; ph = 0.0
    for k in range(n):
        f = f1 + (f0 - f1) * math.exp(-k / (0.04 * SR))
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-k / (0.12 * SR)))
    return out


def hat(dur=0.05):
    n = int(dur * SR); prev = 0.0; out = []
    for k in range(n):
        x = rnd.uniform(-1, 1); out.append((x - prev) * math.exp(-k / (0.012 * SR))); prev = x
    return out


def whoosh(dur=0.45):
    # bruit filtré dont le filtre s'ouvre puis se referme : souffle qui arrive sur la coupe
    n = int(dur * SR); y = 0.0; out = []
    for k in range(n):
        p = k / n
        c = 0.02 + 0.5 * math.sin(math.pi * p) ** 2
        y += c * (rnd.uniform(-1, 1) - y)
        out.append(y * math.sin(math.pi * p) ** 1.5)
    return out


def boom(dur=0.9):
    s = kick(dur, 90, 32)
    for k in range(min(len(s), int(0.08 * SR))):
        s[k] += rnd.uniform(-1, 1) * 0.5 * math.exp(-k / (0.02 * SR))
    return s


def tone(freq, dur, decay, attack=0.002):
    n = int(dur * SR); e = env(n, attack, decay)
    return [math.sin(2 * math.pi * freq * k / SR) * e[k] for k in range(n)]


def click():
    return [a + b for a, b in zip(tone(1800, 0.04, 0.008), tone(3600, 0.04, 0.005))]


def coin():
    out = [0.0] * int(0.5 * SR)
    for j, f in enumerate((1318.5, 1760, 2637)):
        for k, v in enumerate(tone(f, 0.35, 0.12)):
            i = k + int(j * 0.06 * SR)
            if i < len(out): out[i] += v * 0.6
    return out


def sparkle():
    out = [0.0] * int(0.9 * SR)
    for j in range(7):
        f = 2000 + rnd.random() * 2500
        for k, v in enumerate(tone(f, 0.4, 0.15)):
            i = k + int(j * 0.05 * SR)
            if i < len(out): out[i] += v * 0.3
    return out


def bass(freq, dur):
    n = int(dur * SR); e = env(n, 0.01, dur * 0.6)
    return [(math.sin(2 * math.pi * freq * k / SR) + 0.3 * math.sin(4 * math.pi * freq * k / SR)) * e[k] for k in range(n)]


T = lambda base: base * SLOW  # temps de l'animation → temps de la vidéo

# Beat : 96 BPM, coups de grosse caisse, charleston sur les contretemps, basse ; plus calme pendant le hook.
beat = 60 / 96
t = 0.0; i = 0
notes = [55, 55, 65.4, 49]
while t < DUR - 0.3:
    if t >= T(1.3) or i % 2 == 0:
        add(t, kick(), 0.8)
    add(t + beat / 2, hat(), 0.25)
    if t >= T(1.3) and i % 2 == 0:
        add(t, bass(notes[(i // 2) % 4], beat * 1.8), 0.35)
    t += beat; i += 1

# Transitions (flash blanc) : whoosh qui finit pile sur la coupe
for s in (1.3, 2.3, 4.6, 6.2, 7.9, 9.8):
    add(T(s) - 0.4, whoosh(), 0.55)

add(T(0.6), boom(0.5), 0.6)                   # l'écran tremble (hook)
add(T(1.45), boom(), 0.9)                     # logo
for s in (2.75, 3.15, 3.5):                   # taps du prono
    add(T(s), click(), 0.5)
add(T(3.9), coin(), 0.7)                      # +690 gold
for j in range(3):                            # actus qui arrivent
    add(T(4.8 + j * 0.22), tone(1200 + j * 200, 0.08, 0.02), 0.35)
for j in range(3):                            # cartes
    add(T(6.35 + j * 0.15) - 0.05, whoosh(0.18), 0.4)
for j in range(8):                            # rangs qui défilent (de plus en plus aigu)
    add(T(7.9 + j * 0.16), tone(330 * 2 ** (j / 6), 0.12, 0.04), 0.4)
add(T(7.9 + 8 * 0.16), sparkle(), 0.8)        # Radiant
add(T(9.9), boom(1.1), 1.0)                   # 3 décembre
add(T(10.6), boom(0.6), 0.6)                  # lien en bio

# Normalisation douce + fondu de fin
peak = max(abs(v) for v in buf) or 1
fade = int(0.6 * SR)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    frames = bytearray()
    for k, v in enumerate(buf):
        x = math.tanh(1.2 * v / peak) * 0.9
        if k > N - fade:
            x *= (N - k) / fade
        s = int(x * 32767)
        frames += struct.pack('<hh', s, s)
    w.writeframes(bytes(frames))
print('ok', DUR, 's')
