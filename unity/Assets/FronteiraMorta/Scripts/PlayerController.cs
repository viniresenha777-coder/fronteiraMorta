using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

namespace FronteiraMorta
{
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        public float walkSpeed = 3.2f, sprintSpeed = 5.4f;
        public float maxHp = 100, hp = 100, stamina = 100;
        public bool exhausted, dead;
        public readonly WeaponInst[] slots = new WeaponInst[3];
        public int current;
        public readonly Dictionary<string, int> reserve = new Dictionary<string, int>();
        public int food = 1, water = 1, med = 0, anti = 0, money = 0, kills = 0;
        public float hunger = 100, thirst = 100, infect = 0;
        float hurtFx;

        public HumanoidRig rig;
        CharacterController cc;
        Transform weaponRoot, muzzle;
        Light flashlight;
        Camera cam;
        float vy, cooldown, reloading, attackT, kick, aimYaw;
        WeaponDef shownWeapon;
        public Vector3 AimPoint { get; private set; }
        public WeaponInst Cur => slots[current];
        public WeaponDef CurDef => slots[current] != null ? slots[current].def : Weapons.All["punhos"];
        public float ReloadProgress => reloading > 0 ? 1f - reloading / Mathf.Max(0.01f, CurDef.reload) : 0f;

        public void Init(Camera c)
        {
            cam = c;
            cc = GetComponent<CharacterController>();
            cc.height = 1.8f; cc.radius = 0.32f; cc.center = new Vector3(0, 0.9f, 0); cc.stepOffset = 0.35f;
            rig = HumanoidRig.Build(transform, BodyLook.Survivor());
            // lanterna presa no colete
            var fl = new GameObject("Lanterna");
            fl.transform.SetParent(rig.torso, false);
            fl.transform.localPosition = new Vector3(-0.1f, 0.42f, 0.16f);
            fl.transform.localEulerAngles = new Vector3(18, 0, 0);
            flashlight = fl.AddComponent<Light>();
            flashlight.type = LightType.Spot; flashlight.spotAngle = 58; flashlight.range = 24; flashlight.intensity = 2.5f;
            flashlight.color = new Color(1f, 0.88f, 0.62f); flashlight.shadows = LightShadows.Soft;
            var bulb = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Destroy(bulb.GetComponent<Collider>());
            bulb.transform.SetParent(fl.transform, false); bulb.transform.localScale = new Vector3(0.06f, 0.05f, 0.05f);
            bulb.GetComponent<Renderer>().sharedMaterial = Mat.Emissive(new Color(1f, 0.95f, 0.75f), 3f);
            Minimap.Marker(transform, new Color(1f, 0.85f, 0.35f), 3.2f, true);
            ResetState();
        }

        public void ResetState()
        {
            hp = maxHp; stamina = 100; exhausted = false; dead = false;
            slots[0] = new WeaponInst(Weapons.All["pistola"]); slots[1] = new WeaponInst(Weapons.All["faca"]); slots[2] = null;
            current = 0;
            reserve.Clear(); reserve["9mm"] = 36;
            food = 1; water = 1; med = 0; anti = 0; money = 0; kills = 0;
            hunger = 100; thirst = 100; infect = 0;
            RefreshWeapon();
        }

        public void RefreshWeapon()
        {
            var d = CurDef;
            if (shownWeapon == d && weaponRoot != null) return;
            shownWeapon = d;
            if (weaponRoot != null) Destroy(weaponRoot.gameObject);
            weaponRoot = new GameObject("ModeloArma").transform;
            if (d.Pose == ArmPose.Melee) { weaponRoot.SetParent(rig.handTip[1], false); weaponRoot.localEulerAngles = new Vector3(90, 0, 0); }
            else
            {
                weaponRoot.SetParent(rig.gunMount, false);
                rig.gunMount.localPosition = d.Pose == ArmPose.Pistol ? new Vector3(0.02f, 0.42f, 0.5f)
                                          : d.Pose == ArmPose.Heavy ? new Vector3(0.16f, 0.18f, 0.18f) : new Vector3(0.12f, 0.4f, 0.12f);
            }
            muzzle = Weapons.BuildModel(d, weaponRoot);
        }

        public void AddAmmo(string type, int n) { reserve.TryGetValue(type, out int r); reserve[type] = r + n; }
        public int Reserve(string type) { reserve.TryGetValue(type, out int r); return r; }

        public void AddInfection(float n) { if (!dead) infect = Mathf.Min(100, infect + n); }

        public void TakeDamage(float d)
        {
            if (dead) return;
            hp -= d; hurtFx = 1f;
            CameraRig.Shake(0.25f);
            if (hp <= 0) { hp = 0; dead = true; GameManager.I.OnPlayerDied(); }
        }

        void Update()
        {
            if (dead || cam == null || GameManager.I == null || GameManager.I.Paused) { rig?.Animate(Time.deltaTime, 0, 0, CurDef.Pose, 0, false, 5); return; }
            var kb = Keyboard.current; var mouse = Mouse.current;
            if (kb == null || mouse == null) return;
            float dt = Time.deltaTime;

            // ---- movimento (câmera com rotação fixa: W = norte = +Z)
            Vector3 dir = Vector3.zero;
            if (kb.wKey.isPressed || kb.upArrowKey.isPressed) dir.z += 1;
            if (kb.sKey.isPressed || kb.downArrowKey.isPressed) dir.z -= 1;
            if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) dir.x -= 1;
            if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) dir.x += 1;
            bool moving = dir.sqrMagnitude > 0.01f;
            bool sprint = moving && kb.leftShiftKey.isPressed && stamina > 0 && !exhausted;
            if (sprint) { stamina -= 24f * dt; if (stamina <= 0) { stamina = 0; exhausted = true; } }
            else if (hunger > 0 && thirst > 0) { stamina = Mathf.Min(100, stamina + (moving ? 12f : 22f) * dt); if (exhausted && stamina >= 20) exhausted = false; }
            // fome, sede e infecção
            hunger = Mathf.Max(0, hunger - 0.12f * dt); thirst = Mathf.Max(0, thirst - 0.17f * dt);
            if (infect >= 100) { hp -= 1.2f * dt; if (hp <= 0) { hp = 0; dead = true; GameManager.I.OnPlayerDied(); return; } }
            hurtFx = Mathf.Max(0, hurtFx - dt * 1.5f);
            PostFx.Hurt(Mathf.Max(hurtFx, hp / maxHp < 0.3f ? 0.6f : 0f));
            float speed = sprint ? sprintSpeed : walkSpeed;
            Vector3 vel = moving ? dir.normalized * speed : Vector3.zero;
            vy = cc.isGrounded ? -1f : vy - 20f * dt;
            cc.Move((vel + Vector3.up * vy) * dt);

            // ---- mira: ponto do mouse no chão, na altura do peito
            var ray = cam.ScreenPointToRay(mouse.position.ReadValue());
            var plane = new Plane(Vector3.up, new Vector3(0, 1.3f, 0));
            if (plane.Raycast(ray, out float enter)) AimPoint = ray.GetPoint(enter);
            Vector3 look = AimPoint - transform.position; look.y = 0;
            if (look.sqrMagnitude > 0.04f)
            {
                float target = Mathf.Atan2(look.x, look.z) * Mathf.Rad2Deg;
                aimYaw = Mathf.MoveTowardsAngle(aimYaw, target, 720f * dt);
                transform.rotation = Quaternion.Euler(0, aimYaw, 0);
            }

            // ---- armas
            if (kb.digit1Key.wasPressedThisFrame) Select(0);
            if (kb.digit2Key.wasPressedThisFrame) Select(1);
            if (kb.digit3Key.wasPressedThisFrame) Select(2);
            float wheel = mouse.scroll.ReadValue().y;
            if (Mathf.Abs(wheel) > 0.1f) Cycle(wheel < 0 ? 1 : -1);
            if (kb.rKey.wasPressedThisFrame) StartReload();
            if (kb.hKey.wasPressedThisFrame) UseMed();
            if (kb.fKey.wasPressedThisFrame) Eat();
            if (kb.gKey.wasPressedThisFrame) Drink();
            if (kb.iKey.wasPressedThisFrame) UseAnti();
            if (kb.lKey.wasPressedThisFrame) flashlight.enabled = !flashlight.enabled;

            cooldown -= dt; attackT = Mathf.Max(0, attackT - dt * 4f); kick = Mathf.Max(0, kick - dt * 8f);
            if (reloading > 0) { reloading -= dt; if (reloading <= 0) FinishReload(); }
            if (mouse.leftButton.isPressed && cooldown <= 0 && reloading <= 0) Attack();

            // ---- lanterna mais forte à noite
            flashlight.intensity = Mathf.Lerp(0.6f, 3.2f, GameManager.I.Darkness);

            // ---- animação
            var d = CurDef;
            if (d.Pose != ArmPose.Melee && d.Pose != ArmPose.Fists && weaponRoot != null) weaponRoot.localPosition = new Vector3(0, 0, -kick * 0.08f);
            rig.Animate(dt, moving ? (sprint ? 1f : 0.75f) : 0f, sprint ? 11f : 8f, d.Pose, attackT, false, sprint ? 10 : 5);
        }

        void Select(int i) { if (i == current) return; current = i; reloading = 0; RefreshWeapon(); }
        void Cycle(int dir) { for (int k = 1; k <= 3; k++) { int i = (current + dir * k + 3) % 3; if (slots[i] != null) { Select(i); return; } } }

        void StartReload()
        {
            var w = Cur; if (w == null || w.def.melee || w.ammo >= w.def.mag || reloading > 0) return;
            if (Reserve(w.def.ammo) <= 0) { GameManager.I.Log("Sem munição de reserva"); return; }
            reloading = w.def.reload;
        }

        void FinishReload()
        {
            var w = Cur; if (w == null) return;
            int take = Mathf.Min(w.def.mag - w.ammo, Reserve(w.def.ammo));
            w.ammo += take; reserve[w.def.ammo] = Reserve(w.def.ammo) - take;
        }

        void UseMed()
        {
            if (med <= 0) { GameManager.I.Log("Você não tem kit médico"); return; }
            if (hp >= maxHp) { GameManager.I.Log("Vida cheia"); return; }
            med--; hp = Mathf.Min(maxHp, hp + 40); GameManager.I.Log("Você usou um kit médico");
        }

        void Eat()
        {
            if (food <= 0) { GameManager.I.Log("Você não tem comida"); return; }
            if (hunger >= 100) { GameManager.I.Log("Sem fome"); return; }
            food--; hunger = Mathf.Min(100, hunger + 40); GameManager.I.Log("Você comeu");
        }

        void Drink()
        {
            if (water <= 0) { GameManager.I.Log("Você não tem água"); return; }
            if (thirst >= 100) { GameManager.I.Log("Sem sede"); return; }
            water--; thirst = Mathf.Min(100, thirst + 40); GameManager.I.Log("Você bebeu");
        }

        void UseAnti()
        {
            if (anti <= 0) { GameManager.I.Log("Você não tem antibiótico"); return; }
            if (infect <= 0) { GameManager.I.Log("Você não está infectado"); return; }
            anti--; infect = Mathf.Max(0, infect - 60); GameManager.I.Log($"Antibiótico · infecção {infect:0}%");
        }

        void Attack()
        {
            var w = Cur; var d = CurDef;
            cooldown = d.delay;
            if (d.melee)
            {
                attackT = 1f;
                // acerta quem estiver na frente, dentro do alcance
                var center = transform.position + transform.forward * (d.range * 0.6f) + Vector3.up * 1f;
                var hit = new HashSet<ZombieAI>();
                foreach (var col in Physics.OverlapSphere(center, d.range * 0.6f))
                {
                    var z = col.GetComponentInParent<ZombieAI>();
                    if (z == null || z.Dead || hit.Contains(z)) continue;
                    Vector3 to = z.transform.position - transform.position; to.y = 0;
                    if (Vector3.Angle(transform.forward, to) > 70f) continue;
                    hit.Add(z); z.TakeDamage(d.damage, transform.forward);
                }
                GameManager.I.Noise(transform.position, 6f);
                return;
            }
            if (w.ammo <= 0) { if (Reserve(d.ammo) > 0) StartReload(); else { GameManager.I.Log("Sem munição"); cooldown = 0.4f; } return; }
            w.ammo--;
            kick = 1f;
            Vector3 origin = muzzle.position;
            Vector3 aim = AimPoint - origin; aim.y = 0;
            if (aim.sqrMagnitude < 0.25f) aim = transform.forward;
            for (int i = 0; i < d.pellets; i++)
            {
                Vector3 dir = Quaternion.Euler(0, Random.Range(-d.spread, d.spread), 0) * aim.normalized;
                Vector3 end = origin + dir * d.range;
                if (Physics.Raycast(origin, dir, out RaycastHit h, d.range, ~0, QueryTriggerInteraction.Ignore))
                {
                    end = h.point;
                    var z = h.collider.GetComponentInParent<ZombieAI>();
                    if (z != null) z.TakeDamage(d.damage, dir);
                }
                Fx.Tracer(origin, end);
            }
            Fx.MuzzleFlash(origin, transform.forward);
            CameraRig.Shake(d.look == WeaponLook.Shotgun || d.look == WeaponLook.Rifle ? 0.2f : 0.08f);
            GameManager.I.Noise(transform.position, d.look == WeaponLook.Pistol ? 22f : 34f);
            if (w.ammo == 0 && Reserve(d.ammo) > 0) StartReload();
        }
    }
}
