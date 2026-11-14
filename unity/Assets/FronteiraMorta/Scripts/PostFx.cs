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
            if (GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset urp)
            {
                urp.shadowDistance = 70f;
                urp.msaaSampleCount = 4;
            }

            var go = new GameObject("PosProcessamento");
            var vol = go.AddComponent<Volume>();
            vol.isGlobal = true; vol.priority = 10;
            var p = ScriptableObject.CreateInstance<VolumeProfile>();
            vol.sharedProfile = p;

            var tone = p.Add<Tonemapping>(true); tone.mode.Override(TonemappingMode.ACES);
            var bloom = p.Add<Bloom>(true); bloom.threshold.Override(0.95f); bloom.intensity.Override(0.9f); bloom.scatter.Override(0.65f);
            color = p.Add<ColorAdjustments>(true); color.saturation.Override(-18f); color.contrast.Override(14f); color.postExposure.Override(0.15f);
            var wb = p.Add<WhiteBalance>(true); wb.temperature.Override(-14f); wb.tint.Override(4f);
            vignette = p.Add<Vignette>(true); vignette.intensity.Override(0.38f); vignette.smoothness.Override(0.45f); vignette.color.Override(new Color(0.02f, 0.03f, 0.06f));
            var grain = p.Add<FilmGrain>(true); grain.type.Override(FilmGrainLookup.Medium1); grain.intensity.Override(0.22f);
            var lift = p.Add<LiftGammaGain>(true); lift.lift.Override(new Vector4(0.96f, 1f, 1.06f, -0.02f));
        }

        /// <summary>Vinheta vermelha quando apanha / pouca vida.</summary>
        public static void Hurt(float amount01)
        {
            if (vignette == null) return;
            vignette.color.Override(Color.Lerp(new Color(0.02f, 0.03f, 0.06f), new Color(0.45f, 0.02f, 0.02f), amount01));
            vignette.intensity.Override(Mathf.Lerp(0.38f, 0.55f, amount01));
        }
    }
}
