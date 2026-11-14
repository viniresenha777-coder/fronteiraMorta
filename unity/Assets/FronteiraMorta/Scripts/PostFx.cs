using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace FronteiraMorta
{
    /// <summary>Pós-processamento do URP montado por código: cor de cinema, bloom, vinheta e granulado.</summary>
    public static class PostFx
    {
        public static Vignette vignette;
        public static ColorAdjustments color;

        public static void Setup(Camera cam)
        {
            var data = cam.GetUniversalAdditionalCameraData();
            if (data != null) { data.renderPostProcessing = true; data.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing; }
            // (não mexe mais nas configurações do projeto: sombras e antisserrilhado ficam como estão)

            var go = new GameObject("PosProcessamento");
            var vol = go.AddComponent<Volume>();
            vol.isGlobal = true; vol.priority = 10;
            var p = ScriptableObject.CreateInstance<VolumeProfile>();
            vol.sharedProfile = p;

            var tone = p.Add<Tonemapping>(true); tone.mode.Override(TonemappingMode.Neutral);
            var bloom = p.Add<Bloom>(true); bloom.threshold.Override(1.05f); bloom.intensity.Override(0.55f); bloom.scatter.Override(0.6f);
            color = p.Add<ColorAdjustments>(true); color.saturation.Override(-6f); color.contrast.Override(8f); color.postExposure.Override(0.35f);
            var wb = p.Add<WhiteBalance>(true); wb.temperature.Override(-8f);
            vignette = p.Add<Vignette>(true); vignette.intensity.Override(0.3f); vignette.smoothness.Override(0.45f); vignette.color.Override(new Color(0.02f, 0.03f, 0.06f));
            var grain = p.Add<FilmGrain>(true); grain.type.Override(FilmGrainLookup.Thin1); grain.intensity.Override(0.12f);
        }

        /// <summary>Vinheta vermelha quando apanha / pouca vida.</summary>
        public static void Hurt(float amount01)
        {
            if (vignette == null) return;
            vignette.color.Override(Color.Lerp(new Color(0.02f, 0.03f, 0.06f), new Color(0.45f, 0.02f, 0.02f), amount01));
            vignette.intensity.Override(Mathf.Lerp(0.3f, 0.5f, amount01));
        }
    }
}
