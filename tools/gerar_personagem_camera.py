"""Sobrevivente renderizado em 3D (SDF + raymarching) para uma câmera aérea inclinada.

O personagem é modelado em 3D com formas simples e renderizado com câmera
inclinada (~55° para baixo), então o ângulo do corpo muda de verdade conforme
a direção do movimento: de costas ao subir, de frente ao descer, de perfil
para os lados e 3/4 nas diagonais.

Saídas (na mesma pasta do script):
  camera_spritesheet.png  -> 8 direções (linhas) x 8 quadros (colunas), 128x128
  camera_andando.gif      -> cena no clima da referência, andando em todas as direções
  camera_direcoes.png     -> folha de apresentação das 8 direções
"""
import math
import os
import random
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
CELL = 128
SS = 2
RES = CELL * SS
FRAMES = 8
PITCH = math.radians(55)          # inclinação da câmera (0 = horizontal, 90 = de cima)
VIEW = 2.0                        # largura do mundo visível no quadro (metros)
LOOK_AT = np.array([0.0, 0.62, 0.0])

# direções na tela: 0 = sobe (costas), sentido horário
DIR_NAMES = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"]

# --- cores (linear-ish 0..1)
C = {
    "jacket": (0.24, 0.26, 0.17), "jacket_d": (0.17, 0.19, 0.12),
    "vest": (0.20, 0.19, 0.16), "strap": (0.12, 0.10, 0.08),
    "pants": (0.27, 0.24, 0.19), "boot": (0.10, 0.085, 0.075),
    "skin": (0.58, 0.44, 0.36), "beanie": (0.13, 0.14, 0.16),
    "pack": (0.36, 0.29, 0.19), "roll": (0.25, 0.30, 0.33),
    "gun": (0.09, 0.095, 0.10), "wood": (0.36, 0.22, 0.12),
}
MATS = list(C.keys())
MAT_COL = np.array([C[k] for k in MATS])


# ---------------------------------------------------------------- matemática
def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def frame_from_axis(a, b):
    """Rotação cujo eixo local Z aponta de a para b."""
    z = b - a
    z = z / (np.linalg.norm(z) + 1e-9)
    up = np.array([0, 1.0, 0]) if abs(z[1]) < 0.95 else np.array([1.0, 0, 0])
    x = np.cross(up, z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    return np.stack([x, y, z], axis=1)  # colunas = eixos locais


# ---------------------------------------------------------------- primitivas SDF
def sd_capsule(p, a, b, r):
    pa, ba = p - a, b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return np.linalg.norm(pa - h[:, None] * ba, axis=1) - r


def sd_ellipsoid(p, c, R, r):
    q = (p - c) @ R
    k0 = np.linalg.norm(q / r, axis=1)
    k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1.0) / (k1 + 1e-9)


def sd_box(p, c, R, b, rr):
    q = np.abs((p - c) @ R) - b
    return (np.linalg.norm(np.maximum(q, 0), axis=1)
            + np.minimum(q.max(axis=1), 0) - rr)


class Prim:
    def __init__(self, kind, mat, **kw):
        self.kind, self.mat, self.kw = kind, MATS.index(mat), kw

    def dist(self, p):
        k = self.kw
        if self.kind == "cap":
            return sd_capsule(p, k["a"], k["b"], k["r"])
        if self.kind == "ell":
            return sd_ellipsoid(p, k["c"], k["R"], np.asarray(k["r"]))
        return sd_box(p, k["c"], k["R"], np.asarray(k["b"]), k["rr"])

    def transformed(self, M):
        kw = dict(self.kw)
        for key in ("a", "b", "c"):
            if key in kw and not (key == "b" and self.kind == "box"):
                kw[key] = M @ kw[key]
        if "R" in kw:
            kw["R"] = M @ kw["R"]
        p = Prim.__new__(Prim)
        p.kind, p.mat, p.kw = self.kind, self.mat, kw
        return p


V = lambda *a: np.array(a, dtype=float)
I3 = np.eye(3)


# ---------------------------------------------------------------- personagem
def build_character(phase):
    """Lista de primitivas em coordenadas locais (x direita, y cima, z frente)."""
    s = math.sin(phase)
    bob = 0.025 * math.cos(2 * phase)          # mais baixo no apoio
    twist = math.radians(7) * s                # ombros giram contra a passada
    lean = math.radians(5)                     # leve inclinação pra frente (arma em punho)
    prims = []

    hip_y = 0.86 + bob
    L1, L2 = 0.43, 0.42
    for side, sgn in ((1, 1), (-1, -1)):       # 1 = perna direita
        a = math.radians(30) * s * sgn         # ângulo da coxa (frente +)
        swing = math.cos(phase) * sgn          # >0 = perna indo pra frente (no ar)
        bend = math.radians(8 + 48 * max(0.0, swing))
        hip = V(0.105 * side, hip_y, 0.0)
        knee = hip + L1 * V(0, -math.cos(a), math.sin(a))
        b2 = a - bend
        foot = knee + L2 * V(0, -math.cos(b2), math.sin(b2))
        prims.append(Prim("cap", "pants", a=hip, b=knee, r=0.075))
        prims.append(Prim("cap", "pants", a=knee, b=foot, r=0.062))
        toe = 0.25 * max(0.0, swing)           # bota aponta pra cima ao subir o pé
        Rb = rot_x(-toe)
        prims.append(Prim("box", "boot", c=foot + V(0, -0.015, 0.05), R=Rb,
                          b=V(0.045, 0.035, 0.105), rr=0.025))

    # pelve
    prims.append(Prim("ell", "pants", c=V(0, hip_y + 0.04, 0), R=I3, r=V(0.17, 0.11, 0.12)))
    prims.append(Prim("box", "strap", c=V(0, hip_y + 0.11, 0), R=I3, b=V(0.15, 0.025, 0.10), rr=0.02))

    # --- parte de cima (gira com twist, inclina com lean)
    up = []
    ty = hip_y + 0.12
    up.append(Prim("ell", "jacket", c=V(0, ty + 0.28, 0), R=I3, r=V(0.20, 0.30, 0.13)))
    up.append(Prim("ell", "jacket", c=V(0, ty + 0.44, 0), R=I3, r=V(0.25, 0.10, 0.13)))
    up.append(Prim("box", "vest", c=V(0, ty + 0.28, 0.035), R=I3, b=V(0.15, 0.17, 0.10), rr=0.03))
    for side in (1, -1):
        up.append(Prim("box", "strap", c=V(0.09 * side, ty + 0.30, 0.0), R=I3,
                       b=V(0.022, 0.22, 0.135), rr=0.01))
    # mochila + saco de dormir
    up.append(Prim("box", "pack", c=V(0, ty + 0.26, -0.21), R=I3, b=V(0.15, 0.19, 0.08), rr=0.04))
    up.append(Prim("box", "pack", c=V(0, ty + 0.14, -0.28), R=I3, b=V(0.11, 0.07, 0.04), rr=0.025))
    up.append(Prim("cap", "roll", a=V(-0.17, ty + 0.50, -0.20), b=V(0.17, ty + 0.50, -0.20), r=0.065))
    # pescoço + cabeça + gorro
    hy = ty + 0.64
    up.append(Prim("cap", "skin", a=V(0, ty + 0.48, 0), b=V(0, hy - 0.05, 0.01), r=0.055))
    up.append(Prim("ell", "skin", c=V(0, hy, 0.015), R=I3, r=V(0.095, 0.115, 0.105)))
    up.append(Prim("ell", "beanie", c=V(0, hy + 0.045, -0.005), R=I3, r=V(0.103, 0.095, 0.108)))

    # arma (rifle à frente, cano levemente para baixo)
    gun_dir = np.array([-0.06, -0.10, 1.0])
    gun_dir /= np.linalg.norm(gun_dir)
    stock = V(0.14, ty + 0.36, -0.02)
    muzzle = stock + 0.78 * gun_dir
    Rg = frame_from_axis(stock, muzzle)
    mid = lambda t: stock + t * (muzzle - stock)
    up.append(Prim("box", "wood", c=mid(0.12), R=Rg, b=V(0.022, 0.045, 0.09), rr=0.01))
    up.append(Prim("box", "gun", c=mid(0.45), R=Rg, b=V(0.022, 0.035, 0.18), rr=0.008))
    up.append(Prim("box", "gun", c=mid(0.40) + Rg @ V(0, -0.07, 0), R=Rg, b=V(0.016, 0.05, 0.03), rr=0.006))
    up.append(Prim("cap", "gun", a=mid(0.62), b=muzzle, r=0.013))
    up.append(Prim("box", "wood", c=mid(0.68), R=Rg, b=V(0.026, 0.028, 0.07), rr=0.01))

    grip_r = mid(0.30) + Rg @ V(0, -0.03, 0)
    grip_l = mid(0.66) + Rg @ V(0, -0.035, 0)
    for side, hand in ((1, grip_r), (-1, grip_l)):
        sh = V(0.22 * side, ty + 0.44, 0.0)
        elbow = (sh + hand) / 2 + V(0.10 * side, -0.13, -0.05 if side > 0 else 0.0)
        up.append(Prim("ell", "jacket", c=sh, R=I3, r=V(0.08, 0.08, 0.085)))
        up.append(Prim("cap", "jacket", a=sh, b=elbow, r=0.058))
        up.append(Prim("cap", "jacket_d", a=elbow, b=hand, r=0.05))
        up.append(Prim("ell", "skin", c=hand, R=I3, r=V(0.042, 0.042, 0.05)))

    pivot = V(0, hip_y, 0)
    M = rot_y(twist) @ rot_x(lean)
    for p in up:
        q = p.transformed(M)
        for key in ("a", "b", "c"):
            if key in q.kw and not (key == "b" and q.kind == "box"):
                # aplica rotação em torno do quadril
                q.kw[key] = M @ (p.kw[key] - pivot) + pivot
        prims.append(q)
    return prims


def place(prims, yaw):
    """Gira o personagem inteiro para a direção do movimento."""
    M = rot_y(yaw)
    return [p.transformed(M) for p in prims]


# ---------------------------------------------------------------- render
def scene(p, prims, want_mat=False):
    ds = np.stack([pr.dist(p) for pr in prims], axis=0)
    d = ds.min(axis=0)
    if want_mat:
        return d, np.array([prims[i].mat for i in ds.argmin(axis=0)])
    return d


def camera():
    f = np.array([0, -math.sin(PITCH), math.cos(PITCH)])     # olha para +z e para baixo
    r = np.array([1.0, 0, 0])
    u = np.cross(r, f) * -1
    u = np.array([0, math.cos(PITCH), math.sin(PITCH)])
    return f, r, u


def hash_noise(p, scale):
    q = np.floor(p * scale)
    h = np.sin(q @ np.array([12.9898, 78.233, 37.719])) * 43758.5453
    return h - np.floor(h)


def render(phase, yaw):
    prims_local = build_character(phase)
    prims = place(prims_local, yaw)
    f, r, u = camera()
    xs = (np.arange(RES) + 0.5) / RES - 0.5
    gx, gy = np.meshgrid(xs * VIEW, -xs * VIEW)
    origin = LOOK_AT + gx.reshape(-1, 1) * r + gy.reshape(-1, 1) * u - 4.0 * f
    n = origin.shape[0]
    t = np.zeros(n)
    hit = np.zeros(n, bool)
    active = np.ones(n, bool)
    for _ in range(90):
        idx = np.nonzero(active)[0]
        if idx.size == 0:
            break
        p = origin[idx] + t[idx, None] * f
        d = scene(p, prims)
        t[idx] += d
        h = d < 1e-3
        hit[idx[h]] = True
        gone = (t[idx] > 8) | (p[:, 1] < -0.05)
        active[idx[h | gone]] = False

    rgba = np.zeros((n, 4))
    idx = np.nonzero(hit)[0]
    if idx.size:
        p = origin[idx] + t[idx, None] * f
        _, mat = scene(p, prims, want_mat=True)
        e = 1.5e-3
        ks = [V(1, -1, -1), V(-1, -1, 1), V(-1, 1, -1), V(1, 1, 1)]
        nrm = sum(k[None, :] * scene(p + e * k, prims)[:, None] for k in ks)
        nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9

        base = MAT_COL[mat]
        # textura "suja" presa ao corpo (coordenadas locais, não escorrega)
        pl = p @ rot_y(yaw)  # volta para o espaço do personagem
        grit = 0.78 + 0.22 * hash_noise(pl, 60) + 0.12 * hash_noise(pl, 16)
        base = base * grit[:, None]

        key_dir = np.array([-0.45, 0.8, -0.35]); key_dir /= np.linalg.norm(key_dir)
        rim_dir = np.array([0.6, 0.3, 0.75]); rim_dir /= np.linalg.norm(rim_dir)
        key = np.clip(nrm @ key_dir, 0, 1)[:, None] * np.array([1.05, 0.97, 0.85])
        rim = np.clip(nrm @ rim_dir, 0, 1)[:, None] ** 2 * np.array([0.30, 0.48, 0.65])
        amb = (0.5 + 0.5 * nrm[:, 1])[:, None] * np.array([0.30, 0.38, 0.48])
        # oclusão aproximada: escurece perto do chão e entre as partes
        ao = np.clip(0.55 + p[:, 1] * 0.45, 0.55, 1.0)[:, None]
        occ = np.clip(scene(p + 0.06 * nrm, prims) / 0.06, 0.35, 1.0)[:, None]
        col = base * (key * 1.0 + amb) * ao * occ + base * rim * 1.3
        lum = col @ np.array([0.3, 0.59, 0.11])
        col = col * 0.8 + lum[:, None] * 0.2
        # brilho especular leve (couro/metal)
        hv = key_dir - f; hv /= np.linalg.norm(hv)
        spec = np.clip(nrm @ hv, 0, 1) ** 24
        shiny = np.isin(mat, [MATS.index("gun"), MATS.index("boot")]) * 0.35 + 0.05
        col += (spec * shiny)[:, None]
        col = np.clip(col, 0, 1) ** (1 / 1.25)
        rgba[idx, :3] = col
        rgba[idx, 3] = 1.0

    img = rgba.reshape(RES, RES, 4)
    # sombra no chão (projeção da luz sobre y=0), por baixo do personagem
    shadow = np.zeros((RES, RES))
    gp = LOOK_AT + gx[..., None] * r + gy[..., None] * u - 4.0 * f
    tg = gp[..., 1] / math.sin(PITCH)
    ground = gp + tg[..., None] * f
    ld = np.array([-0.10, 1.0, -0.30])
    flat = ground.reshape(-1, 3)
    # raio da sombra = marcha curta em direção à luz
    sd = np.full(flat.shape[0], 9.0)
    for k in np.linspace(0.05, 1.8, 14):
        sd = np.minimum(sd, scene(flat + k * ld / np.linalg.norm(ld), prims) / (0.12 * k))
    shadow = (1 - np.clip(sd, 0, 1)).reshape(RES, RES) * 0.45
    shadow = np.maximum(shadow, np.exp(-((ground[..., 0] / 0.32) ** 2 + (ground[..., 2] / 0.32) ** 2)) * 0.45)

    out = np.zeros_like(img)
    a_sh = shadow * (1 - img[..., 3])
    out[..., 3] = img[..., 3] + a_sh
    out[..., :3] = img[..., :3] * img[..., 3:4]  # pré-multiplicado (sombra é preta)
    # reduz 2x (média em pré-multiplicado)
    out = out.reshape(CELL, SS, CELL, SS, 4).mean(axis=(1, 3))
    a = out[..., 3:4]
    rgb = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0)
    res = np.concatenate([rgb, a], axis=2)
    return Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8), "RGBA")


def screen_dir_to_yaw(i):
    """Direção na tela -> yaw do personagem no mundo.

    Para cima na tela = +z no mundo (afastando da câmera)."""
    ang = math.radians(45 * i)          # 0 = cima, horário
    sx, sy = math.sin(ang), math.cos(ang)
    # tela -> chão: x = sx, z = sy / sin(pitch) (o chão é achatado pela câmera)
    wx, wz = sx, sy / math.sin(PITCH)
    return math.atan2(wx, wz)


def job(args):
    d, fr = args
    return d, fr, render(2 * math.pi * fr / FRAMES, screen_dir_to_yaw(d))


# ---------------------------------------------------------------- cena da prévia
def make_floor(w, h, seed=3):
    rnd = random.Random(seed)
    base = np.zeros((h, w, 3))
    yy, xx = np.mgrid[0:h, 0:w]
    tile = 46
    base[:] = (0.22, 0.34, 0.42)
    noise = np.array(Image.effect_noise((w, h), 40).filter(ImageFilter.GaussianBlur(2))) / 255.0
    base *= (0.75 + 0.5 * noise)[..., None]
    for ty in range(0, h, tile):
        for tx in range(0, w, tile):
            k = rnd.uniform(0.85, 1.12)
            base[ty:ty + tile, tx:tx + tile] *= k
    grout = ((xx % tile) < 2) | ((yy % tile) < 2)
    base[grout] *= 0.45
    img = Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for _ in range(40):   # rachaduras
        x, y = rnd.randrange(w), rnd.randrange(h)
        pts = [(x, y)]
        for _ in range(rnd.randint(3, 7)):
            x += rnd.randint(-14, 14); y += rnd.randint(-14, 14)
            pts.append((x, y))
        d.line(pts, fill=(20, 32, 40), width=1)
    for _ in range(120):  # folhas secas
        x, y = rnd.randrange(w), rnd.randrange(h)
        c = rnd.choice([(150, 96, 60), (120, 70, 50), (170, 130, 80), (90, 60, 50)])
        d.ellipse((x, y, x + rnd.randint(3, 6), y + rnd.randint(2, 4)), fill=c)
    return img


def make_roof(w, h, seed=5):
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h), (70, 40, 26))
    d = ImageDraw.Draw(img)
    tw, th = 24, 16
    for row in range(0, h // th + 1):
        off = (row % 2) * tw // 2
        for col in range(-1, w // tw + 1):
            x, y = col * tw + off, row * th
            k = rnd.uniform(0.7, 1.15)
            c = tuple(int(v * k) for v in (150, 88, 52))
            d.rounded_rectangle((x + 1, y + 1, x + tw - 2, y + th - 1), 4, fill=c)
            d.line((x + 3, y + th - 3, x + tw - 4, y + th - 3), fill=(60, 34, 22), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.4))


def main():
    jobs = [(d, f) for d in range(8) for f in range(FRAMES)]
    frames = [[None] * FRAMES for _ in range(8)]
    with ProcessPoolExecutor() as ex:
        for d, f, im in ex.map(job, jobs):
            frames[d][f] = im

    sheet = Image.new("RGBA", (CELL * FRAMES, CELL * 8))
    for d in range(8):
        for f in range(FRAMES):
            sheet.alpha_composite(frames[d][f], (f * CELL, d * CELL))
    sheet.save(os.path.join(OUT_DIR, "camera_spritesheet.png"))

    # ---- cena animada
    SW, SH = 640, 480
    floor = make_floor(SW, SH).convert("RGBA")
    roof = make_roof(300, 260)
    # prédio com perspectiva falsa: telhado deslocado para fora do centro + paredes laterais
    bx, by, bw, bh = 360, -20, 300, 240
    lift = (bx + bw / 2 - SW / 2) * 0.12, (by + bh / 2 - SH / 2) * 0.12
    wall = Image.new("RGBA", (SW, SH))
    wd = ImageDraw.Draw(wall)
    rx, ry = bx + lift[0], by + lift[1]
    wd.polygon([(bx, by + bh), (rx, ry + bh), (rx, ry), (bx, by)], fill=(58, 70, 62, 255))  # parede esquerda
    wd.polygon([(bx, by + bh), (bx + bw, by + bh), (rx + bw, ry + bh), (rx, ry + bh)], fill=(46, 52, 48, 255))  # parede de baixo
    for k in range(0, 240, 14):
        wd.line((bx, by + k, rx, ry + k), fill=(48, 58, 52, 255), width=1)
    shadow_b = Image.new("RGBA", (SW, SH))
    ImageDraw.Draw(shadow_b).polygon([(bx - 40, by + 10), (bx, by), (bx, by + bh), (bx - 40, by + bh + 25)],
                                     fill=(0, 0, 0, 110))
    shadow_b = shadow_b.filter(ImageFilter.GaussianBlur(10))

    # caminho: percorre as 8 direções
    path_dirs = [2, 3, 4, 5, 6, 7, 0, 1]
    steps_per_dir = 12
    speed = 4.2
    pos = np.array([170.0, 300.0])
    rnd = random.Random(11)
    gif = []
    for d in path_dirs:
        ang = math.radians(45 * d)
        vel = np.array([math.sin(ang), -math.cos(ang)]) * speed
        for s in range(steps_per_dir):
            pos += vel
            fi = (s + d) % FRAMES
            fr = frames[d][fi].resize((CELL * 3 // 2, CELL * 3 // 2), Image.LANCZOS)
            img = floor.copy()
            img.alpha_composite(shadow_b)
            # lanterna (cone amarelado na direção do movimento)
            glow = Image.new("RGBA", (SW, SH))
            gd = ImageDraw.Draw(glow)
            cx, cy = pos[0], pos[1] - 18
            a0 = math.degrees(math.atan2(-math.cos(ang), math.sin(ang)))
            gd.pieslice((cx - 170, cy - 170, cx + 170, cy + 170), a0 - 17, a0 + 17, fill=(255, 235, 120, 120))
            glow = glow.filter(ImageFilter.GaussianBlur(14))
            img = Image.alpha_composite(img, glow)
            img.alpha_composite(fr, (int(pos[0] - fr.width / 2), int(pos[1] - fr.height * 0.68)))
            img.alpha_composite(wall)
            img.paste(roof, (int(rx), int(ry)))
            # minimapa no canto, como na referência
            mm = Image.new("RGBA", (120, 90), (150, 70, 40, 200))
            md = ImageDraw.Draw(mm)
            for _ in range(10):
                x, y = rnd.randrange(110), rnd.randrange(80)
                md.rectangle((x, y, x + 10, y + 8), fill=(200, 120, 70, 220))
            md.ellipse((pos[0] / SW * 120 - 3, pos[1] / SH * 90 - 3, pos[0] / SW * 120 + 3, pos[1] / SH * 90 + 3),
                       fill=(255, 255, 255, 255))
            md.rectangle((0, 0, 119, 89), outline=(230, 200, 150, 255))
            img.alpha_composite(mm, (SW - 132, 12))
            # neblina azul + vinheta + granulação
            arr = np.asarray(img.convert("RGB")).astype(float) / 255
            yy, xx = np.mgrid[0:SH, 0:SW]
            vig = 1 - 0.55 * (((xx - SW / 2) / (SW / 1.6)) ** 2 + ((yy - SH / 2) / (SH / 1.6)) ** 2)
            arr = arr * 0.92 + np.array([0.04, 0.07, 0.10])
            arr *= np.clip(vig, 0.35, 1)[..., None]
            arr += (np.random.default_rng(0).random((SH, SW, 1)) - 0.5) * 0.03
            out = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
            od = ImageDraw.Draw(out)
            od.text((14, SH - 52), "ENTERING NEW AREA INSTANCE...", fill=(230, 210, 60))
            od.text((14, SH - 36), f"DIRECAO: {DIR_NAMES[d]}", fill=(230, 210, 60))
            gif.append(out.convert("P", palette=Image.ADAPTIVE, colors=128))
    gif[0].save(os.path.join(OUT_DIR, "camera_andando.gif"), save_all=True,
                append_images=gif[1:], duration=85, loop=0)

    # ---- folha das direções (ampliada) + ciclo da caminhada de perfil
    Z = 2
    pw = CELL * Z * 4
    pres = Image.new("RGBA", (pw, CELL * Z * 3 + 30), (28, 40, 48, 255))
    bg = make_floor(pw, pres.height, seed=9).convert("RGBA")
    pres.alpha_composite(bg)
    dk = Image.new("RGBA", pres.size, (0, 0, 0, 90))
    pres.alpha_composite(dk)
    pd = ImageDraw.Draw(pres)
    for d in range(8):
        im = frames[d][1].resize((CELL * Z, CELL * Z), Image.LANCZOS)
        x, y = (d % 4) * CELL * Z, (d // 4) * CELL * Z
        pres.alpha_composite(im, (x, y))
        pd.text((x + 10, y + 8), DIR_NAMES[d], fill=(240, 220, 90))
    for f in range(FRAMES):
        im = frames[2][f]
        pres.alpha_composite(im, (f * CELL, CELL * Z * 2 + 20))
    pd.text((10, CELL * Z * 2 + 8), "ciclo de caminhada (L)", fill=(240, 220, 90))
    pres.convert("RGB").save(os.path.join(OUT_DIR, "camera_direcoes.png"))


if __name__ == "__main__":
    main()
