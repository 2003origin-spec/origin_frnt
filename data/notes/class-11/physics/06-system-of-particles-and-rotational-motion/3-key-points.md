---
title: "Rotational Motion: Important Points and Traps"
type: key_points
chapter: c11.physics.system-of-particles-and-rotational-motion
order: 3
---

## Centre of mass

- The CM depends only on the masses and their positions, not on the choice of origin. A different origin changes the numbers $X$, $Y$, but the point in space is the same.
- The CM of two particles divides the line between them in the **inverse** ratio of the masses: $\dfrac{r_1}{r_2} = \dfrac{m_2}{m_1}$.
- The CM can lie where there is no mass: ring, hollow sphere, a bangle, a horseshoe.

:::trap
**Internal forces cannot move the CM.** A shell that explodes in the air, a man walking on a boat (water friction ignored), a gun recoiling: in each case, the CM keeps its earlier motion. Only an external force changes it.
:::

:::trap
After a shell explodes, the **CM** follows the old parabola only while all the pieces are in the air. Once one piece hits the ground, the ground pushes on it (an external force), and the rule stops working.
:::

:::trap
CM and centre of gravity are the same point only when $g$ is uniform over the body. For everyday bodies it is; for a tall mountain it is not.
:::

## Vector product

:::trap
$\vec a\times\vec b = -\,\vec b\times\vec a$. The order matters. $\vec\tau = \vec r\times\vec F$, **not** $\vec F\times\vec r$; $\vec l = \vec r\times\vec p$, not $\vec p\times\vec r$.
:::

- The cross product of two parallel vectors is zero. So $\vec a\times\vec b = \vec 0$ (both non-zero) means they are parallel or antiparallel.
- $\vec a\times\vec b$ is perpendicular to **both** $\vec a$ and $\vec b$. So $(\vec a\times\vec b)\cdot\vec a = 0$.

## Torque and angular momentum

:::trap
Torque and angular momentum depend on the **point** you take them about. Always say "about which point". Exception: when the total force is zero (a couple, for example), the total torque is the same about every point.
:::

:::trap
Torque has the same dimensions as work, $[ML^2T^{-2}]$, but its unit is written **N m**, never joule. Torque is a vector; work is a scalar.
:::

- A force produces **no torque** about a point if its line passes through that point, and no turning about an axis if it is **parallel** to the axis or its line **cuts** the axis.
- Gravity acting on a body gives the same torque as its whole weight acting at the CG.
- Angular momentum unit: kg m² s⁻¹ = J s (same unit as Planck's constant).

:::remember
- $\vec\tau = d\vec l/dt$: torque changes angular momentum, as force changes linear momentum.
- Internal torques cancel. Only external torques change the total angular momentum of a system.
- Zero net force does **not** mean zero net torque (a couple). Zero net torque does not mean zero net force.
:::

## Moment of inertia

:::trap
Moment of inertia is **not** a fixed property like mass. It changes with the axis. "The moment of inertia of a disc" means nothing until the axis is named.
:::

- $r$ in $I = \sum mr^2$ is the **perpendicular** distance from the axis, not the distance from the origin.
- A thin ring and a thin hollow cylinder of the same mass and radius have the same $I = MR^2$ about their axes: all the mass is at distance $R$. Length along the axis doesn't matter.
- A disc and a solid cylinder have the same $I = MR^2/2$ about their axes, for the same reason.
- For the same mass and radius: ring > disc about the central axis. Hollow sphere > solid sphere about a diameter.

:::tip
**$k^2/R^2$ ladder** (about the usual central axis): ring 1, hollow sphere $\tfrac23$, disc $\tfrac12$, solid sphere $\tfrac25$. More mass near the rim means a bigger number.
:::

## Rotation about a fixed axis

:::trap
Use **radians** in all the rotation formulas. Convert rev/s with $\omega = 2\pi\nu$, and rpm with $\omega = \dfrac{2\pi \times \text{rpm}}{60}$. "Number of turns" $= \dfrac{\theta}{2\pi}$.
:::

- All points of the rigid body have the same $\omega$ and $\alpha$, but different $v$ and different centripetal acceleration ($\omega^2 r$).
- The equations $\omega = \omega_0 + \alpha t$ and the rest need **constant** $\alpha$.
- A string wrapped on a pulley or cylinder that doesn't slip: the string's speed = $\omega R$, its acceleration = $\alpha R$.

:::trap
In a pulley problem with a massive pulley, the tensions on the two sides are **not equal**. Their difference gives the torque: $(T_1 - T_2)R = I\alpha$. The tensions are equal only for a massless pulley on a frictionless axle, or when the string slides over a smooth pulley without turning it.
:::

## Conservation of angular momentum

:::trap
When a skater pulls her arms in, $L$ stays the same but kinetic energy **increases**: $K = \dfrac{L^2}{2I}$. If $I$ becomes one-third, $\omega$ and $K$ both become 3 times. Her muscles do the work.
:::

:::trap
When two discs on one axle are pressed together, $L$ is conserved but kinetic energy is **lost** (to friction between them, as heat). Don't use energy conservation there.
:::

- If $I$ changes with $\tau_{ext} = 0$: $I_1\omega_1 = I_2\omega_2$, so $\omega \propto \dfrac1I$.
- Doubling the radius of a body of fixed mass (same shape) makes $I$ four times and $\omega$ a quarter.

## Rolling (exam extra, not in current NCERT)

:::trap
In pure rolling, the contact point has **zero velocity**, but it is **not** at rest for good: it has an acceleration towards the centre. Friction there is **static** and does no work.
:::

- In rolling, the share of KE that is rotational is $\dfrac{k^2/R^2}{1 + k^2/R^2}$: ring $\tfrac12$, disc $\tfrac13$, solid sphere $\tfrac27$.
- Released together from rest on the same slope (rolling without slipping), the order of arrival depends only on the **shape** ($k^2/R^2$), not on the mass or radius.
- On a perfectly smooth slope, there is no friction and so no torque about the CM. A body released without spin **slides** without starting to rotate, and beats every rolling body to the bottom.

## NCERT lines to know

:::remember
- The centre of mass of a system moves as if all the mass were concentrated there and all external forces acted there.
- In rotation about a fixed axis, every particle moves in a circle in a plane perpendicular to the axis, with its centre on the axis.
- Moment of inertia is the rotational analogue of mass: it measures rotational inertia.
- If the total external torque on a system is zero, its total angular momentum is conserved.
:::
