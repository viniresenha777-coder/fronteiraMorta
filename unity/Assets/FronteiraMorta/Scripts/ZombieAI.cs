using UnityEngine;

namespace FronteiraMorta
{
    public enum ZombieType { Walker, Runner, Brute, Hazmat }

    [RequireComponent(typeof(CharacterController))]
    public class ZombieAI : MonoBehaviour
    {
        public ZombieType type;
        public float hp, maxHp, speed, damage, sight = 18f, attackRange = 1.25f, attackDelay = 1.1f;
        public bool Dead { get; private set; }
        HumanoidRig rig;
        SpriteActor actor;          // desenho com a spritesheet da versão web
        float stepDist;
        string sheet;
        CharacterController cc;
        PlayerController player;
        float attackCd, alertT, wanderT, vy, flashT, deadT, lunge;
        Vector3 wanderDir, knock;
        bool chasing;
        GameObject marker;

        public void Init(ZombieType t, PlayerController p, int danger)
        {
            type = t; player = p;
            cc = GetComponent<CharacterController>();
            float hpMul = 1f + danger * 0.35f;
            BodyLook look;
            switch (t)
            {
                case ZombieType.Runner: maxHp = 40; speed = 4.3f; damage = 8; look = BodyLook.Zombie(new Color(0.42f, 0.11f, 0.1f)); sheet = "z_runner"; break;
                case ZombieType.Brute: maxHp = 180; speed = 1.4f; damage = 22; attackRange = 1.6f; look = BodyLook.Zombie(new Color(0.24f, 0.24f, 0.24f), false, 1.35f); sheet = "z_brute"; break;
                case ZombieType.Hazmat: maxHp = 90; speed = 1.6f; damage = 12; look = BodyLook.Zombie(new Color(0.65f, 0.56f, 0.13f), true); sheet = "z_hazmat"; break;
                default:
                    maxHp = 60; speed = Random.Range(1.3f, 1.9f); damage = 10;
                    bool b = Random.value < 0.5f;
                    look = BodyLook.Zombie(b ? new Color(0.34f, 0.27f, 0.19f) : new Color(0.17f, 0.24f, 0.34f));
                    sheet = b ? "z_walker" : "z_walker2";
                    break;
            }
            maxHp *= hpMul; hp = maxHp;
            float sc = look.scale;
            cc.height = 1.8f * sc; cc.radius = 0.32f * sc; cc.center = new Vector3(0, 0.9f * sc, 0); cc.stepOffset = 0.3f;
            rig = HumanoidRig.Build(transform, look);
            if (SpriteActor.Available(sheet))
            {
                actor = gameObject.AddComponent<SpriteActor>();
                actor.Init(sheet, type == ZombieType.Brute ? 1.15f : 1f);
                rig.gameObject.SetActive(false);
            }
            marker = Minimap.Marker(transform, new Color(0.95f, 0.25f, 0.2f), 1.6f);
            wanderDir = Quaternion.Euler(0, Random.Range(0, 360f), 0) * Vector3.forward;
            transform.rotation = Quaternion.LookRotation(wanderDir);
        }

        /// <summary>Barulho (tiros etc.): quem estiver perto vem atrás.</summary>
        public void Hear(Vector3 pos, float radius)
        {
            if (Dead) return;
            if ((pos - transform.position).sqrMagnitude < radius * radius) { chasing = true; alertT = 6f; }
        }

        public void TakeDamage(float d, Vector3 dir)
        {
            if (Dead) return;
            hp -= d; flashT = 0.12f; chasing = true; alertT = 8f;
            dir.y = 0; knock = dir.normalized * (type == ZombieType.Brute ? 1.2f : 3.5f);
            Fx.Blood(transform.position + Vector3.up * 1.2f, dir);
            if (hp <= 0) Die(dir);
        }

        void Die(Vector3 dir)
        {
            Dead = true; cc.enabled = false;
            if (marker != null) Destroy(marker);
            player.kills++; player.money += type == ZombieType.Brute ? 6 : 2;
            GameManager.I.OnZombieKilled(this);
            deadT = 0;
            Fx.BloodPool(transform.position);
        }

        void Update()
        {
            float dt = Time.deltaTime;
            if (Dead)
            {
                // cai para trás e some depois de um tempo
                deadT += dt;
                float t = Mathf.Clamp01(deadT / 0.45f);
                rig.transform.localRotation = Quaternion.Euler(-88f * t * t, 0, 0);
                rig.transform.localPosition = new Vector3(0, 0.12f * t, 0);
                if (actor != null)
                {
                    actor.SetTint(Color.Lerp(Color.white, new Color(0.55f, 0.5f, 0.5f, Mathf.Clamp01(1.5f - deadT / 16f)), t));
                    actor.Draw(Camera.main);
                    actor.Lie(t);
                }
                if (deadT > 25f) Destroy(gameObject);
                return;
            }
            if (GameManager.I.Paused) return;
            Vector3 toP = player.transform.position - transform.position; toP.y = 0;
            float dist = toP.magnitude;
            float see = sight * (GameManager.I.Darkness > 0.5f ? 0.75f : 1f);
            if (!player.dead && dist < see) { chasing = true; alertT = 5f; }
            alertT -= dt; if (alertT <= 0 && dist > see * 1.4f) chasing = false;

            Vector3 want;
            float spd;
            if (chasing && !player.dead)
            {
                want = toP.normalized; spd = speed;
            }
            else
            {
                wanderT -= dt;
                if (wanderT <= 0) { wanderT = Random.Range(2f, 5f); wanderDir = Quaternion.Euler(0, Random.Range(-120f, 120f), 0) * wanderDir; }
                want = wanderDir; spd = speed * 0.35f;
            }
            // desvio simples: se tiver algo na frente, tenta ir de lado
            if (Physics.SphereCast(transform.position + Vector3.up * 0.9f, 0.3f, want, out RaycastHit h, 1.4f, ~0, QueryTriggerInteraction.Ignore)
                && h.collider.GetComponentInParent<PlayerController>() == null && h.collider.GetComponentInParent<ZombieAI>() == null)
            {
                Vector3 left = Quaternion.Euler(0, -60, 0) * want, right = Quaternion.Euler(0, 60, 0) * want;
                bool lFree = !Physics.SphereCast(transform.position + Vector3.up * 0.9f, 0.3f, left, out _, 1.6f, ~0, QueryTriggerInteraction.Ignore);
                want = lFree ? left : right;
                if (!chasing) wanderDir = want;
            }
            bool inRange = chasing && dist < attackRange + 0.2f;
            if (inRange) spd = 0;
            Vector3 vel = want * spd + knock;
            knock = Vector3.MoveTowards(knock, Vector3.zero, 18f * dt);
            vy = cc.isGrounded ? -1f : vy - 20f * dt;
            cc.Move((vel + Vector3.up * vy) * dt);
            Vector3 face = chasing ? toP : want;
            if (face.sqrMagnitude > 0.01f) transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(face), 360f * dt);

            attackCd -= dt; lunge = Mathf.Max(0, lunge - dt * 3f);
            if (inRange && attackCd <= 0 && !player.dead)
            {
                attackCd = attackDelay; lunge = 1f;
                player.TakeDamage(damage * GameManager.I.DamageMul);
                player.AddInfection(type == ZombieType.Hazmat ? 6f : 3f);
            }
            flashT -= dt;
            float move01 = spd > 0.01f ? Mathf.Clamp01(spd / 2f) : 0f;
            float lean = type == ZombieType.Runner ? 24f : type == ZombieType.Brute ? 8f : 14f;
            rig.Animate(dt, move01, type == ZombieType.Runner ? 11f : 5.5f, ArmPose.Fists, 0, true, lean + lunge * 12f, type == ZombieType.Walker ? 0.45f : 1f);
            if (actor != null)
            {
                stepDist += spd * dt;
                int col = spd > 0.05f ? Mathf.FloorToInt(stepDist / (type == ZombieType.Runner ? 0.4f : 0.22f)) % 8 : 1;
                actor.SetFrame(SpriteActor.RowFromYaw(transform.eulerAngles.y), col);
                actor.SetTint(flashT > 0 ? new Color(1.6f, 1.4f, 1.4f) : Color.white);
                actor.Draw(Camera.main);
            }
        }
    }
}
