using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UI;

namespace FronteiraMorta
{
    /// <summary>
    /// Minimapa (canto superior direito) e mapa grande da área (tecla M).
    /// Uma câmera de cima desenha numa textura; marcadores ficam numa camada só dela (camada 30).
    /// </summary>
    public class Minimap : MonoBehaviour
    {
        public const int MarkerLayer = 30;
        Camera mapCam, mainCam;
        RenderTexture rt;
        RectTransform frame;
        RawImage img;
        Text title, sub;
        Transform player;
        bool big;

        public static GameObject Marker(Transform follow, Color c, float size, bool arrow = false)
        {
            var m = GameObject.CreatePrimitive(arrow ? PrimitiveType.Cube : PrimitiveType.Sphere);
            Object.Destroy(m.GetComponent<Collider>());
            m.name = "Marcador";
            m.layer = MarkerLayer;
            m.transform.SetParent(follow, false);
            m.transform.localPosition = new Vector3(0, 24f, 0);
            m.transform.localScale = arrow ? new Vector3(size * 0.7f, 0.2f, size * 1.4f) : new Vector3(size, 0.2f, size);
            var r = m.GetComponent<Renderer>();
            r.sharedMaterial = Mat.Unlit(c);
            r.shadowCastingMode = ShadowCastingMode.Off; r.receiveShadows = false;
            if (arrow)
            {
                var tip = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(tip.GetComponent<Collider>());
                tip.layer = MarkerLayer;
                tip.transform.SetParent(m.transform, false);
                tip.transform.localPosition = new Vector3(0, 0, 0.55f);
                tip.transform.localRotation = Quaternion.Euler(0, 45, 0);
                tip.transform.localScale = new Vector3(0.9f, 1f, 0.9f);
                tip.GetComponent<Renderer>().sharedMaterial = Mat.Unlit(c);
            }
            return m;
        }

        public void Init(Camera main, Transform target, RectTransform canvas, Font font)
        {
            mainCam = main; player = target;
            mainCam.cullingMask &= ~(1 << MarkerLayer);
            rt = new RenderTexture(512, 512, 16) { name = "Minimapa" };
            var cg = new GameObject("CameraMapa");
            mapCam = cg.AddComponent<Camera>();
            mapCam.orthographic = true; mapCam.orthographicSize = 32f;
            mapCam.transform.rotation = Quaternion.Euler(90, 0, 0);
            mapCam.clearFlags = CameraClearFlags.SolidColor; mapCam.backgroundColor = new Color(0.05f, 0.06f, 0.08f);
            mapCam.targetTexture = rt; mapCam.depth = -10; mapCam.farClipPlane = 120f;
            // o mapa não usa neblina nem pós-processamento
            RenderPipelineManager.beginCameraRendering += OnBegin;
            RenderPipelineManager.endCameraRendering += OnEnd;

            var fgo = new GameObject("Minimapa");
            frame = fgo.AddComponent<RectTransform>(); frame.SetParent(canvas, false);
            fgo.AddComponent<Image>().color = new Color(0.55f, 0.2f, 0.16f, 0.9f);
            var ig = new GameObject("Imagem"); var irt = ig.AddComponent<RectTransform>(); irt.SetParent(frame, false);
            irt.anchorMin = Vector2.zero; irt.anchorMax = Vector2.one; irt.offsetMin = new Vector2(3, 3); irt.offsetMax = new Vector2(-3, -3);
            img = ig.AddComponent<RawImage>(); img.texture = rt; img.color = new Color(1, 1, 1, 0.92f);
            title = MakeText(canvas, font, 14, TextAnchor.LowerCenter);
            sub = MakeText(canvas, font, 13, TextAnchor.UpperCenter);
            Layout();
        }

        static Text MakeText(RectTransform canvas, Font font, int size, TextAnchor a)
        {
            var go = new GameObject("TextoMapa"); var rt = go.AddComponent<RectTransform>(); rt.SetParent(canvas, false);
            var t = go.AddComponent<Text>(); t.font = font; t.fontSize = size; t.fontStyle = FontStyle.Bold; t.alignment = a;
            t.color = new Color(0.9f, 0.88f, 0.78f); t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            var sh = go.AddComponent<Shadow>(); sh.effectColor = Color.black; sh.effectDistance = new Vector2(1, -1);
            return t;
        }

        void Layout()
        {
            Vector2 a = big ? new Vector2(0.5f, 0.5f) : new Vector2(1, 1);
            Vector2 size = big ? new Vector2(700, 700) : new Vector2(230, 230);
            Vector2 pos = big ? Vector2.zero : new Vector2(-22, -40);
            frame.anchorMin = a; frame.anchorMax = a; frame.pivot = a; frame.anchoredPosition = pos; frame.sizeDelta = size;
            foreach (var (t, dy, top) in new[] { (title, 6f, true), (sub, -6f, false) })
            {
                var r = t.rectTransform;
                r.anchorMin = a; r.anchorMax = a; r.pivot = top ? new Vector2(a.x == 1 ? 1 : 0.5f, 0) : new Vector2(a.x == 1 ? 1 : 0.5f, 1);
                r.sizeDelta = new Vector2(size.x, 20);
                r.anchoredPosition = top ? pos + new Vector2(0, big ? size.y / 2 + dy : dy) : pos + new Vector2(0, big ? -size.y / 2 + dy : -size.y + dy);
            }
        }

        void OnBegin(ScriptableRenderContext ctx, Camera c) { if (c == mapCam) RenderSettings.fog = false; }
        void OnEnd(ScriptableRenderContext ctx, Camera c) { if (c == mapCam) RenderSettings.fog = true; }

        void OnDestroy()
        {
            RenderPipelineManager.beginCameraRendering -= OnBegin;
            RenderPipelineManager.endCameraRendering -= OnEnd;
        }

        public void SetTexts(string area, string info) { title.text = area; sub.text = info; }

        void LateUpdate()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.mKey.wasPressedThisFrame) { big = !big; Layout(); }
            if (player == null) return;
            if (big)
            {
                mapCam.orthographicSize = Mathf.Max(CityBuilder.W, CityBuilder.H) / 2f + 6f;
                mapCam.transform.position = new Vector3(CityBuilder.W / 2f, 70f, CityBuilder.H / 2f);
            }
            else
            {
                mapCam.orthographicSize = 32f;
                mapCam.transform.position = new Vector3(player.position.x, 70f, player.position.z);
            }
        }
    }
}
