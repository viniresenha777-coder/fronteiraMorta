using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace FronteiraMorta
{
    /// <summary>HUD feito por código: barras de vida/energia, armas, munição, log amarelo e avisos.</summary>
    public class Hud
    {
        readonly Font font;
        readonly RectTransform canvas;
        Image hpFill, stFill, searchFill;
        Text hpText, stText, info, weapons, ammo, log, prompt, center, clock;
        GameObject searchBar;
        readonly List<(string text, float time)> lines = new List<(string, float)>();

        public Hud()
        {
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var go = new GameObject("HUD");
            var c = go.AddComponent<Canvas>(); c.renderMode = RenderMode.ScreenSpaceOverlay; c.sortingOrder = 10;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution = new Vector2(1600, 900); scaler.matchWidthOrHeight = 0.5f;
            canvas = go.GetComponent<RectTransform>();

            Bar(new Vector2(24, -24), "VIDA", new Color(0.37f, 0.64f, 0.29f), out hpFill, out hpText);
            Bar(new Vector2(24, -70), "ENERGIA", new Color(0.88f, 0.76f, 0.25f), out stFill, out stText);
            info = Label(new Vector2(24, -118), new Vector2(500, 60), 16, new Color(0.9f, 0.88f, 0.78f), TextAnchor.UpperLeft, new Vector2(0, 1));
            clock = Label(new Vector2(-24, -24), new Vector2(300, 30), 18, new Color(0.9f, 0.88f, 0.78f), TextAnchor.UpperRight, new Vector2(1, 1));
            log = Label(new Vector2(24, 150), new Vector2(700, 140), 17, new Color(0.91f, 0.78f, 0.29f), TextAnchor.LowerLeft, new Vector2(0, 0));
            weapons = Label(new Vector2(24, 64), new Vector2(500, 80), 18, new Color(0.9f, 0.88f, 0.78f), TextAnchor.LowerLeft, new Vector2(0, 0));
            ammo = Label(new Vector2(24, 24), new Vector2(400, 40), 28, Color.white, TextAnchor.LowerLeft, new Vector2(0, 0));
            prompt = Label(new Vector2(0, 70), new Vector2(800, 30), 18, new Color(0.9f, 0.88f, 0.78f), TextAnchor.LowerCenter, new Vector2(0.5f, 0));
            center = Label(new Vector2(0, 40), new Vector2(1000, 120), 44, new Color(0.95f, 0.93f, 0.85f), TextAnchor.MiddleCenter, new Vector2(0.5f, 0.5f));

            searchBar = new GameObject("BarraVasculhar");
            var sbt = searchBar.AddComponent<RectTransform>(); sbt.SetParent(canvas, false);
            Anchor(sbt, new Vector2(0.5f, 0), new Vector2(0, 52), new Vector2(260, 10));
            searchBar.AddComponent<Image>().color = new Color(0, 0, 0, 0.7f);
            var f = new GameObject("Progresso"); var frt = f.AddComponent<RectTransform>(); frt.SetParent(sbt, false);
            frt.anchorMin = new Vector2(0, 0); frt.anchorMax = new Vector2(0, 1); frt.pivot = new Vector2(0, 0.5f); frt.anchoredPosition = Vector2.zero; frt.sizeDelta = new Vector2(0, 0);
            searchFill = f.AddComponent<Image>(); searchFill.color = new Color(1f, 0.85f, 0.42f);
            searchBar.SetActive(false);
        }

        static void Anchor(RectTransform rt, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            rt.anchorMin = anchor; rt.anchorMax = anchor; rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = size;
        }

        Text Label(Vector2 pos, Vector2 size, int fontSize, Color col, TextAnchor align, Vector2 anchor)
        {
            var go = new GameObject("Texto");
            var rt = go.AddComponent<RectTransform>(); rt.SetParent(canvas, false);
            Anchor(rt, anchor, pos, size);
            var t = go.AddComponent<Text>();
            t.font = font; t.fontSize = fontSize; t.color = col; t.alignment = align; t.fontStyle = FontStyle.Bold;
            t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            var sh = go.AddComponent<Shadow>(); sh.effectColor = new Color(0, 0, 0, 0.9f); sh.effectDistance = new Vector2(1.5f, -1.5f);
            return t;
        }

        void Bar(Vector2 pos, string name, Color col, out Image fill, out Text label)
        {
            var bg = new GameObject("Barra" + name); var rt = bg.AddComponent<RectTransform>(); rt.SetParent(canvas, false);
            Anchor(rt, new Vector2(0, 1), pos + new Vector2(0, -20), new Vector2(260, 14));
            bg.AddComponent<Image>().color = new Color(0, 0, 0, 0.6f);
            var f = new GameObject("Cheio"); var frt = f.AddComponent<RectTransform>(); frt.SetParent(rt, false);
            frt.anchorMin = new Vector2(0, 0); frt.anchorMax = new Vector2(0, 1); frt.pivot = new Vector2(0, 0.5f); frt.anchoredPosition = Vector2.zero; frt.sizeDelta = new Vector2(260, 0);
            fill = f.AddComponent<Image>(); fill.color = col;
            label = Label(pos, new Vector2(260, 20), 15, col, TextAnchor.UpperLeft, new Vector2(0, 1));
            label.text = name;
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

        public void Refresh(PlayerController p, string clockText, string area)
        {
            hpFill.rectTransform.sizeDelta = new Vector2(260 * p.hp / p.maxHp, 0);
            stFill.rectTransform.sizeDelta = new Vector2(260 * p.stamina / 100f, 0);
            hpText.text = $"VIDA {Mathf.CeilToInt(p.hp)} / {p.maxHp:0}";
            stText.text = p.exhausted ? "ENERGIA · EXAUSTO" : $"ENERGIA {p.stamina:0}%";
            info.text = $"${p.money} · COMIDA {p.food} · ÁGUA {p.water} · KIT {p.med} (H)\nABATES {p.kills}";
            clock.text = $"{area} · {clockText}";
            var sb = new System.Text.StringBuilder();
            for (int i = 0; i < 3; i++)
            {
                var w = p.slots[i];
                string n = w == null ? "—" : w.def.name.ToUpperInvariant();
                sb.Append(i == p.current ? $"<color=#ff6a4a>{i + 1}. {n}</color>" : $"{i + 1}. {n}").Append('\n');
            }
            weapons.supportRichText = true; weapons.text = sb.ToString();
            var cur = p.Cur;
            if (cur == null || cur.def.melee) ammo.text = "∞";
            else ammo.text = (p.ReloadProgress > 0 ? "RECARREGANDO  " : "") + $"{cur.ammo} / {p.Reserve(cur.def.ammo)}";
            var lb = new System.Text.StringBuilder();
            foreach (var (text, time) in lines) if (Time.time - time < 7f) lb.Append(text).Append('\n');
            log.text = lb.ToString();
        }
    }
}
