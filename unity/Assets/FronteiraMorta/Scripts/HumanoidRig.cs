using UnityEngine;

namespace FronteiraMorta
{
    /// <summary>Cores do corpo (sobrevivente ou zumbi).</summary>
    public class BodyLook
    {
        public Color jacket, jacketDark, vest, pants, boots, skin, head;
        public bool backpack, beanie, zombie, hazmat;
        public float scale = 1f;

        public static BodyLook Survivor() => new BodyLook
        {
            jacket = new Color(0.27f, 0.29f, 0.19f), jacketDark = new Color(0.19f, 0.21f, 0.13f), vest = new Color(0.2f, 0.19f, 0.16f),
            pants = new Color(0.29f, 0.26f, 0.2f), boots = new Color(0.09f, 0.08f, 0.07f), skin = new Color(0.62f, 0.47f, 0.38f),
            head = new Color(0.12f, 0.13f, 0.15f), backpack = true, beanie = true
        };

        public static BodyLook Zombie(Color shirt, bool hazmat = false, float scale = 1f) => new BodyLook
        {
            jacket = shirt, jacketDark = shirt * 0.8f, vest = new Color(0.3f, 0.04f, 0.04f), pants = hazmat ? shirt : new Color(0.17f, 0.16f, 0.15f),
            boots = new Color(0.1f, 0.09f, 0.08f), skin = hazmat ? shirt : new Color(0.36f, 0.43f, 0.29f),
            head = hazmat ? new Color(0.08f, 0.08f, 0.09f) : new Color(0.08f, 0.07f, 0.06f), zombie = true, hazmat = hazmat, scale = scale
        };
    }

    /// <summary>
    /// Corpo humano feito de peças (o pivô de cada peça fica na articulação) com caminhada procedural
    /// e poses de braço por tipo de arma. Os pés ficam em y = 0 e a frente é +Z.
    /// </summary>
    public class HumanoidRig : MonoBehaviour
    {
        public Transform hips, torso, head, gunMount;
        public Transform[] shoulder = new Transform[2], elbow = new Transform[2], handTip = new Transform[2];
        public Transform[] thigh = new Transform[2], knee = new Transform[2];
        public float phase;
        float bob;

        static Transform Pivot(Transform parent, string name, Vector3 local)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent, false);
            t.localPosition = local;
            return t;
        }

        static Transform Part(Transform parent, PrimitiveType type, Vector3 local, Vector3 scale, Material m, Vector3? euler = null)
        {
            var go = GameObject.CreatePrimitive(type);
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.transform.localScale = scale;
            if (euler.HasValue) go.transform.localEulerAngles = euler.Value;
            go.GetComponent<Renderer>().sharedMaterial = m;
            return go.transform;
        }

        public static HumanoidRig Build(Transform parent, BodyLook look)
        {
            var root = new GameObject("Corpo").transform;
            root.SetParent(parent, false);
            root.localScale = Vector3.one * look.scale;
            var rig = root.gameObject.AddComponent<HumanoidRig>();
            Material mJ = Mat.Lit(look.jacket), mJd = Mat.Lit(look.jacketDark), mV = Mat.Lit(look.vest), mP = Mat.Lit(look.pants);
            Material mB = Mat.Lit(look.boots, 0.35f), mS = Mat.Lit(look.skin), mH = Mat.Lit(look.head);

            rig.hips = Pivot(root, "Quadril", new Vector3(0, 0.95f, 0));
            Part(rig.hips, PrimitiveType.Cube, new Vector3(0, 0.02f, 0), new Vector3(0.36f, 0.2f, 0.24f), mP);
            for (int i = 0; i < 2; i++)
            {
                float s = i == 0 ? -1 : 1;
                rig.thigh[i] = Pivot(rig.hips, "Coxa", new Vector3(0.11f * s, -0.04f, 0));
                Part(rig.thigh[i], PrimitiveType.Cube, new Vector3(0, -0.22f, 0), new Vector3(0.16f, 0.44f, 0.17f), mP);
                rig.knee[i] = Pivot(rig.thigh[i], "Joelho", new Vector3(0, -0.44f, 0));
                Part(rig.knee[i], PrimitiveType.Cube, new Vector3(0, -0.2f, 0), new Vector3(0.14f, 0.4f, 0.15f), mP);
                Part(rig.knee[i], PrimitiveType.Cube, new Vector3(0, -0.42f, 0.05f), new Vector3(0.15f, 0.09f, 0.27f), mB);
            }

            rig.torso = Pivot(rig.hips, "Tronco", new Vector3(0, 0.06f, 0));
            Part(rig.torso, PrimitiveType.Cube, new Vector3(0, 0.3f, 0), new Vector3(0.44f, 0.56f, 0.26f), mJ);
            if (!look.zombie) Part(rig.torso, PrimitiveType.Cube, new Vector3(0, 0.28f, 0.02f), new Vector3(0.4f, 0.38f, 0.28f), mV);
            else if (!look.hazmat) Part(rig.torso, PrimitiveType.Cube, new Vector3(0.06f, 0.32f, 0.13f), new Vector3(0.14f, 0.16f, 0.02f), mV); // sangue
            if (look.backpack)
            {
                Part(rig.torso, PrimitiveType.Cube, new Vector3(0, 0.3f, -0.21f), new Vector3(0.34f, 0.42f, 0.17f), Mat.Lit(new Color(0.4f, 0.32f, 0.21f)));
                Part(rig.torso, PrimitiveType.Cylinder, new Vector3(0, 0.6f, -0.2f), new Vector3(0.14f, 0.18f, 0.14f), Mat.Lit(new Color(0.27f, 0.33f, 0.36f)), new Vector3(0, 0, 90));
            }
            rig.head = Pivot(rig.torso, "Cabeca", new Vector3(0, 0.62f, look.zombie ? 0.05f : 0));
            Part(rig.head, PrimitiveType.Cylinder, new Vector3(0, 0.02f, 0), new Vector3(0.11f, 0.06f, 0.11f), mS);
            Part(rig.head, PrimitiveType.Sphere, new Vector3(0, 0.14f, 0.01f), new Vector3(0.22f, 0.26f, 0.24f), mS);
            if (look.beanie) Part(rig.head, PrimitiveType.Sphere, new Vector3(0, 0.21f, -0.005f), new Vector3(0.235f, 0.17f, 0.25f), mH);
            else if (look.hazmat) Part(rig.head, PrimitiveType.Cube, new Vector3(0, 0.15f, 0.11f), new Vector3(0.17f, 0.1f, 0.05f), Mat.Lit(new Color(0.2f, 0.3f, 0.26f), 0.8f));
            else Part(rig.head, PrimitiveType.Sphere, new Vector3(0, 0.22f, -0.03f), new Vector3(0.2f, 0.1f, 0.2f), mH);
            if (look.zombie && !look.hazmat)
                for (int i = 0; i < 2; i++)
                    Part(rig.head, PrimitiveType.Sphere, new Vector3(i == 0 ? -0.05f : 0.05f, 0.16f, 0.12f), new Vector3(0.035f, 0.035f, 0.02f), Mat.Emissive(new Color(0.9f, 0.85f, 0.4f), 0.6f));

            for (int i = 0; i < 2; i++)
            {
                float s = i == 0 ? -1 : 1;
                rig.shoulder[i] = Pivot(rig.torso, "Ombro", new Vector3(0.26f * s, 0.53f, 0));
                Part(rig.shoulder[i], PrimitiveType.Sphere, Vector3.zero, Vector3.one * 0.15f, mJ);
                Part(rig.shoulder[i], PrimitiveType.Cube, new Vector3(0, -0.16f, 0), new Vector3(0.12f, 0.32f, 0.12f), mJ);
                rig.elbow[i] = Pivot(rig.shoulder[i], "Cotovelo", new Vector3(0, -0.32f, 0));
                Part(rig.elbow[i], PrimitiveType.Cube, new Vector3(0, -0.15f, 0), new Vector3(0.1f, 0.3f, 0.1f), look.hazmat ? mJ : look.zombie ? mS : mJd);
                Part(rig.elbow[i], PrimitiveType.Sphere, new Vector3(0, -0.32f, 0), Vector3.one * 0.1f, mS);
                rig.handTip[i] = Pivot(rig.elbow[i], "Mao", new Vector3(0, -0.33f, 0));
            }
            rig.gunMount = Pivot(rig.torso, "Arma", new Vector3(0.12f, 0.4f, 0.28f));
            return rig;
        }

        static float Lerp(float a, float b, float t) => a + (b - a) * t;

        /// <summary>
        /// move01 = 0 parado .. 1 andando; stride = quanto avança a passada por segundo;
        /// attack = 0..1 durante um golpe (ou o tranco do tiro); lean = inclinação do tronco (graus).
        /// </summary>
        public void Animate(float dt, float move01, float stride, ArmPose pose, float attack, bool zombie, float lean, float limp = 1f)
        {
            phase += dt * stride * Mathf.Max(0.15f, move01);
            float s = Mathf.Sin(phase) * move01, c = Mathf.Cos(phase);
            float amp = zombie ? 26f : 32f;
            thigh[0].localEulerAngles = new Vector3(-s * amp * limp, 0, 0);
            thigh[1].localEulerAngles = new Vector3(s * amp, 0, 0);
            knee[0].localEulerAngles = new Vector3(Mathf.Max(0, c) * 45f * move01 * limp + 4, 0, 0);
            knee[1].localEulerAngles = new Vector3(Mathf.Max(0, -c) * 45f * move01 + 4, 0, 0);
            bob = Mathf.Cos(phase * 2f) * 0.03f * move01;
            hips.localPosition = new Vector3(0, 0.95f + bob, 0);
            torso.localEulerAngles = new Vector3(lean, Mathf.Sin(phase) * 7f * move01, zombie ? Mathf.Sin(phase * 0.5f) * 4f : 0);

            // braços: [0] = esquerdo, [1] = direito (ângulos negativos levantam para a frente)
            Vector3 sL, sR; float eL, eR;
            float swingArm = s * 25f;
            if (zombie)
            {
                float wob = Mathf.Sin(phase * 0.7f) * 6f;
                sL = new Vector3(-82 + wob, 0, 6); sR = new Vector3(-86 - wob, 0, -6); eL = -10; eR = -14;
            }
            else switch (pose)
            {
                case ArmPose.Long: sL = new Vector3(-70, -30, 0); sR = new Vector3(-40, 10, 0); eL = -35; eR = -75; break;
                case ArmPose.Heavy: sL = new Vector3(-45, -25, 0); sR = new Vector3(-15, 0, 0); eL = -50; eR = -80; break;
                case ArmPose.Pistol: sL = new Vector3(-84, -20, 0); sR = new Vector3(-86, 14, 0); eL = -8; eR = -4; break;
                case ArmPose.Melee:
                    sL = new Vector3(swingArm, 0, 6); eL = -12;
                    if (attack > 0) { float t = 1f - attack; sR = new Vector3(Lerp(-170, -30, t), Lerp(-10, 40, t), Lerp(30, -10, t)); eR = Lerp(-60, -5, t); }
                    else { sR = new Vector3(-35, 0, -8); eR = -55; }
                    break;
                default: // punhos
                    sL = new Vector3(-55, -12, 0); eL = -95;
                    if (attack > 0) { sR = new Vector3(-88, 8, 0); eR = -8; } else { sR = new Vector3(-55, 12, 0); eR = -95; }
                    break;
            }
            shoulder[0].localEulerAngles = sL; shoulder[1].localEulerAngles = sR;
            elbow[0].localEulerAngles = new Vector3(eL, 0, 0); elbow[1].localEulerAngles = new Vector3(eR, 0, 0);
        }
    }
}
