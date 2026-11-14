using System.Collections.Generic;
using UnityEngine;

namespace FronteiraMorta
{
    public enum WeaponLook { Fists, Knife, Machete, Bat, Axe, Katana, Pistol, Revolver, Smg, Rifle, Ar, Shotgun, Lmg }
    public enum ArmPose { Fists, Melee, Pistol, Long, Heavy }

    /// <summary>Dados de uma arma (valores vindos da versão web, convertidos para metros/segundos).</summary>
    public class WeaponDef
    {
        public string id, name, ammo;
        public WeaponLook look;
        public bool melee;
        public float damage, delay, reload, spread, range, length;
        public int mag, pellets = 1, rarity;
        public Color color = new Color(0.15f, 0.15f, 0.16f);
        public bool wood;

        public ArmPose Pose
        {
            get
            {
                switch (look)
                {
                    case WeaponLook.Fists: return ArmPose.Fists;
                    case WeaponLook.Pistol: case WeaponLook.Revolver: return ArmPose.Pistol;
                    case WeaponLook.Lmg: return ArmPose.Heavy;
                    default: return melee ? ArmPose.Melee : ArmPose.Long;
                }
            }
        }
    }

    public class WeaponInst
    {
        public WeaponDef def;
        public int ammo;
        public WeaponInst(WeaponDef d) { def = d; ammo = d.mag; }
    }

    public static class Weapons
    {
        public static readonly Dictionary<string, WeaponDef> All = new Dictionary<string, WeaponDef>();
        public static readonly Dictionary<string, Color> RarityColor = new Dictionary<string, Color>();

        static WeaponDef Add(string id, string name, WeaponLook look, float dmg, float delay, int mag, float reload, string ammo,
                             float spread, float range, float length, int rarity = 0, int pellets = 1, bool wood = false, Color? color = null)
        {
            var d = new WeaponDef
            {
                id = id, name = name, look = look, damage = dmg, delay = delay, mag = mag, reload = reload, ammo = ammo,
                spread = spread, range = range, length = length, rarity = rarity, pellets = pellets, wood = wood,
                melee = look == WeaponLook.Fists || look == WeaponLook.Knife || look == WeaponLook.Machete ||
                        look == WeaponLook.Bat || look == WeaponLook.Axe || look == WeaponLook.Katana
            };
            if (color.HasValue) d.color = color.Value;
            All[id] = d;
            return d;
        }

        static Weapons()
        {
            // corpo a corpo: dano, intervalo (s), alcance (m)
            Add("punhos", "Punhos", WeaponLook.Fists, 8, 0.45f, 0, 0, "", 0, 1.2f, 0);
            Add("faca", "Faca", WeaponLook.Knife, 16, 0.35f, 0, 0, "", 0, 1.5f, 0.3f, color: new Color(0.8f, 0.82f, 0.85f));
            Add("facao", "Facão", WeaponLook.Machete, 24, 0.5f, 0, 0, "", 0, 1.8f, 0.55f, color: new Color(0.75f, 0.76f, 0.78f));
            Add("taco", "Taco de beisebol", WeaponLook.Bat, 22, 0.6f, 0, 0, "", 0, 1.9f, 0.8f, wood: true, color: new Color(0.55f, 0.38f, 0.22f));
            Add("machado", "Machado", WeaponLook.Axe, 34, 0.8f, 0, 0, "", 0, 1.9f, 0.75f, 1, color: new Color(0.6f, 0.62f, 0.65f));
            Add("katana", "Katana", WeaponLook.Katana, 40, 0.45f, 0, 0, "", 0, 2.1f, 0.95f, 2, color: new Color(0.85f, 0.87f, 0.9f));
            // armas de fogo: dano por bala, intervalo (s), pente, recarga (s), munição, dispersão (graus), alcance (m), comprimento (m)
            Add("pistola", "Pistola 9mm", WeaponLook.Pistol, 20, 0.3f, 12, 1.0f, "9mm", 3f, 30, 0.22f);
            Add("colt", "Colt .45", WeaponLook.Pistol, 28, 0.38f, 8, 1.2f, ".45", 2.5f, 32, 0.24f);
            Add("revolver", "Revólver .357", WeaponLook.Revolver, 45, 0.6f, 6, 2.0f, ".357", 2f, 34, 0.27f, 1);
            Add("mp5", "MP5", WeaponLook.Smg, 16, 0.08f, 30, 1.8f, "9mm", 5f, 28, 0.5f, 1);
            Add("ak47", "AK-47", WeaponLook.Ar, 30, 0.11f, 30, 2.2f, "7.62", 4f, 40, 0.85f, 2, wood: true);
            Add("m4", "M4", WeaponLook.Ar, 27, 0.09f, 30, 2.0f, "5.56", 3f, 42, 0.82f, 2);
            Add("canoduplo", "Cano Duplo", WeaponLook.Shotgun, 26, 0.35f, 2, 1.5f, "cartucho", 14f, 16, 0.95f, 0, 6, true);
            Add("escopeta", "Escopeta", WeaponLook.Shotgun, 22, 0.8f, 6, 2.2f, "cartucho", 12f, 18, 0.95f, 1, 5, true);
            Add("caca", "Rifle de Caça", WeaponLook.Rifle, 90, 1.1f, 5, 2.4f, "7.62", 0.8f, 60, 1.0f, 2, wood: true);
            Add("m60", "M60", WeaponLook.Lmg, 32, 0.09f, 100, 4.5f, "7.62", 5f, 45, 1.0f, 3);
        }

        public static Color RarityTint(int r)
        {
            switch (r)
            {
                case 1: return new Color(0.44f, 0.82f, 0.42f);
                case 2: return new Color(0.29f, 0.64f, 1f);
                case 3: return new Color(0.7f, 0.42f, 1f);
                case 4: return new Color(1f, 0.69f, 0.19f);
                default: return new Color(0.79f, 0.77f, 0.71f);
            }
        }

        // ---------- modelo 3D (caixas) ----------
        static Transform Box(Transform parent, Vector3 pos, Vector3 size, Material m)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            go.GetComponent<Renderer>().sharedMaterial = m;
            return go.transform;
        }

        /// <summary>
        /// Monta a arma ao longo de +Z a partir da empunhadura (0,0,0). Devolve a ponta do cano
        /// (para as balas) e preenche o objeto passado.
        /// </summary>
        public static Transform BuildModel(WeaponDef d, Transform root)
        {
            var metal = Mat.Lit(d.color, 0.45f);
            var dark = Mat.Lit(new Color(0.08f, 0.08f, 0.09f), 0.4f);
            var wood = Mat.Lit(new Color(0.42f, 0.25f, 0.12f), 0.2f);
            float L = d.length;
            var tip = new GameObject("Ponta").transform;
            tip.SetParent(root, false);
            switch (d.look)
            {
                case WeaponLook.Fists:
                    tip.localPosition = Vector3.zero; break;
                case WeaponLook.Knife:
                case WeaponLook.Machete:
                case WeaponLook.Katana:
                    Box(root, new Vector3(0, 0, -0.06f), new Vector3(0.03f, 0.03f, 0.14f), dark);
                    Box(root, new Vector3(0, 0, 0.02f), new Vector3(0.07f, 0.02f, 0.02f), Mat.Lit(new Color(0.75f, 0.6f, 0.2f), 0.5f));
                    Box(root, new Vector3(0, 0, L / 2f + 0.02f), new Vector3(0.012f, d.look == WeaponLook.Machete ? 0.06f : 0.035f, L), metal);
                    tip.localPosition = new Vector3(0, 0, L); break;
                case WeaponLook.Bat:
                    Box(root, new Vector3(0, 0, L / 2f - 0.1f), new Vector3(0.045f, 0.045f, L), wood);
                    Box(root, new Vector3(0, 0, L - 0.2f), new Vector3(0.07f, 0.07f, 0.35f), wood);
                    tip.localPosition = new Vector3(0, 0, L); break;
                case WeaponLook.Axe:
                    Box(root, new Vector3(0, 0, L / 2f - 0.1f), new Vector3(0.04f, 0.04f, L), wood);
                    Box(root, new Vector3(0, 0.07f, L - 0.12f), new Vector3(0.02f, 0.16f, 0.12f), metal);
                    tip.localPosition = new Vector3(0, 0, L); break;
                case WeaponLook.Pistol:
                case WeaponLook.Revolver:
                    Box(root, new Vector3(0, -0.05f, -0.01f), new Vector3(0.035f, 0.1f, 0.04f), dark);
                    Box(root, new Vector3(0, 0.02f, L / 2f - 0.03f), new Vector3(0.035f, 0.05f, L), metal);
                    if (d.look == WeaponLook.Revolver) Box(root, new Vector3(0, 0.02f, 0.03f), new Vector3(0.05f, 0.05f, 0.05f), dark);
                    tip.localPosition = new Vector3(0, 0.02f, L - 0.03f); break;
                default: // armas longas e pesadas
                    float stock = d.look == WeaponLook.Smg ? 0.12f : 0.25f;
                    Box(root, new Vector3(0, -0.01f, -stock / 2f), new Vector3(0.045f, 0.08f, stock), d.wood ? wood : dark);
                    Box(root, new Vector3(0, 0.01f, L * 0.25f), new Vector3(0.05f, 0.07f, L * 0.5f), metal);
                    Box(root, new Vector3(0, 0.015f, L * 0.72f), new Vector3(0.022f, 0.022f, L * 0.56f), dark);
                    if (d.look != WeaponLook.Shotgun && d.look != WeaponLook.Rifle)
                        Box(root, new Vector3(0, -0.07f, L * 0.22f), new Vector3(0.035f, 0.1f, 0.05f), dark);   // pente
                    if (d.look == WeaponLook.Rifle) Box(root, new Vector3(0, 0.07f, L * 0.3f), new Vector3(0.03f, 0.03f, 0.2f), dark); // luneta
                    if (d.look == WeaponLook.Shotgun) Box(root, new Vector3(0, -0.02f, L * 0.62f), new Vector3(0.045f, 0.04f, 0.16f), wood);
                    if (d.look == WeaponLook.Lmg) Box(root, new Vector3(0.05f, -0.06f, L * 0.25f), new Vector3(0.08f, 0.09f, 0.12f), dark);
                    tip.localPosition = new Vector3(0, 0.015f, L);
                    break;
            }
            if (d.rarity >= 3)
                Box(root, new Vector3(0, 0.05f, L * 0.4f), new Vector3(0.01f, 0.01f, L * 0.4f), Mat.Emissive(RarityTint(d.rarity), 2f));
            return tip;
        }
    }
}
