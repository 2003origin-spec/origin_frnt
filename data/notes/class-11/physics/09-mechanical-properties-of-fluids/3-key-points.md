---
title: "Mechanical Properties of Fluids: Important Points and Traps"
type: key_points
chapter: c11.physics.mechanical-properties-of-fluids
order: 3
---

## Pressure

- Pressure at a depth depends only on $h$, $\rho$ and $g$. Three vessels of different shapes, filled to the same height with the same liquid, have the **same pressure** at the bottom, even though they hold different weights of liquid.
- Points at the **same level in the same liquid at rest**, connected through that liquid, are at the same pressure. This is the key step in every U-tube problem.
- Pressure is a scalar. The **force** due to pressure on a surface is a vector, always normal to the surface.

:::trap
**Absolute or gauge?** $P = P_a + \rho g h$ is absolute pressure. A tyre gauge or manometer reads **gauge** pressure, $\rho g h$. Read the question: "pressure at the bottom of a lake" usually means absolute; "excess pressure" means gauge.
:::

:::trap
In a U-tube with **two different liquids**, do not equate the two free-surface levels. Equate pressures at the level of the **interface** (where the two liquids meet), on both sides: $\rho_1 h_1 = \rho_2 h_2$.
:::

:::remember
- 1 atm = $1.013 \times 10^5$ Pa = 76 cm of Hg = 760 torr.
- 10 m of water gives about 1 atm (more exactly 10.3 m).
- A water barometer would need a tube over 10 m tall. That is why mercury (density $13.6 \times 10^3$ kg/m³) is used.
:::

- A hydraulic lift **multiplies force**, not energy. If $F$ goes up $A_2/A_1$ times, the distance moved goes down by the same factor.

## Flow and Bernoulli

:::trap
Bernoulli's equation needs **steady flow** of an **incompressible, non-viscous** fluid, and is applied **along one streamline**. It fails for turbulent flow and does not account for viscous losses.
:::

:::trap
"Faster flow means lower pressure" is true only at the **same height**. If the height changes too, keep the $\rho g h$ term.
:::

- The continuity equation $A v = $ constant needs an **incompressible** fluid (a liquid, or a gas at low speed). Halving the radius makes the speed **four** times, since $A \propto r^2$.
- The speed of efflux $\sqrt{2gh}$ does **not** depend on the liquid's density or the hole's size (as long as the hole is small). $h$ is measured from the **free surface** down to the hole, not from the bottom.
- (Exam extra) A jet from a hole at depth $h$ in a tank of height $H$ standing on the ground lands at a horizontal distance $2\sqrt{h(H - h)}$. It goes farthest for $h = H/2$. Holes at depths $h$ and $H - h$ reach the same distance.

:::tip
Roofs blow off in a storm: fast wind above means low pressure above, while the air inside is still. The pressure difference pushes the roof up. Same idea: the Magnus effect, aerofoil lift, two boats moving side by side being pulled together.
:::

## Viscosity

- Viscosity of **liquids falls** with temperature; viscosity of **gases rises**. A common one-word trap.
- Units of $\eta$: Pa s = N s m⁻² = poiseuille (Pl). Dimensions $[\text{ML}^{-1}\text{T}^{-1}]$. (1 poise = 0.1 Pa s, CGS.)
- At terminal velocity the **net force is zero**, so the acceleration is zero. The speed stays constant.

:::trap
In $v_t = \dfrac{2a^2(\rho - \sigma)g}{9\eta}$ (NCERT symbols), $\rho$ is the density of the **sphere** and $\sigma$ the density of the **fluid**. Don't swap them. Also, $v_t \propto a^2$, not $a$.
:::

:::tip
**Drops merging (exam favourite):** $n$ equal drops join into one big drop. Volume is conserved, so $R = n^{1/3} r$. Then $v_t \propto R^2$ gives a new terminal velocity of $n^{2/3}$ times. For 8 drops: 4 times; for 27 drops: 9 times.
:::

- (Exam extra) **Reynolds number** $R_e = \rho v d/\eta$ has no unit. Low $R_e$ (below about 1000): streamline flow. High $R_e$ (above about 2000): turbulent flow. These cut-offs are approximate.

## Surface tension

:::trap
A **soap bubble** has **two** surfaces (inside and outside the film), so $\Delta P = 4S/r$. An **air bubble inside water** or a **liquid drop** has only **one**, so $\Delta P = 2S/r$. Likewise, a soap film on a frame pulls a wire with $2Sl$, and the surface energy of a bubble of radius $r$ is $2 \times 4\pi r^2 S = 8\pi r^2 S$.
:::

- **Smaller bubble, higher pressure inside.** (Exam extra) If two soap bubbles of different sizes are joined by a tube, air flows from the **smaller** one into the **bigger** one: the small one shrinks, the big one grows.
- (Exam extra) Breaking a big drop into many small drops **needs** energy (more surface). Many small drops merging into one **gives out** energy (as heat).
- Surface tension usually decreases as temperature rises, and soap or detergent lowers it.

:::trap
**Angle of contact decides rise or fall.** $\theta < 90^\circ$: concave meniscus, the liquid rises (water in glass). $\theta > 90^\circ$: convex meniscus, the liquid falls (mercury in glass). $\theta = 90^\circ$: no rise or fall.
:::

- $h \propto 1/a$: a tube half as wide gives twice the rise. (Exam extra name: Jurin's law.)
- (Exam extra) If the tube is **shorter** than $h$, the liquid does **not** overflow. It rises to the top and the meniscus flattens (its radius grows) so that $hR$ stays $2S/(\rho g)$. There is no capillary fountain.
- (Exam extra) In free fall (or in an orbiting satellite), the effective $g = 0$, so the liquid rises along the whole length of the tube.

## NCERT lines to know

:::remember
- Pascal's law: a change in pressure applied to an enclosed fluid is passed undiminished to every point of the fluid and the walls of the container.
- Bernoulli's principle is conservation of energy for flowing fluids.
- Streamlines never cross.
- Surface energy per unit area of a liquid surface equals its surface tension.
- The pressure inside a drop or bubble is greater than outside.
:::
