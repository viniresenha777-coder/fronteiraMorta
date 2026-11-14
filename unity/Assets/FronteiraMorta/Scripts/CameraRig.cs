using UnityEngine;
using UnityEngine.InputSystem;

namespace FronteiraMorta
{
    /// <summary>Câmera aérea inclinada (~55°), rotação fixa, seguindo o jogador com suavização.</summary>
    public class CameraRig : MonoBehaviour
    {
        public Transform target;
        public float pitch = 55f, distance = 16f, fov = 38f, lookAhead = 0.12f, smooth = 6f;
        static float shake;
        Camera cam;
        Vector3 pos;

        public static void Shake(float amount) { shake = Mathf.Max(shake, amount); }

        public void Init(Camera c, Transform t)
        {
            cam = c; target = t;
            cam.fieldOfView = fov; cam.nearClipPlane = 0.3f; cam.farClipPlane = 200f;
            cam.transform.rotation = Quaternion.Euler(pitch, 0, 0);
            pos = Desired(); cam.transform.position = pos;
        }

        Vector3 Desired()
        {
            Vector3 focus = target.position;
            var m = Mouse.current;
            if (m != null && Screen.width > 0)
            {
                // olha um pouco para onde o mouse está
                Vector2 mp = m.position.ReadValue();
                float ox = (mp.x / Screen.width - 0.5f) * 2f, oz = (mp.y / Screen.height - 0.5f) * 2f;
                focus += new Vector3(ox, 0, oz) * distance * lookAhead;
            }
            return focus - Quaternion.Euler(pitch, 0, 0) * Vector3.forward * distance;
        }

        void LateUpdate()
        {
            if (target == null || cam == null) return;
            pos = Vector3.Lerp(pos, Desired(), 1f - Mathf.Exp(-smooth * Time.deltaTime));
            Vector3 jitter = shake > 0 ? Random.insideUnitSphere * shake : Vector3.zero;
            shake = Mathf.Max(0, shake - Time.deltaTime * 1.5f);
            cam.transform.position = pos + jitter;
            cam.transform.rotation = Quaternion.Euler(pitch, 0, 0);
        }
    }
}
