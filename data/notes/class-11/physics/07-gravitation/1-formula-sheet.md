---
title: "Gravitation: Formula Sheet"
type: formula_sheet
chapter: c11.physics.gravitation
order: 1
---

Values used in NCERT: $G = 6.67 \times 10^{-11}$ N m² kg⁻², $g = 9.8$ m/s². Earth's radius: NCERT uses $R_E = 6400$ km in most places and $6.37 \times 10^6$ m in one example. Earth's mass: $6.0 \times 10^{24}$ kg in the exercises ($5.97 \times 10^{24}$ kg in one example).

Notation: NCERT writes potential energy as $W(r)$ in the chapter text and $V$ in the summary. These notes use $U$ for potential energy and $V$ for potential (energy per unit mass).

## Kepler's laws

:::formula{title="Law of periods"}
$$T^2 \propto a^3$$
$T$ = time for one revolution, $a$ = semi-major axis of the ellipse. For a circular orbit of radius $r$, $a = r$. All planets of the Sun share the same constant.
:::

:::formula{title="Law of periods (from Newton's law)"}
$$T^2 = \frac{4\pi^2}{GM}\,r^3$$
$M$ = mass of the body at the centre (the Sun for planets, the Earth for satellites). Derived for a circular orbit, assuming the orbiting body is much lighter than $M$. NCERT adds that it also holds for an ellipse if $r$ is replaced by the semi-major axis $a$.
:::

:::formula{title="Semi-major axis"}
$$a = \frac{r_P + r_A}{2}$$
$r_P$ = perihelion (closest) distance, $r_A$ = aphelion (farthest) distance from the Sun.
:::

:::formula{title="Law of areas"}
$$\frac{\Delta A}{\Delta t} = \frac{L}{2m}$$
Areal velocity is constant because the angular momentum $L$ about the Sun is conserved (gravity is a central force). $m$ = mass of the planet.
:::

:::formula{title="Speeds at the closest and farthest points"}
$$v_P\,r_P = v_A\,r_A$$
Holds only at these two points, where the velocity is perpendicular to the line from the Sun. So $v_P > v_A$.
:::

## Universal law of gravitation

:::formula{title="Newton's law"}
$$F = \frac{G\,m_1 m_2}{r^2}$$
$F$ in N, $m_1, m_2$ in kg, $r$ in m. Attractive, along the line joining the two. Exactly true for **point masses**. For uniform spheres (or shells), $r$ = distance between centres, when the other mass is outside.
:::

:::formula{title="Units and dimensions of G"}
$$[G] = [M^{-1}L^3T^{-2}]$$
Unit: N m² kg⁻². $G$ is the same everywhere (a universal constant). It was first measured by Cavendish (1798).
:::

:::formula{title="Shell theorem (uniform shell of mass M, radius R)"}
Point mass $m$ **outside** ($r > R$):
$$F = \frac{GMm}{r^2}$$
Point mass **inside** ($r < R$): $F = 0$.
:::

:::formula{title="Superposition"}
$$\vec F = \vec F_1 + \vec F_2 + \dots + \vec F_n$$
The net force on a mass is the vector sum of the forces from each of the other masses, each found on its own.
:::

## Acceleration due to gravity

:::formula{title="g at the surface"}
$$g = \frac{GM_E}{R_E^2}$$
Ignores Earth's rotation. Rearranged, $M_E = \dfrac{gR_E^2}{G}$: this is how the Earth is "weighed".
:::

:::formula{title="g in terms of density"}
$$g = \frac{4}{3}\pi G\rho R_E$$
$\rho$ = mean density of the Earth (kg/m³), taken as uniform.
:::

:::formula{title="g at height h (exact)"}
$$g(h) = \frac{GM_E}{(R_E + h)^2}$$
$$g(h) = g\left(\frac{R_E}{R_E + h}\right)^2$$
Valid at any height above the surface.
:::

:::formula{title="g at height h (small heights)"}
$$g(h) \approx g\left(1 - \frac{2h}{R_E}\right)$$
Only when $h \ll R_E$. For large heights use the exact form.
:::

:::formula{title="g at depth d"}
$$g(d) = g\left(1 - \frac{d}{R_E}\right)$$
For $0 \le d \le R_E$, assuming uniform density. Exact in that model (no small-$d$ condition). At the centre ($d = R_E$), $g = 0$.
:::

## Gravitational potential energy

:::formula{title="Near the surface"}
$$\Delta U = mgh$$
Only for $h \ll R_E$, where $g$ is nearly constant.
:::

:::formula{title="General form (zero at infinity)"}
$$U(r) = -\frac{GM_Em}{r}$$
For $r \ge R_E$ ($r$ measured from Earth's centre). For two point masses: $U = -\dfrac{Gm_1m_2}{r}$. Always negative.
:::

:::formula{title="Work to move from r₁ to r₂"}
$$W = GM_Em\left(\frac{1}{r_1} - \frac{1}{r_2}\right)$$
Work done against gravity (= rise in $U$) when $r_2 > r_1$. It depends only on the end points.
:::

:::formula{title="Gravitational potential"}
$$V(r) = -\frac{GM_E}{r}$$
Potential energy of a unit mass at that point. Unit: J/kg. $U = mV$.
:::

## Escape speed

:::formula{title="Escape speed from the surface"}
$$v_e = \sqrt{\frac{2GM_E}{R_E}}$$
$$v_e = \sqrt{2gR_E} \approx 11.2 \text{ km/s}$$
Independent of the mass of the body and of the direction of throw (air resistance ignored). Moon: about 2.3 km/s.
:::

## Earth satellites

$r = R_E + h$ = orbit radius from Earth's centre, for a circular orbit at height $h$.

:::formula{title="Orbital speed"}
$$v_o = \sqrt{\frac{GM_E}{R_E + h}}$$
Independent of the satellite's mass. Near the surface ($h \ll R_E$): $v_o \approx \sqrt{gR_E} \approx 7.9$ km/s.
:::

:::formula{title="Time period"}
$$T = 2\pi\sqrt{\frac{(R_E + h)^3}{GM_E}}$$
Near the surface: $T \approx 2\pi\sqrt{R_E/g} \approx 85$ minutes.
:::

:::formula{title="Escape vs orbital speed"}
$$v_e = \sqrt2\,v_o$$
Both taken at the same distance $r$ from the centre (true at any $r$, so also near the surface).
:::

:::formula{title="Energy of a satellite"}
$$K = \frac{GM_Em}{2r}$$
$$U = -\frac{GM_Em}{r}$$
$$E = K + U = -\frac{GM_Em}{2r}$$
Circular orbit of radius $r$. So $U = -2K$ and $E = -K$. Negative $E$ means the satellite is bound to the Earth.
:::

## Exam extras (not in the rationalised NCERT book)

:::formula{title="g with latitude"}
$$g_\lambda = g - \omega^2 R_E\cos^2\lambda$$
$\lambda$ = latitude, $\omega$ = Earth's spin rate ($7.3 \times 10^{-5}$ rad/s). Least at the equator, largest at the poles. Rotation has no effect at the poles.
:::

:::formula{title="Geostationary orbit"}
$T = 24$ h, in the equatorial plane, moving west to east. Orbit radius about $4.2 \times 10^7$ m, height about 35,800 km.
:::

:::formula{title="Elliptical orbit energy"}
$$E = -\frac{GMm}{2a}$$
$a$ = semi-major axis. Reduces to the circular result when $a = r$. NCERT itself only says that in an elliptical orbit $K$ and $U$ vary from point to point, while the total energy stays constant and negative. The formula is the extra part.
:::
