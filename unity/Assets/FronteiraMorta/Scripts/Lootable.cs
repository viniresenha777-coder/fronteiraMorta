using UnityEngine;

namespace FronteiraMorta
{
    /// <summary>Lugar que dá para vasculhar segurando E (lixeira, caixote, carro, baú).</summary>
    public class Lootable : MonoBehaviour
    {
        public string label = "caixote";
        public float searchTime = 1.2f;
        public float emptyChance = 0.35f, weaponChance = 0.03f;
        public bool opened;
        GameObject marker, mapMarker;

        public void Init(string name, float time, float empty, float weapon)
        {
            label = name; searchTime = time; emptyChance = empty; weaponChance = weapon;
            // marcador (?) flutuando em cima
            marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(marker.GetComponent<Collider>());
            marker.transform.SetParent(transform, false);
            marker.transform.localScale = Vector3.one * 0.18f;
            marker.GetComponent<Renderer>().sharedMaterial = Mat.Emissive(new Color(1f, 0.85f, 0.4f), 1.5f);
            mapMarker = Minimap.Marker(transform, new Color(0.95f, 0.75f, 0.25f), 1.1f);
            mapMarker.transform.localScale = new Vector3(1.1f / transform.lossyScale.x, 0.2f, 1.1f / transform.lossyScale.z);
        }

        void Update()
        {
            if (marker == null) return;
            var b = GetComponent<Renderer>() != null ? GetComponent<Renderer>().bounds : new Bounds(transform.position, Vector3.one);
            marker.transform.position = new Vector3(b.center.x, b.max.y + 0.35f + Mathf.Sin(Time.time * 2f) * 0.05f, b.center.z);
        }

        public void Open(PlayerController p)
        {
            opened = true;
            if (marker != null) Destroy(marker);
            if (mapMarker != null) Destroy(mapMarker);
            var gm = GameManager.I;
            if (Random.value < emptyChance) { gm.Log($"{label}: vazio"); return; }
            float r = Random.value;
            if (Random.value < weaponChance)
            {
                string[] pool = { "colt", "revolver", "mp5", "canoduplo", "escopeta", "ak47", "m4", "caca", "facao", "taco", "machado", "katana" };
                var d = Weapons.All[pool[Random.Range(0, pool.Length)]];
                int free = System.Array.IndexOf(p.slots, null);
                if (free >= 0) { p.slots[free] = new WeaponInst(d); gm.Log($"Você encontrou: {d.name}!"); }
                else { p.money += 40; gm.Log($"{d.name} (sem espaço: vendeu por $40)"); }
                return;
            }
            if (r < 0.35f) { int n = Random.Range(8, 24); string[] types = { "9mm", ".45", "7.62", "5.56", "cartucho", ".357" }; var t = types[Random.Range(0, types.Length)]; p.AddAmmo(t, n); gm.Log($"+{n} balas {t}"); }
            else if (r < 0.55f) { int n = Random.Range(3, 18) * (1 + gm.Danger); p.money += n; gm.Log($"+${n}"); }
            else if (r < 0.72f) { p.food++; gm.Log("+1 comida"); }
            else if (r < 0.84f) { p.water++; gm.Log("+1 água"); }
            else if (r < 0.9f) { p.anti++; gm.Log("+1 antibiótico"); }
            else { p.med++; gm.Log("+1 kit médico"); }
        }
    }
}
