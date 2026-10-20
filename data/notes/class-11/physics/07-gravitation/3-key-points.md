---
title: "Gravitation: Important Points and Traps"
type: key_points
chapter: c11.physics.gravitation
order: 3
---

## Kepler's laws

:::trap
The Sun is at one **focus** of the ellipse, not at its centre. The other focus is empty.
:::

:::trap
In $T^2 \propto a^3$, $a$ is the **semi-major axis**, $(r_P + r_A)/2$. It is not the perihelion distance and not the aphelion distance.
:::

- A planet is **fastest at perihelion** and **slowest at aphelion** (law of areas).
- $v_Pr_P = v_Ar_A$ works only at perihelion and aphelion, where the velocity is perpendicular to the radius. At other points, the angle must be included.
- The constant in $T^2 \propto a^3$ depends only on the mass of the central body. It is the same for all planets of the Sun, but different for satellites of the Earth.

:::tip
**Period ratio shortcut:** $\dfrac{T_1}{T_2} = \left(\dfrac{a_1}{a_2}\right)^{3/2}$. Radius 4 times means period 8 times. Radius 9 times means period 27 times.
:::

## The law of gravitation

- $G$ is a universal constant ($6.67 \times 10^{-11}$ N m² kg⁻²). $g$ is not: it changes from place to place.
- The force between two bodies does not depend on the medium between them or on other bodies nearby.
- Equal masses at the corners of an equilateral triangle (or any regular polygon) put **zero** net force on a mass at the centre, by symmetry (superposition).

:::trap
$F = Gm_1m_2/r^2$ with centre-to-centre distance works for **point masses** and **uniform spheres or shells** (with the other mass outside). For a rod or any other shape you must add up the forces from small parts.
:::

:::trap
(Exam extra) Inside a uniform shell the **force** is zero, but the **potential is not zero**. It is constant, equal to its value at the surface, $-GM/R$.
:::

## g above and below the surface

:::trap
$g(h) \approx g(1 - 2h/R_E)$ is only for $h \ll R_E$. For $h$ comparable to $R_E$ (say $h = R_E$), use the exact $g\,R_E^2/(R_E + h)^2$. At $h = R_E$ it gives $g/4$, while the short form wrongly gives $-g$.
:::

- $g(d) = g(1 - d/R_E)$ has no "small $d$" condition. It needs only uniform density.
- In this model $g$ is **maximum at the surface**. It decreases both upward and downward.
- At the centre of the Earth, $g = 0$, so weight is zero. **Mass does not change.**

:::tip
**"Height counts double":** for small heights, going up $h$ lowers $g$ as much as going down $2h$. A 1% drop needs a height of $0.005R_E$ (32 km) but a depth of $0.01R_E$ (64 km).
:::

- For a planet of the same density, $g \propto R$ (since $g = \tfrac43\pi G\rho R$).
- For a planet of the same mass, $g \propto 1/R^2$.

## Potential energy

:::trap
$\Delta U = mgh$ is only for heights much smaller than $R_E$. To lift a body from the surface to height $R_E$, the work is $\tfrac12 mgR_E$, **not** $mgR_E$.
:::

- Gravitational potential energy is **negative** because the zero is chosen at infinity. A more negative $U$ means the body is more tightly bound.
- Only differences in $U$ have physical meaning. The choice of zero does not change any answer.
- Gravity is conservative: the work done depends only on the start and end points, not the path.

## Escape speed

:::remember
- Earth: $v_e \approx 11.2$ km/s. Moon: about 2.3 km/s, so the Moon has no atmosphere.
- $v_e$ does not depend on the **mass** of the body or the **direction** of throw (air resistance ignored).
- $v_e = \sqrt{2gR_E}$. For two planets, $v_e \propto \sqrt{M/R}$.
:::

:::trap
Escape speed from the surface and orbital speed near the surface are different: $v_e = \sqrt2\,v_o$. To escape from a low orbit, the speed must rise by a factor $\sqrt2$ (about 41% more), not double.
:::

## Satellites

- Orbital speed and period **do not depend on the satellite's mass**. A small and a big satellite in the same orbit move together.
- Higher orbit: smaller speed, longer period, smaller $K$, but **larger** (less negative) total energy.
- The plane of a satellite's orbit must pass through the **centre of the Earth**.

:::remember
In a circular orbit: $U = -2K$ and $E = -K = \tfrac12 U$. If you know any one of $K$, $U$, $E$, you know all three.
:::

:::trap
$r$ in the satellite formulas is measured from the **centre** of the Earth: $r = R_E + h$. Don't use the height $h$ alone.
:::

- An astronaut in orbit feels **weightless** because the astronaut and the craft fall freely together, not because gravity is zero (NCERT, Points to ponder). At 400 km up, $g$ is still about 89% of its surface value.
- Near the surface: $v_o \approx 7.9$ km/s and $T \approx 85$ minutes. No satellite of the Earth can orbit faster than about 7.9 km/s in a circular orbit, or in less than about 85 minutes.

## Exam extras (not in the rationalised NCERT book)

- A **geostationary** satellite has a 24 h period, orbits over the equator from west to east, at about 35,800 km height. All such satellites share one orbit.
- Because of Earth's spin, $g$ is smallest at the equator and largest at the poles.

## NCERT lines to know

:::remember
- Every planet moves in an ellipse with the Sun at one focus.
- The gravitational force is a central force, so the angular momentum of a planet is conserved.
- A uniform shell exerts no force on a point mass inside it.
- The potential energy of a satellite is negative, and its total energy is negative too.
- For a planet under the Sun's gravity, angular momentum and total mechanical energy are conserved. Its linear momentum is not.
- Gravity cannot be shielded: a shell does not stop outside bodies from pulling on a mass inside it.
:::
