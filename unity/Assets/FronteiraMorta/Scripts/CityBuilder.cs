using System.Collections.Generic;
using UnityEngine;

namespace FronteiraMorta
{
    /// <summary>
    /// Monta uma área da cidade (2 x 2 quadras) em 3D, no mesmo traçado da versão web:
    /// ruas de asfalto, calçadas de cerâmica azul, casas com telhado de telha, prédios
    /// comerciais com andares e janelas, postes, carros, árvores e lugares para vasculhar.
    /// 1 unidade = 1 metro. A área vai de (0,0) a (W,H) no plano XZ.
    /// </summary>
    public class CityBuilder
    {
        public const float EDGE = 7f, BW = 62f, BH = 64f, ST = 14f, SIDEWALK = 2.6f;
        public const float W = 2 * EDGE + 2 * BW + ST, H = 2 * EDGE + 2 * BH + ST;
        public static float MidX => EDGE + BW + ST / 2f;
        public static float MidZ => EDGE + BH + ST / 2f;

        public readonly List<Light> lamps = new List<Light>();
        public readonly List<Material> litWindows = new List<Material>();
        readonly System.Random R;
        readonly Transform root;
        Material asphalt, tiles, grass, dirt, roof, glass, glassLit, door, yellow, white, trunk, leaves;

        public CityBuilder(int seed, Transform parent) { R = new System.Random(seed); root = parent; }

        float Rf(float a, float b) => a + (float)R.NextDouble() * (b - a);
        bool Chance(float p) => R.NextDouble() < p;

        GameObject Box(string name, Vector3 center, Vector3 size, Material m, bool collider = true, Transform parent = null)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent ?? root, false);
            go.transform.position = center;
            go.transform.localScale = size;
            go.GetComponent<Renderer>().sharedMaterial = m;
            if (!collider) Object.Destroy(go.GetComponent<Collider>());
            return go;
        }

        public Vector3 Build()
        {
            asphalt = Mat.Textured("asfalto", Mat.Noise(new Color(0.17f, 0.18f, 0.19f), 0.25f, 11), new Vector2(40, 40), 0.05f);
            tiles = Mat.Textured("ceramica", Mat.BlueTiles(), new Vector2(BW / 4f, BH / 4f), 0.25f);
            grass = Mat.Textured("grama", Mat.Noise(new Color(0.2f, 0.27f, 0.15f), 0.35f, 12), new Vector2(10, 10), 0.02f);
            dirt = Mat.Textured("terra", Mat.Noise(new Color(0.29f, 0.26f, 0.2f), 0.3f, 13), new Vector2(10, 10), 0.02f);
            roof = Mat.Textured("telha", Mat.RoofTiles(), new Vector2(3, 3), 0.1f);
            glass = Mat.Lit(new Color(0.12f, 0.17f, 0.22f), 0.85f);
            glassLit = Mat.Emissive(new Color(1f, 0.8f, 0.45f), 1.2f);
            door = Mat.Lit(new Color(0.3f, 0.2f, 0.12f));
            yellow = Mat.Lit(new Color(0.8f, 0.7f, 0.35f));
            white = Mat.Lit(new Color(0.85f, 0.85f, 0.8f));
            trunk = Mat.Lit(new Color(0.25f, 0.17f, 0.1f));
            leaves = Mat.Lit(new Color(0.16f, 0.27f, 0.13f));

            Box("Asfalto", new Vector3(W / 2, -0.05f, H / 2), new Vector3(W + 60, 0.1f, H + 60), asphalt);
            RoadMarks();
            for (int i = 0; i < 4; i++)
            {
                float bx = EDGE + (i % 2) * (BW + ST), bz = EDGE + (i / 2) * (BH + ST);
                Block(new Rect(bx, bz, BW, BH), i);
            }
            Lamps();
            Cars();
            // paredes invisíveis na borda da área
            foreach (var (c, s) in new[] { (new Vector3(W / 2, 1.5f, -0.5f), new Vector3(W, 3, 1)), (new Vector3(W / 2, 1.5f, H + 0.5f), new Vector3(W, 3, 1)),
                                            (new Vector3(-0.5f, 1.5f, H / 2), new Vector3(1, 3, H)), (new Vector3(W + 0.5f, 1.5f, H / 2), new Vector3(1, 3, H)) })
            {
                var w = Box("Borda", c, s, white); Object.Destroy(w.GetComponent<Renderer>());
            }
            return new Vector3(MidX, 0.1f, MidZ);
        }

        void RoadMarks()
        {
            for (float x = 2; x < W; x += 6) if (Mathf.Abs(x - MidX) > ST) Box("Faixa", new Vector3(x, 0.006f, MidZ), new Vector3(2.4f, 0.01f, 0.18f), yellow, false);
            for (float z = 2; z < H; z += 6) if (Mathf.Abs(z - MidZ) > ST) Box("Faixa", new Vector3(MidX, 0.006f, z), new Vector3(0.18f, 0.01f, 2.4f), yellow, false);
            for (int i = 0; i < 6; i++)
            {
                float o = -ST / 2 + 1.5f + i * 2.2f;
                Box("Pedestre", new Vector3(MidX + o, 0.006f, MidZ - ST / 2 - 1.8f), new Vector3(1.1f, 0.01f, 2.6f), white, false);
                Box("Pedestre", new Vector3(MidX + o, 0.006f, MidZ + ST / 2 + 1.8f), new Vector3(1.1f, 0.01f, 2.6f), white, false);
                Box("Pedestre", new Vector3(MidX - ST / 2 - 1.8f, 0.006f, MidZ + o), new Vector3(2.6f, 0.01f, 1.1f), white, false);
                Box("Pedestre", new Vector3(MidX + ST / 2 + 1.8f, 0.006f, MidZ + o), new Vector3(2.6f, 0.01f, 1.1f), white, false);
            }
        }

        void Block(Rect r, int index)
        {
            var c = new Vector3(r.center.x, 0, r.center.y);
            Box("Calcada", c + Vector3.up * 0.06f, new Vector3(r.width, 0.12f, r.height), tiles);
            var inner = new Rect(r.x + SIDEWALK, r.y + SIDEWALK, r.width - 2 * SIDEWALK, r.height - 2 * SIDEWALK);
            float roll = Rf(0, 1);
            if (roll < 0.15f) { Park(inner); return; }
            bool commercial = roll < 0.55f;
            Box("Lote", new Vector3(inner.center.x, 0.125f, inner.center.y), new Vector3(inner.width, 0.01f, inner.height), commercial ? dirt : grass, false);
            int cols = commercial ? 2 : 3;
            float lw = inner.width / cols, lh = inner.height / 2;
            for (int row = 0; row < 2; row++)
                for (int col = 0; col < cols; col++)
                {
                    var lot = new Rect(inner.x + col * lw, inner.y + row * lh, lw, lh);
                    bool facesSouth = row == 0;
                    if (Chance(0.08f)) { Trees(lot, 3); continue; }
                    Building(lot, facesSouth, commercial);
                }
        }

        void Park(Rect inner)
        {
            Box("Praca", new Vector3(inner.center.x, 0.125f, inner.center.y), new Vector3(inner.width, 0.01f, inner.height), grass, false);
            var f = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            f.transform.SetParent(root, false); f.transform.position = new Vector3(inner.center.x, 0.3f, inner.center.y);
            f.transform.localScale = new Vector3(6, 0.3f, 6); f.GetComponent<Renderer>().sharedMaterial = Mat.Lit(new Color(0.5f, 0.5f, 0.47f));
            Trees(inner, 14);
            var chest = Box("Bau", new Vector3(inner.center.x + 5, 0.45f, inner.center.y + 4), new Vector3(1.0f, 0.6f, 0.7f), Mat.Lit(new Color(0.5f, 0.33f, 0.17f)));
            chest.AddComponent<Lootable>().Init("baú", 1.6f, 0.1f, 0.08f);
        }

        void Trees(Rect area, int n)
        {
            for (int i = 0; i < n; i++)
            {
                float x = Rf(area.xMin + 2, area.xMax - 2), z = Rf(area.yMin + 2, area.yMax - 2);
                float s = Rf(0.8f, 1.3f);
                var t = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                t.name = "Tronco"; t.transform.SetParent(root, false);
                t.transform.position = new Vector3(x, 1.4f * s, z); t.transform.localScale = new Vector3(0.35f, 1.4f * s, 0.35f);
                t.GetComponent<Renderer>().sharedMaterial = trunk;
                for (int k = 0; k < 3; k++)
                {
                    var l = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                    Object.Destroy(l.GetComponent<Collider>());
                    l.transform.SetParent(root, false);
                    l.transform.position = new Vector3(x + Rf(-0.8f, 0.8f), 3.4f * s + Rf(-0.3f, 0.5f), z + Rf(-0.8f, 0.8f));
                    l.transform.localScale = Vector3.one * Rf(2.2f, 3.2f) * s;
                    l.GetComponent<Renderer>().sharedMaterial = leaves;
                }
            }
        }

        void Building(Rect lot, bool facesSouth, bool commercial)
        {
            float w = lot.width * (commercial ? Rf(0.72f, 0.86f) : Rf(0.55f, 0.72f));
            float d = lot.height * (commercial ? Rf(0.58f, 0.72f) : Rf(0.45f, 0.58f));
            float gap = commercial ? Rf(2f, 3f) : Rf(3.5f, 6f);
            float cx = lot.center.x + Rf(-0.15f, 0.15f) * (lot.width - w);
            float cz = facesSouth ? lot.yMin + gap + d / 2 : lot.yMax - gap - d / 2;
            int floors = commercial ? (Chance(0.5f) ? 2 : Chance(0.6f) ? 3 : 4) : (Chance(0.55f) ? 1 : Chance(0.75f) ? 2 : 3);
            float fh = 3.1f, h = floors * fh + 0.4f;
            Color[] houseCols = { new Color(0.55f, 0.45f, 0.4f), new Color(0.45f, 0.52f, 0.56f), new Color(0.62f, 0.56f, 0.42f), new Color(0.5f, 0.44f, 0.52f), new Color(0.46f, 0.55f, 0.44f) };
            Color[] comCols = { new Color(0.47f, 0.5f, 0.46f), new Color(0.4f, 0.44f, 0.5f), new Color(0.52f, 0.5f, 0.45f), new Color(0.36f, 0.33f, 0.3f) };
            var wallCol = commercial ? comCols[R.Next(comCols.Length)] : houseCols[R.Next(houseCols.Length)];
            var wallMat = Mat.Lit(wallCol, 0.1f);
            var b = Box(commercial ? "Comercio" : "Casa", new Vector3(cx, h / 2 + 0.12f, cz), new Vector3(w, h, d), wallMat);
            float top = h + 0.12f;
            if (commercial)
            {
                Box("Laje", new Vector3(cx, top + 0.1f, cz), new Vector3(w + 0.3f, 0.2f, d + 0.3f), Mat.Lit(wallCol * 0.75f), false);
                for (int i = 0; i < 2; i++)
                    Box("ArCondicionado", new Vector3(cx + Rf(-w / 3, w / 3), top + 0.6f, cz + Rf(-d / 3, d / 3)), new Vector3(1.2f, 0.8f, 1.2f), Mat.Lit(new Color(0.55f, 0.56f, 0.57f)), false);
            }
            else
            {
                // telhado de duas águas, cumeeira no eixo X
                float rise = d / 2 * Mathf.Tan(30 * Mathf.Deg2Rad), len = d / 2 / Mathf.Cos(30 * Mathf.Deg2Rad) + 0.35f;
                var s1 = Box("Telhado", new Vector3(cx, top + rise / 2, cz - d / 4), new Vector3(w + 0.6f, 0.15f, len), roof, false);
                s1.transform.rotation = Quaternion.Euler(-30, 0, 0);
                var s2 = Box("Telhado", new Vector3(cx, top + rise / 2, cz + d / 4), new Vector3(w + 0.6f, 0.15f, len), roof, false);
                s2.transform.rotation = Quaternion.Euler(30, 0, 0);
                // oitões (fechamento triangular aproximado)
                for (int sgn = -1; sgn <= 1; sgn += 2)
                    Box("Oitao", new Vector3(cx + sgn * (w / 2 - 0.05f), top + rise * 0.35f, cz), new Vector3(0.1f, rise * 0.7f, d * 0.55f), wallMat, false);
            }
            // janelas nas fachadas da frente e de trás, por andar
            int nWin = Mathf.Max(1, Mathf.FloorToInt(w / 2.6f));
            for (int f = 0; f < floors; f++)
                for (int i = 0; i < nWin; i++)
                {
                    float x = cx - w / 2 + (i + 0.5f) * w / nWin;
                    float y = 0.12f + f * fh + 1.7f;
                    foreach (float side in new[] { -1f, 1f })
                    {
                        if (f == 0 && Mathf.Abs(x - cx) < 1.2f && (side < 0) == facesSouth) continue; // espaço da porta
                        bool lit = Chance(0.18f);
                        Box("Janela", new Vector3(x, y, cz + side * (d / 2 + 0.03f)), new Vector3(1.1f, 1.2f, 0.06f), lit ? glassLit : glass, false);
                    }
                }
            float dz = facesSouth ? cz - d / 2 - 0.05f : cz + d / 2 + 0.05f;
            Box("Porta", new Vector3(cx, 0.12f + 1.05f, dz), new Vector3(1.2f, 2.1f, 0.12f), door, false);
            if (commercial) Box("Letreiro", new Vector3(cx, 0.12f + 2.8f, dz + (facesSouth ? -0.05f : 0.05f)), new Vector3(Mathf.Min(w * 0.6f, 5f), 0.6f, 0.1f), Mat.Emissive(new Color(0.85f, 0.6f, 0.2f), 0.6f), false);

            // lugar para vasculhar no quintal / fundos
            float backZ = facesSouth ? cz + d / 2 + 1.6f : cz - d / 2 - 1.6f;
            if (commercial && Chance(0.45f))
            {
                var dump = Box("Cacamba", new Vector3(cx + Rf(-w / 3, w / 3), 0.75f, backZ), new Vector3(2.2f, 1.3f, 1.3f), Mat.Lit(new Color(0.18f, 0.4f, 0.28f)));
                dump.AddComponent<Lootable>().Init("caçamba", 1.2f, 0.35f, 0.03f);
            }
            else if (Chance(0.4f))
            {
                var crate = Box("Caixote", new Vector3(cx + Rf(-w / 3, w / 3), 0.5f, backZ), new Vector3(0.8f, 0.8f, 0.8f), Mat.Lit(new Color(0.5f, 0.38f, 0.22f)));
                crate.AddComponent<Lootable>().Init("caixote", 1.0f, 0.3f, 0.04f);
            }
            if (!commercial && Chance(0.5f)) Trees(new Rect(lot.x, facesSouth ? cz + d / 2 + 2 : lot.y, lot.width, Mathf.Max(3, (facesSouth ? lot.yMax - (cz + d / 2 + 2) : (cz - d / 2 - 2) - lot.y))), 1);
        }

        void Lamps()
        {
            int count = 0;
            for (float t = 12; t < W - 6; t += 24)
                foreach (float side in new[] { -1f, 1f })
                {
                    if (count >= 16) return;
                    if (Mathf.Abs(t - MidX) < ST) continue;
                    Lamp(new Vector3(t, 0, MidZ + side * (ST / 2 + 0.8f))); count++;
                }
            for (float t = 12; t < H - 6; t += 24)
                foreach (float side in new[] { -1f, 1f })
                {
                    if (count >= 16) return;
                    if (Mathf.Abs(t - MidZ) < ST) continue;
                    Lamp(new Vector3(MidX + side * (ST / 2 + 0.8f), 0, t)); count++;
                }
        }

        void Lamp(Vector3 p)
        {
            var pole = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pole.name = "Poste"; pole.transform.SetParent(root, false);
            pole.transform.position = p + Vector3.up * 1.9f; pole.transform.localScale = new Vector3(0.14f, 1.9f, 0.14f);
            pole.GetComponent<Renderer>().sharedMaterial = Mat.Lit(new Color(0.1f, 0.1f, 0.1f), 0.5f);
            Box("Luminaria", p + Vector3.up * 3.85f, new Vector3(0.5f, 0.15f, 0.5f), Mat.Emissive(new Color(1f, 0.85f, 0.55f), 1f), false);
            var lg = new GameObject("Luz");
            lg.transform.SetParent(root, false); lg.transform.position = p + Vector3.up * 3.6f;
            var l = lg.AddComponent<Light>();
            l.type = LightType.Point; l.range = 13f; l.intensity = 0f; l.color = new Color(1f, 0.8f, 0.5f); l.shadows = LightShadows.None;
            lamps.Add(l);
        }

        void Cars()
        {
            Color[] cols = { new Color(0.6f, 0.2f, 0.17f), new Color(0.22f, 0.35f, 0.52f), new Color(0.75f, 0.73f, 0.66f), new Color(0.33f, 0.4f, 0.27f), new Color(0.18f, 0.18f, 0.2f) };
            for (int i = 0; i < 9; i++)
            {
                bool alongX = Chance(0.5f);
                float along = Rf(10, (alongX ? W : H) - 10);
                if (Mathf.Abs(along - (alongX ? MidX : MidZ)) < ST) along += ST * 1.5f;
                float lane = (Chance(0.5f) ? -1 : 1) * Rf(2.2f, 3.6f);
                Vector3 pos = alongX ? new Vector3(along, 0, MidZ + lane) : new Vector3(MidX + lane, 0, along);
                var col = cols[R.Next(cols.Length)];
                bool wreck = Chance(0.25f);
                var car = new GameObject("Carro"); car.transform.SetParent(root, false); car.transform.position = pos;
                car.transform.rotation = Quaternion.Euler(0, (alongX ? 90 : 0) + Rf(-8, 8), 0);
                var body = Box("Lataria", pos + Vector3.up * 0.7f, new Vector3(1.9f, 0.8f, 4.3f), Mat.Lit(wreck ? col * 0.45f : col, 0.55f), true, car.transform);
                body.transform.localPosition = new Vector3(0, 0.7f, 0); body.transform.localRotation = Quaternion.identity;
                var cab = Box("Cabine", pos, new Vector3(1.7f, 0.65f, 2.2f), Mat.Lit(new Color(0.12f, 0.16f, 0.2f), 0.85f), false, car.transform);
                cab.transform.localPosition = new Vector3(0, 1.4f, -0.2f); cab.transform.localRotation = Quaternion.identity;
                if (Chance(0.3f)) body.AddComponent<Lootable>().Init("carro", 1.6f, 0.3f, 0.05f);
            }
        }
    }
}
