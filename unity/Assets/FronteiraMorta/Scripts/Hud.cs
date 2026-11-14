using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace FronteiraMorta
{
    /// <summary>
    /// HUD no estilo da versão web: 5 barras no topo (vida, fome, sede, energia, infecção) com estado,
    /// informações embaixo, minimapa no canto superior direito, log amarelo, armas e munição embaixo à esquerda.
    /// </summary>
    public class Hud
    {
        public readonly Font font;
        public readonly RectTransform canvas;
        readonly Stat[] stats = new Stat[5];
        Image searchFill;
        Text info, weapons, ammo, log, prompt, center, danger;
        GameObject searchBar;
        readonly List<(string text, float time)> lines = new List<(string, float)>();

        class Stat { public Image fill, ring, icon; public Text state, value; }

        // ---------- ícones desenhados por código (64 x 64, brancos; a cor vem da Image) ----------
        static Sprite MakeSprite(System.Func<float, float, bool> inside)
        {
            const int S = 64;
            var t = new Texture2D(S, S, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    int hits = 0;   // 2x2 amostras por pixel para suavizar a borda
                    for (int sy = 0; sy < 2; sy++) for (int sx = 0; sx < 2; sx++)
                        if (inside((x + 0.25f + sx * 0.5f) / S * 2f - 1f, (y + 0.25f + sy * 0.5f) / S * 2f - 1f)) hits++;
                    px[y * S + x] = new Color(1, 1, 1, hits / 4f);
                }
            t.SetPixels(px); t.Apply();
            return Sprite.Create(t, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f), 100f);
        }

        static bool InPoly(float x, float y, float[] p)
        {
            bool c = false;
            for (int i = 0, j = p.Length / 2 - 1; i < p.Length / 2; j = i++)
            {
                float xi = p[i * 2], yi = p[i * 2 + 1], xj = p[j * 2], yj = p[j * 2 + 1];
                if (((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
            }
            return c;
        }

        static Sprite circle, ringSprite;
        static readonly Sprite[] icons = new Sprite[5];

        static void MakeIcons()
        {
            if (circle != null) return;
            circle = MakeSprite((x, y) => x * x + y * y <= 1f);
            ringSprite = MakeSprite((x, y) => { float r = x * x + y * y; return r <= 1f && r >= 0.82f; });
            // vida: coração
            icons[0] = MakeSprite((x, y) => { float X = x * 1.25f, Y = y * 1.25f + 0.25f; float a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y <= 0; });
            // fome: garfo e faca
            icons[1] = MakeSprite((x, y) =>
                (x > -0.55f && x < -0.4f && y > -0.85f && y < 0.2f) ||
                (y > 0.05f && y < 0.25f && x > -0.78f && x < -0.17f) ||
                (y >= 0.2f && y < 0.8f && ((x > -0.78f && x < -0.66f) || (x > -0.53f && x < -0.42f) || (x > -0.29f && x < -0.17f))) ||
                (x > 0.3f && x < 0.46f && y > -0.85f && y < 0.0f) ||
                ((x - 0.42f) * (x - 0.42f) / 0.05f + (y - 0.42f) * (y - 0.42f) / 0.25f <= 1f && x > 0.2f));
            // sede: gota
            icons[2] = MakeSprite((x, y) => (x * x + (y + 0.25f) * (y + 0.25f) <= 0.36f) || InPoly(x, y, new[] { 0f, 0.85f, -0.52f, -0.05f, 0.52f, -0.05f }));
            // energia: raio
            icons[3] = MakeSprite((x, y) => InPoly(x, y, new[] { 0.15f, 0.9f, -0.5f, -0.1f, -0.05f, -0.1f, -0.2f, -0.9f, 0.5f, 0.15f, 0.05f, 0.15f }));
            // infecção: três círculos com furo no meio
            icons[4] = MakeSprite((x, y) =>
            {
                bool any = false;
                for (int k = 0; k < 3; k++)
                {
                    float a = Mathf.PI / 2 + k * Mathf.PI * 2 / 3, cx = Mathf.Cos(a) * 0.38f, cy = Mathf.Sin(a) * 0.38f;
                    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= 0.2f) any = true;
                }
                return any && x * x + y * y > 0.03f;
            });
        }

        public Hud()
        {
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var go = new GameObject("HUD");
            var c = go.AddComponent<Canvas>(); c.renderMode = RenderMode.ScreenSpaceOverlay; c.sortingOrder = 10;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution = new Vector2(1600, 900); scaler.matchWidthOrHeight = 0.5f;
            canvas = go.GetComponent<RectTransform>();

            string[] names = { "VIDA", "FOME", "SEDE", "ENERGIA", "INFECÇÃO" };
            for (int i = 0; i < 5; i++) stats[i] = MakeStat(new Vector2(22 + i * 180, -14), names[i], i);
            info = Label(new Vector2(22, -78), new Vector2(700, 80), 15, new Color(0.9f, 0.88f, 0.78f), TextAnchor.UpperLeft, new Vector2(0, 1));
            danger = Label(new Vector2(22, -136), new Vector2(500, 24), 15, new Color(0.3f, 0.48f, 0.85f), TextAnchor.UpperLeft, new Vector2(0, 1));
            log = Label(new Vector2(22, 168), new Vector2(760, 120), 16, new Color(0.91f, 0.78f, 0.29f), TextAnchor.LowerLeft, new Vector2(0, 0));
            weapons = Label(new Vector2(22, 70), new Vector2(500, 80), 18, new Color(0.9f, 0.88f, 0.78f), TextAnchor.LowerLeft, new Vector2(0, 0));
            ammo = Label(new Vector2(22, 22), new Vector2(500, 40), 28, Color.white, TextAnchor.LowerLeft, new Vector2(0, 0));
            prompt = Label(new Vector2(0, 66), new Vector2(900, 30), 17, new Color(0.9f, 0.88f, 0.78f), TextAnchor.LowerCenter, new Vector2(0.5f, 0));
            center = Label(new Vector2(0, 60), new Vector2(1000, 160), 46, new Color(0.95f, 0.93f, 0.85f), TextAnchor.MiddleCenter, new Vector2(0.5f, 0.5f));

            searchBar = new GameObject("BarraVasculhar");
            var sbt = searchBar.AddComponent<RectTransform>(); sbt.SetParent(canvas, false);
            Anchor(sbt, new Vector2(0.5f, 0), new Vector2(0, 50), new Vector2(260, 9));
            searchBar.AddComponent<Image>().color = new Color(0, 0, 0, 0.7f);
            searchFill = Fill(sbt, new Color(1f, 0.85f, 0.42f));
            searchBar.SetActive(false);
        }

        static void Anchor(RectTransform rt, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            rt.anchorMin = anchor; rt.anchorMax = anchor; rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = size;
        }

        static Image Fill(RectTransform parent, Color c)
        {
            var f = new GameObject("Cheio"); var frt = f.AddComponent<RectTransform>(); frt.SetParent(parent, false);
            frt.anchorMin = new Vector2(0, 0); frt.anchorMax = new Vector2(0, 1); frt.pivot = new Vector2(0, 0.5f); frt.anchoredPosition = Vector2.zero; frt.sizeDelta = Vector2.zero;
            var img = f.AddComponent<Image>(); img.color = c; return img;
        }

        Text Label(Vector2 pos, Vector2 size, int fontSize, Color col, TextAnchor align, Vector2 anchor)
        {
            var go = new GameObject("Texto");
            var rt = go.AddComponent<RectTransform>(); rt.SetParent(canvas, false);
            Anchor(rt, anchor, pos, size);
            var t = go.AddComponent<Text>();
            t.font = font; t.fontSize = fontSize; t.color = col; t.alignment = align; t.fontStyle = FontStyle.Bold; t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            var sh = go.AddComponent<Shadow>(); sh.effectColor = new Color(0, 0, 0, 0.95f); sh.effectDistance = new Vector2(1.5f, -1.5f);
            return t;
        }

        Image Pic(Vector2 pos, Vector2 size, Sprite sp, Color c)
        {
            var go = new GameObject("Icone"); var rt = go.AddComponent<RectTransform>(); rt.SetParent(canvas, false);
            Anchor(rt, new Vector2(0, 1), pos, size);
            var img = go.AddComponent<Image>(); img.sprite = sp; img.color = c; img.preserveAspect = true; return img;
        }

        Stat MakeStat(Vector2 pos, string name, int index)
        {
            MakeIcons();
            var s = new Stat();
            // ícone num círculo escuro com anel na cor do estado
            Pic(pos + new Vector2(0, -4), new Vector2(32, 32), circle, new Color(0, 0, 0, 0.6f));
            s.ring = Pic(pos + new Vector2(0, -4), new Vector2(32, 32), ringSprite, Color.white);
            s.icon = Pic(pos + new Vector2(7, -11), new Vector2(18, 18), icons[index], Color.white);
            s.state = Label(pos + new Vector2(38, 0), new Vector2(140, 18), 13, Color.white, TextAnchor.UpperLeft, new Vector2(0, 1));
            var bg = new GameObject("Barra"); var rt = bg.AddComponent<RectTransform>(); rt.SetParent(canvas, false);
            Anchor(rt, new Vector2(0, 1), pos + new Vector2(38, -19), new Vector2(124, 6));
            bg.AddComponent<Image>().color = new Color(0, 0, 0, 0.6f);
            s.fill = Fill(rt, Color.white);
            s.value = Label(pos + new Vector2(38, -28), new Vector2(140, 16), 11, new Color(0.79f, 0.77f, 0.68f), TextAnchor.UpperLeft, new Vector2(0, 1));
            return s;
        }

        static (string, Color) Level(float p01, float lo, float mid, string a, string b, string c)
            => p01 > mid ? (a, new Color(0.44f, 0.82f, 0.42f)) : p01 > lo ? (b, new Color(0.88f, 0.76f, 0.25f)) : (c, new Color(0.88f, 0.35f, 0.29f));

        void SetStat(int i, float v, float max, (string, Color) st)
        {
            var s = stats[i];
            s.fill.rectTransform.sizeDelta = new Vector2(124 * Mathf.Clamp01(v / max), 0);
            s.fill.color = st.Item2; s.state.color = st.Item2; s.state.text = st.Item1;
            s.ring.color = st.Item2; s.icon.color = st.Item2;
            s.value.text = $"{Mathf.Ceil(v)} / {max:0} ({Mathf.RoundToInt(100 * v / max)}%)";
        }

        public void Log(string s)
        {
            lines.Add((s, Time.time));
            if (lines.Count > 6) lines.RemoveAt(0);
        }

        public void SetPrompt(string text, float progress)
        {
            prompt.text = text ?? "";
            searchBar.SetActive(progress > 0);
            if (progress > 0) searchFill.rectTransform.sizeDelta = new Vector2(260 * Mathf.Clamp01(progress), 0);
        }

        public void SetCenter(string text) { center.text = text ?? ""; }

        public void Refresh(PlayerController p, string dangerText)
        {
            SetStat(0, p.hp, p.maxHp, Level(p.hp / p.maxHp, 0.35f, 0.7f, "SAUDÁVEL", "FERIDO", "CRÍTICO"));
            SetStat(1, p.hunger, 100, Level(p.hunger / 100f, 0.25f, 0.6f, "SATISFEITO", "COM FOME", "FAMINTO"));
            SetStat(2, p.thirst, 100, Level(p.thirst / 100f, 0.25f, 0.6f, "HIDRATADO", "COM SEDE", "DESIDRATADO"));
            SetStat(3, p.stamina, 100, p.exhausted ? ("EXAUSTO", new Color(0.88f, 0.35f, 0.29f)) : Level(p.stamina / 100f, 0.2f, 0.5f, "DESCANSADO", "CANSADO", "SEM FÔLEGO"));
            float inf = p.infect;
            SetStat(4, inf, 100, inf < 30 ? ("LIMPO", new Color(0.44f, 0.82f, 0.42f)) : inf < 70 ? ("INFECTADO", new Color(0.88f, 0.76f, 0.25f)) : inf < 100 ? ("GRAVE", new Color(0.88f, 0.35f, 0.29f)) : ("TERMINAL", new Color(1f, 0.23f, 0.18f)));
            info.text = $"SOBREVIVENTE\n${p.money} · COMIDA {p.food} (F) · ÁGUA {p.water} (G) · KIT {p.med} (H) · ANTIB. {p.anti} (I) · ABATES {p.kills}";
            if (inf >= 100) info.text += "\n<color=#ff4a3a>INFECÇÃO TERMINAL: VOCÊ PERDE VIDA · ANTIBIÓTICO (I)</color>";
            danger.text = dangerText;
            var sb = new System.Text.StringBuilder();
            for (int i = 0; i < 3; i++)
            {
                var w = p.slots[i];
                string n = w == null ? "—" : w.def.name.ToUpperInvariant();
                sb.Append(i == p.current ? $"<color=#ff6a4a>{i + 1}. {n}</color>" : $"{i + 1}. {n}").Append('\n');
            }
            weapons.text = sb.ToString();
            var cur = p.Cur;
            if (cur == null || cur.def.melee) ammo.text = "∞";
            else ammo.text = (p.ReloadProgress > 0 ? "<size=16>RECARREGANDO</size>  " : "") + $"{cur.ammo} / {p.Reserve(cur.def.ammo)}";
            var lb = new System.Text.StringBuilder();
            foreach (var (text, time) in lines) if (Time.time - time < 7f) lb.Append(text).Append('\n');
            log.text = lb.ToString();
        }
    }
}
