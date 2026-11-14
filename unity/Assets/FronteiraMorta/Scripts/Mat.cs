using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace FronteiraMorta
{
    /// <summary>
    /// Materiais e texturas feitos por código. Funciona tanto no projeto URP
    /// (modelo "Universal 3D" do Unity 6) quanto no Built-in.
    /// </summary>
    public static class Mat
    {
        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();
        static Shader lit, unlit;

        // Usa o shader do URP sempre que ele existir no projeto (não depende de perguntar qual
        // pipeline está ativo, que às vezes ainda não responde no primeiro quadro e deixava tudo rosa).
        public static bool Urp => Shader.Find("Universal Render Pipeline/Lit") != null;

        public static Shader LitShader()
        {
            if (lit == null) lit = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            return lit;
        }

        static Shader UnlitShader()
        {
            if (unlit == null) unlit = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color") ?? Shader.Find("Sprites/Default");
            return unlit;
        }

        public static void SetColor(Material m, Color c)
        {
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
        }

        public static Material Lit(Color c, float smooth = 0.15f)
        {
            string key = "L" + ColorUtility.ToHtmlStringRGBA(c) + smooth.ToString("0.00");
            if (cache.TryGetValue(key, out var m)) return m;
            m = new Material(LitShader());
            SetColor(m, c);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smooth);
            cache[key] = m;
            return m;
        }

        public static Material Unlit(Color c)
        {
            string key = "U" + ColorUtility.ToHtmlStringRGBA(c);
            if (cache.TryGetValue(key, out var m)) return m;
            m = new Material(UnlitShader());
            SetColor(m, c);
            cache[key] = m;
            return m;
        }

        public static Material Emissive(Color c, float power)
        {
            string key = "E" + ColorUtility.ToHtmlStringRGBA(c) + power;
            if (cache.TryGetValue(key, out var m)) return m;
            m = new Material(LitShader());
            SetColor(m, c);
            m.EnableKeyword("_EMISSION");
            if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", c * power);
            cache[key] = m;
            return m;
        }

        public static Material Textured(string key, Texture2D tex, Vector2 tiling, float smooth = 0.1f)
        {
            if (cache.TryGetValue(key, out var m)) return m;
            m = new Material(LitShader());
            SetColor(m, Color.white);
            if (m.HasProperty("_BaseMap")) { m.SetTexture("_BaseMap", tex); m.SetTextureScale("_BaseMap", tiling); }
            if (m.HasProperty("_MainTex")) { m.SetTexture("_MainTex", tex); m.SetTextureScale("_MainTex", tiling); }
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smooth);
            cache[key] = m;
            return m;
        }

        // ---------- texturas ----------
        static Texture2D NewTex(int size)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear };
            return t;
        }

        /// <summary>Cerâmica azul-acinzentada com rejunte, rachaduras e folhas secas.</summary>
        public static Texture2D BlueTiles()
        {
            const int S = 256, step = 64;
            var t = NewTex(S);
            var px = new Color[S * S];
            var rnd = new System.Random(7);
            var tileShade = new float[16];
            for (int i = 0; i < 16; i++) tileShade[i] = (float)(rnd.NextDouble() * 0.08 - 0.04);
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    int tx = x / step, ty = y / step;
                    float n = (float)rnd.NextDouble() * 0.05f;
                    var c = new Color(0.25f, 0.33f, 0.41f) * (1f + tileShade[(ty * 4 + tx) % 16] + n);
                    if (x % step < 3 || y % step < 3) c = new Color(0.07f, 0.1f, 0.14f);
                    c.a = 1;
                    px[y * S + x] = c;
                }
            // rachaduras
            for (int k = 0; k < 10; k++)
            {
                float x = rnd.Next(S), y = rnd.Next(S);
                for (int s = 0; s < 40; s++)
                {
                    x += (float)(rnd.NextDouble() - 0.5) * 3f; y += (float)(rnd.NextDouble() - 0.5) * 3f;
                    int ix = ((int)x % S + S) % S, iy = ((int)y % S + S) % S;
                    px[iy * S + ix] = new Color(0.05f, 0.07f, 0.1f);
                }
            }
            // folhas secas
            for (int k = 0; k < 26; k++)
            {
                int cx = rnd.Next(S), cy = rnd.Next(S);
                var lc = new Color(0.55f + (float)rnd.NextDouble() * 0.15f, 0.3f, 0.13f);
                for (int dy = -2; dy <= 2; dy++)
                    for (int dx = -4; dx <= 4; dx++)
                        if (dx * dx / 16f + dy * dy / 4f <= 1f) px[((cy + dy + S) % S) * S + (cx + dx + S) % S] = lc;
            }
            t.SetPixels(px); t.Apply();
            return t;
        }

        public static Texture2D Noise(Color baseC, float amount, int seed, int lines = 0)
        {
            const int S = 128;
            var t = NewTex(S);
            var px = new Color[S * S];
            var rnd = new System.Random(seed);
            for (int i = 0; i < px.Length; i++)
            {
                float n = (float)(rnd.NextDouble() - 0.5) * amount;
                var c = baseC * (1f + n); c.a = 1; px[i] = c;
            }
            if (lines > 0)
                for (int y = 0; y < S; y++)
                    for (int x = 0; x < S; x++)
                        if (y % lines < 2) px[y * S + x] = baseC * 0.7f;
            t.SetPixels(px); t.Apply();
            return t;
        }

        /// <summary>Parede de reboco com manchas de umidade e sujeira embaixo.</summary>
        public static Material Wall(Color c)
        {
            string key = "W" + ColorUtility.ToHtmlStringRGB(c);
            if (cache.TryGetValue(key, out var m)) return m;
            const int S = 128;
            var t = NewTex(S);
            var px = new Color[S * S];
            var rnd = new System.Random(c.GetHashCode());
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float n = (float)(rnd.NextDouble() - 0.5) * 0.12f;
                    float dirt = Mathf.Clamp01(1f - y / (S * 0.35f)) * 0.25f;          // sujeira perto do chão
                    var col = c * (1f + n - dirt); col.a = 1; px[y * S + x] = col;
                }
            for (int k = 0; k < 5; k++)   // escorridos verticais
            {
                int x0 = rnd.Next(S), len = rnd.Next(20, 70), y0 = rnd.Next(S / 2, S);
                for (int y = y0; y > y0 - len && y > 0; y--) for (int dx = 0; dx < 2; dx++) { int ix = (x0 + dx) % S; px[y * S + ix] *= 0.82f; px[y * S + ix].a = 1; }
            }
            t.SetPixels(px); t.Apply();
            m = Textured(key, t, new Vector2(2, 2), 0.08f);
            return m;
        }

        /// <summary>Telha laranja (fileiras com sombra).</summary>
        public static Texture2D RoofTiles()
        {
            const int S = 128;
            var t = NewTex(S);
            var px = new Color[S * S];
            var rnd = new System.Random(3);
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    int row = y / 16, off = row % 2 == 0 ? 0 : 8;
                    float edge = (y % 16) / 16f;
                    var c = new Color(0.72f, 0.33f, 0.16f) * (0.75f + 0.35f * edge + (float)(rnd.NextDouble() * 0.06));
                    if ((x + off) % 16 < 1) c *= 0.6f;
                    c.a = 1; px[y * S + x] = c;
                }
            t.SetPixels(px); t.Apply();
            return t;
        }
    }
}
