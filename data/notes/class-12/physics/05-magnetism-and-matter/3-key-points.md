---
title: "Magnetism and Matter: Important Points and Traps"
type: key_points
chapter: c12.physics.magnetism-and-matter
order: 3
---

## Poles and field lines

:::trap
Field lines go from N to S **outside** the magnet, but from S to N **inside** it. They never stop at a pole. That is why the magnetic moment $\vec m$ points from S to N.
:::

- Cutting a magnet, across or along its length, always gives two complete magnets, each with N and S.
- Cut into two **equal** halves (of a uniformly magnetised bar), each half has magnetic moment $m/2$. The magnetisation $M$ stays the same and the volume halves, so $m = MV$ halves.
- Not every magnetic set-up has poles. A **toroid** and a long straight wire have no N and S, because their net magnetic moment is zero (NCERT Example 5.1).
- A closed loop of static magnetic field line must enclose a current. Field lines can't close around empty space.

:::trap
Magnetic field lines are **not** lines of force for a moving charge. The force $q\vec v\times\vec B$ is at right angles to $\vec B$.
:::

## Torque, force and energy

:::trap
In a **uniform** field a magnet feels a torque but **no net force**. A net force needs a **non-uniform** field, as near the pole of another magnet.
:::

- $\theta$ is the angle between $\vec m$ and $\vec B$. If a question gives the angle with the **normal** to the field, use $90^\circ$ minus it.
- The torque is zero at both $0^\circ$ and $180^\circ$, but only $0^\circ$ is stable.
- Turning from the stable to the unstable position needs work $2mB$. From the stable position to $90^\circ$ needs $mB$.

:::trap
$U = -mB\cos\theta$ is **zero at 90°**, not at $0^\circ$. At $0^\circ$ it is $-mB$, the **lowest** value. "Lowest energy" means $-mB$, not zero.
:::

:::trap
Units: $m$ is in A m² (= J T⁻¹), so its dimensions are [L² A]. Torque is in N m. Don't mix the J T⁻¹ of $m$ with the J of energy.
:::

## Field of a bar magnet

:::remember
- On the axis, $B$ points **along** $\vec m$. On the equator, it points **opposite** to $\vec m$.
- At the same distance, the axial field is **twice** the equatorial field.
- Both fall as $1/r^3$.
:::

:::trap
$r$ is measured from the **centre** of the magnet, and the formulas need $r \gg l$ (a short magnet). Don't use them close to the magnet.
:::

:::tip
Moving from electric to magnetic: swap $\vec p \to \vec m$, $\vec E \to \vec B$ and $\dfrac{1}{4\pi\varepsilon_0} \to \dfrac{\mu_0}{4\pi}$. Every dipole result carries over.
:::

## Gauss's law

- Net flux of $\vec B$ through **any** closed surface is zero, even one that encloses only the N pole.
- Reason: no magnetic monopoles. Electric flux through a closed surface is not zero when there is charge inside.
- Flux through an **open** surface (a loop) need not be zero. That flux is what Chapter 6 uses.

## H, M, χ and μ

:::trap
$\vec B = \mu_0(\vec H + \vec M)$, not $\mu_0\vec H + \vec M$. And $\mu_r = 1 + \chi$, not $\chi$. A material with $\chi = 0$ has $\mu_r = 1$ (like vacuum), not $\mu_r = 0$.
:::

- $H$ and $M$ have the **same unit**, A m⁻¹. $\chi$ and $\mu_r$ have **no unit**. $\mu$ has the unit of $\mu_0$, T m A⁻¹.
- $\mu_0$ is the **permeability** of free space ($4\pi\times10^{-7}$ T m A⁻¹). Don't call it permittivity.
- Inside a long solenoid, $H = nI$ for any core. The core changes $B$ and $M$, not $H$.
- Magnetising current: $I_M = (\mu_r - 1)I$, in the **same** solenoid with the core removed.

## Dia, para, ferro

:::remember
- $\chi$: dia $\approx -10^{-5}$, para $\approx +10^{-5}$, ferro very large ($\mu_r > 1000$).
- Diamagnetism is in **every** material, but it is weak and masked in para- and ferromagnets.
- Superconductor: $\chi = -1$, $\mu_r = 0$, field fully expelled (Meissner effect).
:::

:::trap
**Copper is diamagnetic, but copper chloride is paramagnetic.** Oxygen (at STP) is paramagnetic; nitrogen (at STP) is diamagnetic. Water is diamagnetic.
:::

:::tip
NCERT examples, sorted. Note that the familiar metals copper and lead are **dia**, while aluminium and sodium are **para**:
- Dia: **Bi, Cu, Pb, Si**, $\ce{N2}$, water, NaCl.
- Para: **Al, Na, Ca**, $\ce{O2}$, $\ce{CuCl2}$.
- Ferro: **Fe, Co, Ni, Gd**.
:::

- (Exam extra: not in current NCERT; asked under the syllabus topic "para-, dia- and ferromagnetic substances") A diamagnetic rod hung between the poles of a strong magnet turns **across** the field. A paramagnetic rod turns **along** it.
- In a non-uniform field, dia moves from strong to weak field; para and ferro move from weak to strong.
- (Exam extra, same topic, not in NCERT) A diamagnetic liquid in a U-tube with one arm between magnet poles is pushed **down** in that arm. A paramagnetic one rises.

:::trap
Paramagnetic atoms **do** have a permanent moment. Diamagnetic atoms do **not** (their moment is only induced, and it is opposite to the field). Don't swap these.
:::

- Domains: about 1 mm across, about $10^{11}$ atoms each. In a field, aligned domains **grow** and the others turn.
- **Hard** ferromagnets (alnico, lodestone) keep magnetism: permanent magnets. **Soft** ones (soft iron) lose it when the field is switched off.

## Temperature

- Paramagnet: $\chi$ falls as temperature rises. Cooling, or a stronger field, raises $M$ up to saturation.
- Ferromagnet: heated enough, it becomes **paramagnetic** (gradually).
- (Exam extra, not in NCERT) Curie's law for paramagnets: $\chi \propto 1/T$. The temperature at which a ferromagnet turns paramagnetic is the **Curie temperature**; above it $\chi \propto 1/(T - T_C)$ (Curie–Weiss law).

:::trap
(Exam extra, not in NCERT) Curie's law, $\chi \propto 1/T$, is for **paramagnets** only. A ferromagnet above $T_C$ follows a different law, $\chi \propto 1/(T - T_C)$ (Curie–Weiss), and below $T_C$ neither applies. Diamagnetic $\chi$ hardly depends on temperature.
:::

## NCERT lines to know

:::remember
- Magnetic monopoles do not exist. Magnetic field lines are continuous and form closed loops.
- The net magnetic flux through any closed surface is zero.
- Magnetisation $M$ of a sample is its net magnetic moment per unit volume.
- Substances that keep their ferromagnetic property for a long time at room temperature are called **permanent magnets**.
:::
