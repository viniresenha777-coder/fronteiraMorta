using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;

namespace FronteiraMorta
{
    /// <summary>
    /// Monta o jogo sozinho ao apertar Play (em qualquer cena vazia) e cuida do ciclo de dia e noite,
    /// neblina, barulho, nascimento dos zumbis, saque com E, morte e recomeço.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager I { get; private set; }
        public PlayerController player;
        [System.NonSerialized] public Hud hud;
        public bool Paused { get; private set; }
        public float Darkness { get; private set; }
        public int Danger = 0;                    // 0 = área azul (fácil)
        public float DamageMul => 1f + Danger * 0.3f;
        public int maxZombies = 22;

        CityBuilder city;
        Minimap minimap;
        Light sun;
        Camera cam;
        float clock = 8 * 60f;                   // minutos do dia; 1 dia = 8 minutos reais
        float spawnT, deadT, searchT;
        Lootable searching;
        readonly List<ZombieAI> zombies = new List<ZombieAI>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (I != null || FindAnyObjectByType<GameManager>() != null) return;
            new GameObject("FronteiraMorta").AddComponent<GameManager>();
        }

        void Awake()
        {
            I = this;
            // câmera: usa a Main Camera da cena (ou cria uma)
            cam = Camera.main;
            if (cam == null) { var cg = new GameObject("Main Camera"); cg.tag = "MainCamera"; cam = cg.AddComponent<Camera>(); cg.AddComponent<AudioListener>(); }
            cam.clearFlags = CameraClearFlags.SolidColor;
            // sol: usa a luz direcional da cena (ou cria uma)
            sun = RenderSettings.sun;
            if (sun == null) { var any = FindAnyObjectByType<Light>(); if (any != null && any.type == LightType.Directional) sun = any; }
            if (sun == null) { var sg = new GameObject("Sol"); sun = sg.AddComponent<Light>(); sun.type = LightType.Directional; }
            sun.shadows = LightShadows.Soft;
            RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.ambientMode = AmbientMode.Flat;

            var world = new GameObject("Cidade").transform;
            city = new CityBuilder(20261113, world);
            Vector3 spawn = city.Build();

            var pg = new GameObject("Jogador");
            pg.transform.position = spawn;
            pg.AddComponent<CharacterController>();
            player = pg.AddComponent<PlayerController>();
            player.Init(cam);
            cam.gameObject.AddComponent<CameraRig>().Init(cam, pg.transform);
            PostFx.Setup(cam);
            hud = new Hud();
            minimap = gameObject.AddComponent<Minimap>();
            minimap.Init(cam, pg.transform, hud.canvas, hud.font);
            Log("Fronteira Morta · WASD anda · Shift corre · mouse mira e atira · segure E para vasculhar");
            Log("1 2 3 / roda trocam arma · R recarrega · F come · G bebe · H kit · I antibiótico · L lanterna · M mapa · Esc pausa");
            spawnT = 2f;
        }

        public void Log(string s) { hud?.Log(s); }

        public void Noise(Vector3 pos, float radius) { foreach (var z in zombies) if (z != null) z.Hear(pos, radius); }

        public void OnZombieKilled(ZombieAI z) { zombies.Remove(z); }

        public void OnPlayerDied() { deadT = 0; Log("Você morreu"); }

        void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.escapeKey.wasPressedThisFrame && !player.dead) { Paused = !Paused; Time.timeScale = Paused ? 0 : 1; }
            float dt = Time.deltaTime;

            // ---- dia e noite
            clock = (clock + dt * 3f) % 1440f;
            float hour = clock / 60f;
            float sunUp = Mathf.Clamp01(Mathf.Sin((hour - 6f) / 12f * Mathf.PI));      // 0 de noite, 1 ao meio-dia
            Darkness = 1f - Mathf.SmoothStep(0, 1, Mathf.Clamp01(sunUp * 2.2f));
            sun.transform.rotation = Quaternion.Euler(Mathf.Lerp(12f, 62f, sunUp), 35f + hour * 6f, 0);
            sun.intensity = Mathf.Lerp(0.15f, 2.1f, 1 - Darkness);
            sun.color = Color.Lerp(new Color(0.55f, 0.65f, 0.9f), new Color(1f, 0.95f, 0.85f), 1 - Darkness);
            var fog = Color.Lerp(new Color(0.42f, 0.5f, 0.6f), new Color(0.06f, 0.09f, 0.15f), Darkness);   // neblina azulada
            RenderSettings.fogColor = fog; cam.backgroundColor = fog;
            RenderSettings.fogStartDistance = 30f; RenderSettings.fogEndDistance = Mathf.Lerp(120f, 60f, Darkness);
            RenderSettings.ambientLight = Color.Lerp(new Color(0.62f, 0.65f, 0.72f), new Color(0.13f, 0.16f, 0.24f), Darkness);
            foreach (var l in city.lamps) l.intensity = Darkness > 0.35f ? 2.2f * Darkness : 0f;

            if (player.dead)
            {
                deadT += dt;
                hud.SetCenter(deadT > 1.5f ? "Você morreu\n<size=22>Aperte Enter para recomeçar</size>" : "Você morreu");
                if (deadT > 1.5f && kb != null && kb.enterKey.wasPressedThisFrame) Restart();
                RefreshHud();
                return;
            }
            hud.SetCenter(Paused ? "PAUSADO\n<size=22>Esc para continuar</size>" : "");
            if (Paused) { RefreshHud(); return; }

            // ---- zumbis nascem longe da tela
            zombies.RemoveAll(z => z == null);
            spawnT -= dt;
            if (spawnT <= 0 && CountAlive() < maxZombies) { spawnT = Darkness > 0.5f ? 1.8f : 3.2f; Spawn(); }

            // ---- vasculhar segurando E
            Lootable near = NearestLoot(2.2f);
            bool hold = kb != null && kb.eKey.isPressed;
            if (near != searching) { searching = near; searchT = 0; }
            if (near != null)
            {
                if (hold) { searchT += dt; if (searchT >= near.searchTime) { near.Open(player); searching = null; searchT = 0; } }
                else searchT = 0;
                hud.SetPrompt(near != null && !near.opened ? $"SEGURE E PARA VASCULHAR {near.label.ToUpperInvariant()}" : "", searching != null ? searchT / searching.searchTime : 0);
            }
            else hud.SetPrompt("", 0);

            RefreshHud();
        }

        void RefreshHud()
        {
            hud.Refresh(player, "PERIGO: MUITO FÁCIL");
            minimap.SetTexts("A4 · VILA FUMAÇA", $"A4 · Azul · Dia 1 · {Clock()}");
        }

        int CountAlive() { int n = 0; foreach (var z in zombies) if (z != null && !z.Dead) n++; return n; }

        string Clock() { int h = (int)(clock / 60), m = (int)(clock % 60); return $"{h:00}:{m:00}" + (Darkness > 0.5f ? " · noite" : ""); }

        Lootable NearestLoot(float r)
        {
            Lootable best = null; float bd = r;
            foreach (var col in Physics.OverlapSphere(player.transform.position + Vector3.up * 0.5f, r))
            {
                var l = col.GetComponent<Lootable>();
                if (l == null || l.opened) continue;
                float d = Vector3.Distance(col.ClosestPoint(player.transform.position + Vector3.up * 0.5f), player.transform.position + Vector3.up * 0.5f);
                if (d < bd) { bd = d; best = l; }
            }
            return best;
        }

        void Spawn()
        {
            for (int t = 0; t < 12; t++)
            {
                float a = Random.Range(0, Mathf.PI * 2), d = Random.Range(26f, 40f);
                var p = player.transform.position + new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)) * d;
                if (p.x < 3 || p.z < 3 || p.x > CityBuilder.W - 3 || p.z > CityBuilder.H - 3) continue;
                if (Physics.CheckCapsule(p + Vector3.up * 0.75f, p + Vector3.up * 1.6f, 0.4f, ~0, QueryTriggerInteraction.Ignore)) continue;
                float r = Random.value;
                var type = r < 0.62f ? ZombieType.Walker : r < 0.82f ? ZombieType.Runner : r < 0.93f ? ZombieType.Hazmat : ZombieType.Brute;
                var go = new GameObject("Zumbi " + type);
                go.transform.position = p + Vector3.up * 0.1f;
                go.AddComponent<CharacterController>();
                var z = go.AddComponent<ZombieAI>();
                z.Init(type, player, Danger);
                zombies.Add(z);
                return;
            }
        }

        void Restart()
        {
            foreach (var z in zombies) if (z != null) Destroy(z.gameObject);
            zombies.Clear();
            var cc = player.GetComponent<CharacterController>();
            cc.enabled = false;
            player.transform.position = new Vector3(CityBuilder.MidX, 0.1f, CityBuilder.MidZ);
            cc.enabled = true;
            player.ResetState();
            hud.SetCenter("");
            Log("Você voltou ao começo");
            spawnT = 3f;
        }
    }
}
