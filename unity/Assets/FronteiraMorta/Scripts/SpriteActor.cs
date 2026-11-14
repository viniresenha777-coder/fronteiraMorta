using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace FronteiraMorta
{
    /// <summary>
    /// Personagem desenhado com as spritesheets da versão web (8 direções x 8 quadros de 128 px),
    /// num "cartão" virado para a câmera. As folhas foram renderizadas com a câmera a 55° e rotação
    /// fixa, igual à câmera do jogo, então o desenho encaixa no mundo 3D.
    /// O quadro de 128 px cobre 2 m do mundo; o centro do quadro fica 0,62 m acima dos pés.
    /// </summary>
    public class SpriteActor : MonoBehaviour
    {
        public const float FrameMeters = 2f, CenterHeight = 0.62f;
        static readonly Dictionary<string, Material> mats = new Dictionary<string, Material>();
        static readonly Dictionary<string, Texture2D> texs = new Dictionary<string, Texture2D>();

        Transform card;
        MeshRenderer mr;
        MaterialPropertyBlock mpb;
        string sheet;
        public int Row { get; private set; }
        public int Col { get; private set; }
        public float scale = 1f;
        Color tint = Color.white;

        public static bool Available(string name) => Load(name) != null;

        static Texture2D Load(string name)
        {
            if (texs.TryGetValue(name, out var t)) return t;
            t = Resources.Load<Texture2D>("Sprites/" + name);
            if (t != null) { t.wrapMode = TextureWrapMode.Clamp; t.filterMode = FilterMode.Bilinear; }
            texs[name] = t;
            return t;
        }

        static Material MaterialFor(string name)
        {
            if (mats.TryGetValue(name, out var m)) return m;
            var tex = Load(name);
            bool urp = GraphicsSettings.currentRenderPipeline != null;
            var sh = urp ? Shader.Find("Universal Render Pipeline/Lit") : Shader.Find("Standard");
            m = new Material(sh) { name = "Sprite " + name };
            if (urp)
            {
                // transparente com luz (escurece à noite, recebe a lanterna)
                m.SetFloat("_Surface", 1f); m.SetFloat("_Blend", 0f);
                m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha); m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
                if (m.HasProperty("_SrcBlendAlpha")) { m.SetFloat("_SrcBlendAlpha", (float)BlendMode.One); m.SetFloat("_DstBlendAlpha", (float)BlendMode.OneMinusSrcAlpha); }
                m.SetFloat("_ZWrite", 0f); m.SetFloat("_Cull", 0f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.renderQueue = (int)RenderQueue.Transparent;
                m.SetTexture("_BaseMap", tex); m.SetColor("_BaseColor", Color.white);
                m.SetFloat("_Smoothness", 0f); m.SetFloat("_Metallic", 0f);
                m.SetFloat("_ReceiveShadows", 1f);
            }
            else
            {
                m.SetFloat("_Mode", 2); m.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha); m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0); m.EnableKeyword("_ALPHABLEND_ON"); m.renderQueue = 3000;
                m.mainTexture = tex; m.SetFloat("_Glossiness", 0f);
            }
            mats[name] = m;
            return m;
        }

        public void Init(string sheetName, float size = 1f)
        {
            scale = size;
            var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(q.GetComponent<Collider>());
            q.name = "Cartao";
            card = q.transform;
            card.SetParent(transform, false);
            mr = q.GetComponent<MeshRenderer>();
            mr.shadowCastingMode = ShadowCastingMode.Off;
            mpb = new MaterialPropertyBlock();
            SetSheet(sheetName);
        }

        public void SetSheet(string name)
        {
            if (name == sheet) return;
            sheet = name;
            mr.sharedMaterial = MaterialFor(name);
        }

        public void SetTint(Color c) { tint = c; }

        /// <summary>Direção na tela pelo ângulo (graus, 0 = norte/+Z, horário).</summary>
        public static int RowFromYaw(float yawDeg) => ((Mathf.RoundToInt(yawDeg / 45f) % 8) + 8) % 8;

        public void SetFrame(int row, int col) { Row = row; Col = col; }

        /// <summary>Plano do cartão: virado para a câmera.</summary>
        public Quaternion Facing(Camera cam) => cam.transform.rotation;

        public Vector3 Center => transform.position + Vector3.up * CenterHeight * scale;

        /// <summary>Ponto da folha (px 0..128 do quadro) para o mundo, no plano do cartão.</summary>
        public Vector3 SheetToWorld(Camera cam, float px, float py, float toCamera = 0f)
        {
            float x = (px / 128f - 0.5f) * FrameMeters * scale, y = (0.5f - py / 128f) * FrameMeters * scale;
            var t = cam.transform;
            return Center + t.right * x + t.up * y - t.forward * toCamera;
        }

        public void Draw(Camera cam)
        {
            if (cam == null || card == null) return;
            card.position = Center;
            card.rotation = Facing(cam);
            card.localScale = new Vector3(FrameMeters * scale, FrameMeters * scale, 1f);
            // recorta o quadro certo (UV com origem embaixo à esquerda)
            mr.GetPropertyBlock(mpb);
            var st = new Vector4(1f / 8f, 1f / 8f, Col / 8f, (7 - Row) / 8f);
            mpb.SetVector("_BaseMap_ST", st);
            mpb.SetVector("_MainTex_ST", st);
            mpb.SetColor("_BaseColor", tint);
            mpb.SetColor("_Color", tint);
            mr.SetPropertyBlock(mpb);
        }

        public void Lie(float t01)
        {
            // morto: o cartão deita no chão
            if (card == null) return;
            card.rotation = Quaternion.Euler(Mathf.Lerp(55f, 90f, t01), 0, 0);
            card.position = transform.position + Vector3.up * Mathf.Lerp(CenterHeight, 0.05f, t01) * scale;
        }
    }
}
