"""Gera as variações do personagem e os zumbis no estilo da câmera inclinada.

Usa as peças, a luz e a câmera de gerar_personagem_camera.py e cria:
  web/img/player_<pose>.png  corpo do jogador SEM arma, uma pose por tipo de arma
  web/img/z_<tipo>.png       zumbis humanoides (8 direções x 8 quadros)
  web/js/sprite_data.js      para cada pose/direção/quadro: mãos, eixo da arma,
                             lanterna do peito e se a arma fica atrás do corpo

Uso:  python3 tools/gerar_variantes.py            (tudo)
      python3 tools/gerar_variantes.py longa z_walker   (só alguns)
"""
import importlib.util, json, math, os, sys
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location("gen", os.path.join(HERE, "gerar_personagem_camera.py"))
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

# materiais extras (zumbis)
g.C.update({
    "zskin": (0.33, 0.40, 0.27), "zskin_d": (0.24, 0.30, 0.20), "hair": (0.07, 0.06, 0.05),
    "rag1": (0.30, 0.24, 0.17), "rag2": (0.15, 0.21, 0.30), "rag3": (0.36, 0.09, 0.08), "rag4": (0.22, 0.22, 0.22),
    "zpants": (0.16, 0.15, 0.14), "blood": (0.26, 0.03, 0.03),
    "hazmat": (0.58, 0.50, 0.12), "hazmask": (0.07, 0.07, 0.08), "visor": (0.20, 0.28, 0.24),
})
g.MATS = list(g.C.keys())
g.MAT_COL = np.array([g.C[k] for k in g.MATS])
V, I3, P = g.V, g.I3, g.Prim

PLAYER_POSES = ["longa", "pesada", "pistola", "melee", "punhos"]
ZOMBIES = ["z_walker", "z_walker2", "z_runner", "z_brute", "z_hazmat"]


def legs(prims, phase, mat="pants", boot="boot", amp=30, drag=1.0, hip_y=0.86, w=1.0):
    s = math.sin(phase)
    for side, sgn in ((1, 1), (-1, -1)):
        k = drag if side == 1 else 1.0               # perna direita arrastada (zumbi)
        a = math.radians(amp) * s * sgn * k
        swing = math.cos(phase) * sgn
        bend = math.radians(8 + 48 * max(0.0, swing) * k)
        hip = V(0.105 * side * w, hip_y, 0.0)
        knee = hip + 0.43 * V(0, -math.cos(a), math.sin(a))
        foot = knee + 0.42 * V(0, -math.cos(a - bend), math.sin(a - bend))
        prims.append(P("cap", mat, a=hip, b=knee, r=0.075 * w))
        prims.append(P("cap", mat, a=knee, b=foot, r=0.062 * w))
        toe = 0.25 * max(0.0, swing) * k
        prims.append(P("box", boot, c=foot + V(0, -0.015, 0.05), R=g.rot_x(-toe), b=V(0.045 * w, 0.035, 0.105), rr=0.025))


def arm(up, side, sh, hand, mat="jacket", mat2="jacket_d", skin="skin", w=1.0, hang=False):
    if hang:
        elbow = (sh + hand) / 2 + V(0.03 * side, 0.0, -0.03)
    else:
        elbow = (sh + hand) / 2 + V(0.10 * side, -0.13, -0.05 if side > 0 else 0.0)
    up.append(P("ell", mat, c=sh, R=I3, r=V(0.08, 0.08, 0.085) * w))
    up.append(P("cap", mat, a=sh, b=elbow, r=0.058 * w))
    up.append(P("cap", mat2, a=elbow, b=hand, r=0.05 * w))
    up.append(P("ell", skin, c=hand, R=I3, r=V(0.042, 0.042, 0.05) * w))


def weapon_axis(pose, ty, s):
    """Ponto da empunhadura, direção da arma e as duas mãos (espaço local)."""
    if pose == "longa":
        d = np.array([-0.06, -0.10, 1.0]); a = V(0.14, ty + 0.36, -0.02); L = 0.78
        d /= np.linalg.norm(d); R = g.frame_from_axis(a, a + d)
        mid = lambda t: a + t * L * d
        return a, d, mid(0.30) + R @ V(0, -0.03, 0), mid(0.66) + R @ V(0, -0.035, 0), False
    if pose == "pesada":
        d = np.array([0.0, -0.04, 1.0]); a = V(0.16, ty + 0.16, -0.06); L = 0.85
        d /= np.linalg.norm(d); R = g.frame_from_axis(a, a + d)
        mid = lambda t: a + t * L * d
        return a, d, mid(0.12) + R @ V(0, -0.04, 0), mid(0.52) + R @ V(0, -0.06, 0), False
    if pose == "pistola":
        d = np.array([0.0, -0.06, 1.0]); a = V(0.03, ty + 0.40, 0.40)
        d /= np.linalg.norm(d)
        return a, d, a + V(0, -0.03, 0), a + V(-0.04, -0.05, -0.02), False
    if pose == "melee":
        hand = V(0.22, ty + 0.24, 0.28)
        d = np.array([0.06, 0.78, 0.62]); d /= np.linalg.norm(d)
        return hand, d, hand, V(-0.24, ty + 0.02, -0.14 * s), True
    # punhos
    hr = V(0.12, ty + 0.42, 0.30); hl = V(-0.12, ty + 0.44, 0.24)
    return hr, np.array([0.0, 0.0, 1.0]), hr, hl, False


def build_player(phase, pose):
    s = math.sin(phase)
    bob = 0.025 * math.cos(2 * phase)
    twist = math.radians(7) * s
    lean = math.radians(5)
    prims = []
    hip_y = 0.86 + bob
    legs(prims, phase, hip_y=hip_y)
    prims.append(P("ell", "pants", c=V(0, hip_y + 0.04, 0), R=I3, r=V(0.17, 0.11, 0.12)))
    prims.append(P("box", "strap", c=V(0, hip_y + 0.11, 0), R=I3, b=V(0.15, 0.025, 0.10), rr=0.02))
    up = []
    ty = hip_y + 0.12
    up.append(P("ell", "jacket", c=V(0, ty + 0.28, 0), R=I3, r=V(0.20, 0.30, 0.13)))
    up.append(P("ell", "jacket", c=V(0, ty + 0.44, 0), R=I3, r=V(0.25, 0.10, 0.13)))
    up.append(P("box", "vest", c=V(0, ty + 0.28, 0.035), R=I3, b=V(0.15, 0.17, 0.10), rr=0.03))
    for side in (1, -1):
        up.append(P("box", "strap", c=V(0.09 * side, ty + 0.30, 0.0), R=I3, b=V(0.022, 0.22, 0.135), rr=0.01))
    up.append(P("box", "pack", c=V(0, ty + 0.26, -0.21), R=I3, b=V(0.15, 0.19, 0.08), rr=0.04))
    up.append(P("box", "pack", c=V(0, ty + 0.14, -0.28), R=I3, b=V(0.11, 0.07, 0.04), rr=0.025))
    up.append(P("cap", "roll", a=V(-0.17, ty + 0.50, -0.20), b=V(0.17, ty + 0.50, -0.20), r=0.065))
    hy = ty + 0.64
    up.append(P("cap", "skin", a=V(0, ty + 0.48, 0), b=V(0, hy - 0.05, 0.01), r=0.055))
    up.append(P("ell", "skin", c=V(0, hy, 0.015), R=I3, r=V(0.095, 0.115, 0.105)))
    up.append(P("ell", "beanie", c=V(0, hy + 0.045, -0.005), R=I3, r=V(0.103, 0.095, 0.108)))
    grip, d, hr, hl, hang_l = weapon_axis(pose, ty, s)
    arm(up, 1, V(0.22, ty + 0.44, 0.0), hr)
    arm(up, -1, V(-0.22, ty + 0.44, 0.0), hl, hang=hang_l)
    # pontos que o jogo usa (no mesmo espaço do corpo de cima)
    R = g.frame_from_axis(grip, grip + d)
    pts = {"a": grip, "b": grip + d, "u": grip + R @ V(0, 0.1, 0), "hr": hr, "hl": hl,
           "c": V(-0.06, ty + 0.40, 0.15), "t": V(0, ty + 0.30, 0)}
    pivot = V(0, hip_y, 0)
    M = g.rot_y(twist) @ g.rot_x(lean)
    for p in up:
        q = p.transformed(M)
        for key in ("a", "b", "c"):
            if key in q.kw and not (key == "b" and q.kind == "box"):
                q.kw[key] = M @ (p.kw[key] - pivot) + pivot
        prims.append(q)
    pts = {k: M @ (v - pivot) + pivot for k, v in pts.items()}
    return prims, pts


def build_zombie(phase, kind):
    s = math.sin(phase)
    runner, brute, hazmat = kind == "z_runner", kind == "z_brute", kind == "z_hazmat"
    w = 1.35 if brute else 1.0
    bob = (0.04 if not runner else 0.03) * math.cos(2 * phase)
    hip_y = (0.84 if not brute else 0.92) + bob
    shirt = {"z_walker": "rag1", "z_walker2": "rag2", "z_runner": "rag3", "z_brute": "rag4", "z_hazmat": "hazmat"}[kind]
    pants = "hazmat" if hazmat else "zpants"
    skin = "zskin"
    prims = []
    legs(prims, phase, mat=pants, boot="boot", amp=34 if runner else 22, drag=1.0 if runner else 0.45, hip_y=hip_y, w=w)
    prims.append(P("ell", pants, c=V(0, hip_y + 0.04, 0), R=I3, r=V(0.17, 0.11, 0.12) * w))
    up = []
    ty = hip_y + 0.12
    up.append(P("ell", shirt, c=V(0, ty + 0.28, 0), R=I3, r=V(0.20, 0.30, 0.13) * w))
    up.append(P("ell", shirt, c=V(0, ty + 0.44, 0), R=I3, r=V(0.25, 0.10, 0.13) * w))
    if not hazmat:
        up.append(P("ell", "blood", c=V(0.05, ty + 0.30, 0.10 * w), R=I3, r=V(0.07, 0.09, 0.04)))
        up.append(P("ell", "blood", c=V(-0.09, ty + 0.18, 0.09 * w), R=I3, r=V(0.05, 0.05, 0.03)))
    hy = ty + 0.62
    up.append(P("cap", skin, a=V(0, ty + 0.48, 0), b=V(0.02, hy - 0.06, 0.04), r=0.055 * w))
    if hazmat:
        up.append(P("ell", "hazmat", c=V(0.02, hy, 0.03), R=I3, r=V(0.12, 0.13, 0.12)))
        up.append(P("ell", "visor", c=V(0.02, hy + 0.01, 0.10), R=I3, r=V(0.08, 0.06, 0.04)))
        up.append(P("cap", "hazmask", a=V(-0.05, hy - 0.07, 0.11), b=V(0.08, hy - 0.07, 0.11), r=0.03))
    else:
        up.append(P("ell", skin, c=V(0.02, hy, 0.04), R=I3, r=V(0.095, 0.115, 0.105) * w))
        up.append(P("ell", "hair", c=V(0.0, hy + 0.06, -0.02), R=I3, r=V(0.09, 0.06, 0.09) * w))
        up.append(P("ell", "zskin_d", c=V(0.04, hy - 0.04, 0.12), R=I3, r=V(0.04, 0.02, 0.02)))  # boca
    arm_mat = "hazmat" if hazmat else skin
    for side in (1, -1):
        sh = V(0.22 * side * w, ty + 0.44, 0.0)
        if runner:
            hand = V(0.26 * side, ty + 0.10, -0.22 * s * side)
            arm(up, side, sh, hand, mat=shirt, mat2=skin, skin=skin, w=w, hang=True)
        else:
            wob = 0.04 * math.sin(phase + side)
            hand = V(0.14 * side * w, ty + 0.40 + wob, (0.50 + 0.06 * side * s) * w)
            arm(up, side, sh, hand, mat=shirt if not hazmat else "hazmat", mat2=arm_mat, skin=arm_mat, w=w)
    pivot = V(0, hip_y, 0)
    lean = math.radians(28 if runner else 16 if not brute else 10)
    M = g.rot_y(math.radians(6) * s) @ g.rot_x(lean)
    for p in up:
        q = p.transformed(M)
        for key in ("a", "b", "c"):
            if key in q.kw and not (key == "b" and q.kind == "box"):
                q.kw[key] = M @ (p.kw[key] - pivot) + pivot
        prims.append(q)
    return prims


def project(Pt):
    f, r, u = g.camera()
    gx = float((Pt - g.LOOK_AT) @ r); gy = float((Pt - g.LOOK_AT) @ u)
    return [round((gx / g.VIEW + 0.5) * g.CELL, 1), round((0.5 - gy / g.VIEW) * g.CELL, 1)], float((Pt - g.LOOK_AT) @ f)


def job(args):
    name, d, fr = args
    phase = 2 * math.pi * fr / g.FRAMES
    if name.startswith("z_"):
        g.build_character = lambda ph: build_zombie(ph, name)
    else:
        g.build_character = lambda ph: build_player(ph, name)[0]
    return name, d, fr, g.render(phase, g.screen_dir_to_yaw(d))


def pose_data(name):
    rows = []
    for d in range(8):
        yaw = g.screen_dir_to_yaw(d); Y = g.rot_y(yaw); row = []
        for fr in range(g.FRAMES):
            _, pts = build_player(2 * math.pi * fr / g.FRAMES, name)
            out = {}
            depth = {}
            for k, v in pts.items():
                out[k], depth[k] = project(Y @ v)
            mid = Y @ (pts["a"] + 0.4 * (pts["b"] - pts["a"]))
            behind = project(mid)[1] > depth["t"] + 0.02     # arma mais longe da câmera que o tronco
            row.append({k: out[k] for k in ("a", "b", "u", "hr", "hl", "c")} | {"bh": 1 if behind else 0})
        rows.append(row)
    return rows


def main():
    want = sys.argv[1:] or (PLAYER_POSES + ZOMBIES)
    imgdir = os.path.join(ROOT, "web", "img")
    jobs = [(n, d, f) for n in want for d in range(8) for f in range(g.FRAMES)]
    sheets = {n: Image.new("RGBA", (g.CELL * g.FRAMES, g.CELL * 8)) for n in want}
    with ProcessPoolExecutor() as ex:
        for i, (n, d, f, im) in enumerate(ex.map(job, jobs, chunksize=2)):
            sheets[n].alpha_composite(im, (f * g.CELL, d * g.CELL))
            if i % 32 == 31: print(f"{i + 1}/{len(jobs)} quadros", flush=True)
    for n, sh in sheets.items():
        fname = n if n.startswith("z_") else f"player_{n}"
        sh.save(os.path.join(imgdir, fname + ".png"), optimize=True)
        print("salvo", fname + ".png", flush=True)
    data = {n: pose_data(n) for n in PLAYER_POSES}
    with open(os.path.join(ROOT, "web", "js", "sprite_data.js"), "w") as fh:
        fh.write('"use strict";\n// Gerado por tools/gerar_variantes.py: pontos de cada pose [direção][quadro] (px no quadro de 128)\n')
        fh.write("// a = empunhadura, b = 1 m ao longo da arma, u = 10 cm para cima da arma, hr/hl = mãos, c = lanterna do peito, bh = arma atrás do corpo\n")
        fh.write("const SPRITE_POSES = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print("salvo sprite_data.js", flush=True)


if __name__ == "__main__":
    main()
