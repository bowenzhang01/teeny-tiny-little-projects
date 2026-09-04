# E 通信兵 · LINK-05 完整设计（已确认方向，第一版已实现）

> 本文档记录 E 通信兵的设定与实施思路，**第一版已按其实现**，
> 对应代码：`src/state/commsStore.ts`、`src/weapons/CommsRifle.tsx`、
> `src/weapons/RavenDrone.tsx`、`src/weapons/BeaconKit.tsx`、
> `src/weapons/EmpKit.tsx`、`src/hud/layouts/EHud.tsx`、
> `src/hud/layouts/RavenHud.tsx`。
>
> 核心定位：**通信与侦察一体**——E 是全队的信息传递中枢，
> “看得远、标得快、还能打”。四个系统合计不超四槽（与 A/B/C/D 一致）。

---

## 1. 总览：E 的四个系统

| # | 系统 | 定位 | 输入 |
|---|------|------|------|
| 1 | AR-05 侦察突击步枪 | 主武器 · 精准持续火力 | 左键连射，`R` 换弹 |
| 2 | RAVEN-05 大型无人机 | 特殊系统 · 侦察/中继/打击 | `Q` 部署，`F` 模式循环，`V` 链路视角，`1/2` 武器 |
| 3 | TRI-05 三角定位信标 | 部署物 · 区域侦察标记 | `G` 抛射 |
| 4 | EMP-05 电磁干扰弹 | 投掷物 · 电子战瘫痪 | `T` 抛射 |

> RAVEN 与 A 的 Q-01 同量级，但操作完全不同：Q-01 是地面四足 +
> `F` 自动↔全屏遥控 + WASD 行走；RAVEN 是空中平台 + 工作模式循环 +
> `V` 链路视角（只观瞄/开火，本体不接管，也不需要 WASD）。

---

## 2. 主武器：AR-05 侦察突击步枪

- **弹匣**：30 发，`R` 换弹约 1.1s。
- **射击**：左键按住连射约 0.10s/发。
- **命中**：+1 分，命中推倒标靶。
- **特色：E-MARK**——命中后把目标标记为侦察目标（6s），
  `LockSystem` 对标记目标自动锁定阈值放宽（与 A CIWS / D 无人机同思路）。
- **外观**：紧凑突击步枪 + 紫色能量环 + 光学镜；紫色高速曳光 + 小型紫色爆点。

## 3. 特殊系统：RAVEN-05 大型无人机

### 3.1 状态机

```
STOWED ──Q──▶ RELAY（通信中继·悬停）
RELAY  ──F──▶ SWEEP（侦察扫描·绕场巡航）
SWEEP  ──F──▶ STRIKE（协同交战）
STRIKE ──F──▶ RELAY
任意状态 ──Q──▶ STOWING ──▶ STOWED（飞回玩家背后再回收）
```

- **RELAY**：悬停在玩家侧上方，作为通信中继；传感器自动标记最近目标。
- **SWEEP**：绕场巡航扫描，持续标记目标（HUD `SENSOR` 显示）。
- **STRIKE**：自动交战——双管机枪（约 0.13s/发）+ 微型导弹（左右各 2 发，
  冷却 6s）。
- **V 链路视角（RAVEN LINK 全屏 HUD）**：相机移到无人机头部，
  鼠标观瞄、`WASD` 飞行、`Space` 上升、`Ctrl` 下降、左键开火、
  `1/2` 切 MG/MSL、`F` 切模式、`V` 退出、`Q` 回收；
  这是 RAVEN 的手动操作模式（与 A 机器人 REMOTE 区分：空中飞行，不走路）。
- **传感器**：部署状态每 300ms 标记最近活目标，写入 `commsStore.drone.sensorMark`。
- **STRIKE 自动交战**：先自动索敌（标记最近活目标），再朝目标方向瞄准开火，
  不再朝无人机自身朝向乱打。
- 电量缓慢消耗（RELAY/SWEEP 低耗，链路视角较高），HUD 显示 LINK/PWR。

## 4. 投掷物：TRI-05 三角定位信标

- `G` 向左前方抛射（复用榴弹抛物线），库存 **3 颗**，约 6s 自动补满。
- 落地展开紫色全息光柱 + 地面光圈，持续约 10s。
- 落地时标记距离最近的活目标（TRI MARK，10s），
  `LockSystem` 同 E-MARK 一样放宽锁定；HUD 显示补充倒计时。

## 5. 电子战：EMP-05 电磁干扰弹

- `T` 抛射（复用榴弹抛物线），库存 **2 颗**，约 8s 自动补满。
- 命中：紫色电磁爆 + 全屏扰动 + `+5` 分，标靶“瘫痪”倒下 **4s**（比普通 2.4s 更久）。
- 未命中地面也释放干扰特效（无得分），不推倒标靶。

## 6. HUD 设计（E 紫色网络终端）

- 定位：**信息传递中枢**，复杂度与 D 同级（相对 A/B/C 更复杂）。
- **顶栏**：`E // LINK-05` 品牌 + 罗盘 + `SQUAD NET / RAVEN 模式 / NV`。
- **左侧**：
  - AR-05 面板（弹匣 / 换弹进度 / E-MARK / 精度）；
  - 生命体征（`BioPanel`）+ 外骨骼（`ExoPanel`）；
  - 小队通信（`CommsPanel`）。
- **右侧**：
  - **RAVEN-05 LINK 面板**：RELAY/SWEEP/STRIKE 模式胶囊、LINK/PWR/SENSOR、
    MG 热度、MSL 数量与冷却；
  - **RECON LOADOUT**：TRI / EMP 库存与补充倒计时；
  - **SQUAD NET MATRIX**：A/B/C/D/E 链路状态（当前为占位网络矩阵，
    未来接真实小队状态）；
  - 战术雷达 + 目标列表（复用 `Radar` / `EnemyMarkers`）。
- **中央**：紫色锐角准星 + 锁定环 + `AR-05 RECON RIFLE` + 当前 RAVEN 模式。
- **链路视角（RavenHud）**：RAVEN 观瞄画面 + 机身/武器/传感器/网络状态 +
  `LMB FIRE / 1-2 MG-MSIL / F MODE / V EXIT / Q STOW` 提示。

## 7. 实施清单（已完成）

### 新增文件
- `src/state/commsStore.ts`
- `src/weapons/CommsRifle.tsx`
- `src/weapons/RavenDrone.tsx`
- `src/weapons/BeaconKit.tsx`
- `src/weapons/EmpKit.tsx`
- `src/hud/layouts/EHud.tsx`
- `src/hud/layouts/RavenHud.tsx`
- `src/squad/characters/e.ts`

### 修改文件
- `src/weapons/registry.ts` —— 注册四个 E 系统。
- `src/squad/index.ts`、`src/squad/characters/stubs.ts` —— E 占位移到正式配置。
- `src/input/inputMap.ts`、`src/input/inputContext.ts` —— `roleE` / `linkRemote`
  上下文与动作键位。
- `src/combat/Projectiles.tsx` —— commsRifle / beacon / emp 弹体与信标特效。
- `src/combat/LockSystem.tsx` —— E-MARK / TRI MARK / RAVEN SENSOR 辅助锁定。
- `src/scene/squad/CharacterRig.tsx` —— 换人时 `commsStore.reset()`。
- `src/scene/Scene.tsx` —— `linkRemote` 时移除 PointerLockControls。
- `src/styles.css` —— `.theme-e` 与 E/RAVEN HUD 样式。
- `README.md` —— E 章节与进度记录。
