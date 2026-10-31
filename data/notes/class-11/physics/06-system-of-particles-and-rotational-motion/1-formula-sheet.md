---
title: "Rotational Motion: Formula Sheet"
type: formula_sheet
chapter: c11.physics.system-of-particles-and-rotational-motion
order: 1
---

## Centre of mass

:::formula{title="Two particles on a line"}
$$X = \frac{m_1x_1 + m_2x_2}{m_1 + m_2}$$
It lies closer to the heavier mass.
:::

:::formula{title="Many particles"}
$$\vec R = \frac{\sum m_i\vec r_i}{M}$$
$M = \sum m_i$. Same pattern for each of $X$, $Y$, $Z$.
:::

:::formula{title="Continuous body"}
$$\vec R = \frac{1}{M}\int \vec r\,dm$$
Uniform rod, ring, disc, sphere, cylinder: CM at the geometric centre. Uniform triangular lamina: at the **centroid** (where the medians meet).
:::

:::formula{title="Centre of mass of a few shapes (exam extra, not in NCERT)"}
Uniform bodies of radius $R$; distance from the centre of the straight edge or flat face:
- semicircular ring: $\dfrac{2R}{\pi}$; semicircular disc: $\dfrac{4R}{3\pi}$;
- solid hemisphere: $\dfrac{3R}{8}$; hollow hemisphere: $\dfrac{R}{2}$;
- solid cone of height $h$: $\dfrac{h}{4}$ from the base.
:::

## Motion of the centre of mass

:::formula{title="Velocity of the CM and total momentum"}
$$\vec V = \frac{\sum m_i\vec v_i}{M}$$
$$\vec P = M\vec V$$
$\vec A$ (acceleration of the CM) follows the same pattern.
:::

:::formula{title="Newton's second law for a system"}
$$M\vec A = \vec F_{ext}$$
$$\frac{d\vec P}{dt} = \vec F_{ext}$$
Only **external** forces count. If $\vec F_{ext} = 0$, $\vec P$ and $\vec V$ stay constant.
:::

## Vector (cross) product

:::formula{title="Magnitude, direction, rules"}
$$|\vec a\times\vec b| = ab\sin\theta$$
$\theta$ = smaller angle between them. Direction: perpendicular to both (right-hand rule).
$$\vec a\times\vec b = -\,\vec b\times\vec a$$
$$\vec a\times\vec a = \vec 0$$
$$\hat i\times\hat j = \hat k$$
Also $\hat j\times\hat k = \hat i$, $\hat k\times\hat i = \hat j$; reversed order gives a minus sign. Distributive over addition.
:::

:::formula{title="In components"}
$$\begin{aligned}\vec a\times\vec b = {}&(a_yb_z - a_zb_y)\,\hat i\\ &+ (a_zb_x - a_xb_z)\,\hat j\\ &+ (a_xb_y - a_yb_x)\,\hat k\end{aligned}$$
:::

## Angular velocity

:::formula{title="Linear and angular velocity"}
$$\vec v = \vec\omega\times\vec r$$
$$v = \omega r_\perp$$
$\omega$ in rad/s. $\vec r$ is measured from a point on the axis; $r_\perp$ = distance of the particle from the **axis**. $\vec\omega$ points along the axis (right-hand rule).
:::

:::formula{title="Angular acceleration"}
$$\vec\alpha = \frac{d\vec\omega}{dt}$$
Unit rad/s². For a fixed axis, $\alpha = \dfrac{d\omega}{dt}$.
:::

## Torque and angular momentum

:::formula{title="Torque (moment of force)"}
$$\vec\tau = \vec r\times\vec F$$
$$\tau = rF\sin\theta = r_\perp F$$
Unit N m, $[ML^2T^{-2}]$. $\vec r$ runs from the chosen point to where the force acts; $r_\perp$ = distance of the force's line from that point.
:::

:::formula{title="Angular momentum of a particle"}
$$\vec l = \vec r\times\vec p$$
$$l = rp\sin\theta = r_\perp p$$
Unit kg m² s⁻¹ (= J s). Depends on the point chosen as origin.
:::

:::formula{title="Torque changes angular momentum"}
$$\frac{d\vec l}{dt} = \vec\tau$$
$$\frac{d\vec L}{dt} = \vec\tau_{ext}$$
Second line: a system, $\vec L = \sum \vec l_i$; only **external** torques count. Take $\vec L$ and $\vec\tau_{ext}$ about the same fixed point.
:::

:::formula{title="Moment of a couple"}
$$\tau = Fd$$
Couple: equal and opposite forces on different lines; $d$ = distance between the lines. Net force zero; the moment is the same about every point.
:::

## Equilibrium of a rigid body

:::formula{title="Conditions"}
$$\sum \vec F_{ext} = \vec 0$$
$$\sum \vec\tau_{ext} = \vec 0$$
Translational, then rotational equilibrium. Mechanical equilibrium needs **both**.
:::

:::formula{title="Principle of moments (lever)"}
$$F_1d_1 = F_2d_2$$
$F_1$ = load, $d_1$ = load arm, $F_2$ = effort, $d_2$ = effort arm. For a lever in equilibrium.
$$\text{M.A.} = \frac{F_1}{F_2} = \frac{d_2}{d_1}$$
:::

## Moment of inertia

:::formula{title="Definition"}
$$I = \sum m_ir_i^2$$
$r_i$ = perpendicular distance of $m_i$ from the **axis**. Unit kg m², $[ML^2]$. Depends on the mass, how it is spread, and the position and direction of the axis.
:::

:::formula{title="Radius of gyration"}
$$I = Mk^2$$
$$k = \sqrt{I/M}$$
$k$ (in m): the whole mass put at distance $k$ from the axis gives the same $I$.
:::

:::formula{title="Rotational kinetic energy"}
$$K = \tfrac12 I\omega^2$$
For rotation about a fixed axis.
:::

:::formula{title="Standard moments of inertia (NCERT Table 6.1)"}
Uniform bodies of mass $M$, radius $R$, length $L$. No derivations needed (NCERT gives them without proof).

| Body | Axis | $I$ |
| --- | --- | --- |
| Thin ring | Through centre, ⊥ plane | $MR^2$ |
| Thin ring | Diameter | $MR^2/2$ |
| Thin rod | Through middle, ⊥ rod | $ML^2/12$ |
| Disc | Through centre, ⊥ plane | $MR^2/2$ |
| Disc | Diameter | $MR^2/4$ |
| Thin hollow cylinder | Its own axis | $MR^2$ |
| Solid cylinder | Its own axis | $MR^2/2$ |
| Solid sphere | Diameter | $2MR^2/5$ |
:::

:::formula{title="Two more values (exam extra, not in NCERT)"}
- Thin rod about one end, ⊥ rod: $ML^2/3$.
- Thin hollow sphere about a diameter: $2MR^2/3$.
:::

:::formula{title="Theorems of axes (exam extra, not in current NCERT)"}
**Parallel axes** (any body):
$$I = I_{cm} + Md^2$$
$d$ = distance between the given axis and the **parallel** axis through the CM.

**Perpendicular axes** (flat bodies only; $x$, $y$ in the plane):
$$I_z = I_x + I_y$$
The three axes meet at one point; $z$ is perpendicular to the plane.
:::

## Rotation about a fixed axis

:::formula{title="Kinematics (constant α only)"}
$$\omega = \omega_0 + \alpha t$$
$$\theta = \theta_0 + \omega_0t + \tfrac12\alpha t^2$$
$$\omega^2 = \omega_0^2 + 2\alpha(\theta - \theta_0)$$
Angles in **radians**. One revolution = $2\pi$ rad.
:::

:::formula{title="Dynamics"}
$$\tau = I\alpha$$
Fixed axis. $\tau$ = external torque component **along the axis**. Forces parallel to the axis, or whose line cuts it, add nothing.
:::

:::formula{title="Work and power"}
$$dW = \tau\,d\theta$$
$$P = \tau\omega$$
Constant torque: $W = \tau\theta$. Work done = change in $\tfrac12 I\omega^2$.
:::

:::formula{title="Angular momentum about a fixed axis"}
$$L = I\omega$$
$$\frac{dL}{dt} = \tau_{ext}$$
$L$ = component along the axis ($L_z$). For a body symmetric about the axis, it is the whole $L$ (NCERT's case).
:::

:::formula{title="Conservation of angular momentum"}
$$I_1\omega_1 = I_2\omega_2$$
When the external torque along the axis is **zero** ($I$ may change). Kinetic energy is usually **not** conserved.
:::

## Rolling without slipping (exam extra)

NCERT's introduction only says rolling = translation + rotation, with the contact point at rest. These formulas are not in the current book.

:::formula{title="Rolling condition and energy"}
$$v_{cm} = R\omega$$
$$K = \tfrac12 Mv_{cm}^2\left(1 + \frac{k^2}{R^2}\right)$$
$k$ = radius of gyration about the CM axis. Contact point momentarily at rest; top point moves at $2v_{cm}$.
:::

:::formula{title="Rolling down an incline (angle θ, height h)"}
$$a = \frac{g\sin\theta}{1 + k^2/R^2}$$
$$v = \sqrt{\frac{2gh}{1 + k^2/R^2}}$$
From rest, with enough friction to prevent slipping. $k^2/R^2$: ring 1, disc or solid cylinder $\tfrac12$, hollow sphere $\tfrac23$, solid sphere $\tfrac25$.
:::
