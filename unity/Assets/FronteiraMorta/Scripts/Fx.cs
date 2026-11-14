using UnityEngine;

namespace FronteiraMorta
{
    /// <summary>Efeitos rápidos: rastro da bala, clarão do tiro e sangue.</summary>
    public static class Fx
    {
        public static void Tracer(Vector3 a, Vector3 b)
        {
            var go = new GameObject("Rastro");
            var lr = go.AddComponent<LineRenderer>();
            lr.positionCount = 2; lr.SetPosition(0, a); lr.SetPosition(1, b);
            lr.startWidth = 0.035f; lr.endWidth = 0.015f;
            lr.sharedMaterial = Mat.Unlit(new Color(1f, 0.88f, 0.55f));
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            Object.Destroy(go, 0.05f);
        }

        public static void MuzzleFlash(Vector3 pos, Vector3 forward)
        {
            var go = new GameObject("Clarao");
            go.transform.position = pos + forward * 0.05f;
            var l = go.AddComponent<Light>();
            l.type = LightType.Point; l.range = 6f; l.intensity = 4f; l.color = new Color(1f, 0.75f, 0.4f);
            var q = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Object.Destroy(q.GetComponent<Collider>());
            q.transform.SetParent(go.transform, false); q.transform.localScale = Vector3.one * 0.12f;
            q.GetComponent<Renderer>().sharedMaterial = Mat.Unlit(new Color(1f, 0.9f, 0.6f));
            Object.Destroy(go, 0.05f);
        }

        public static void Blood(Vector3 pos, Vector3 dir)
        {
            for (int i = 0; i < 4; i++)
            {
                var b = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(b.GetComponent<Collider>());
                b.transform.position = pos + Random.insideUnitSphere * 0.15f;
                b.transform.localScale = Vector3.one * Random.Range(0.04f, 0.08f);
                b.GetComponent<Renderer>().sharedMaterial = Mat.Lit(new Color(0.45f, 0.03f, 0.03f), 0.5f);
                var rb = b.AddComponent<Rigidbody>();
                rb.linearVelocity = (dir.normalized * 2.5f + Random.insideUnitSphere * 1.5f + Vector3.up * 1.5f);
                Object.Destroy(b, 0.8f);
            }
        }

        public static void BloodPool(Vector3 pos)
        {
            var p = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Object.Destroy(p.GetComponent<Collider>());
            p.transform.position = new Vector3(pos.x, 0.02f, pos.z);
            p.transform.localScale = new Vector3(Random.Range(0.9f, 1.4f), 0.005f, Random.Range(0.9f, 1.4f));
            p.GetComponent<Renderer>().sharedMaterial = Mat.Lit(new Color(0.3f, 0.02f, 0.02f), 0.7f);
            Object.Destroy(p, 40f);
        }
    }
}
