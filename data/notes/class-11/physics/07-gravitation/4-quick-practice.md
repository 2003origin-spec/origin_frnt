---
title: "Gravitation: Quick Practice"
type: practice
chapter: c11.physics.gravitation
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Where needed, take the Earth's radius $R_E = 6400$ km.

## Kepler's laws

:::question{title="1. Period of a far planet" exam="NEET level"}
A planet moves round the Sun in a nearly circular orbit whose radius is 4 times that of the Earth's orbit. How long is its year, in Earth years?

---

$T^2 \propto r^3$, so $\dfrac{T}{1 \text{ year}} = 4^{3/2} = 8$. Its year is **8 Earth years**.
:::

:::question{title="2. Fast and slow" exam="NEET level"}
A comet's closest distance from the Sun is $1.0 \times 10^{11}$ m and its farthest distance is $1.5 \times 10^{11}$ m. Its speed at the closest point is 30 km/s. Find its speed at the farthest point.

---

At these two points the velocity is perpendicular to the radius, and angular momentum is conserved: $v_Pr_P = v_Ar_A$.

$v_A = \dfrac{30 \times 1.0}{1.5} =$ **20 km/s**.
:::

## Acceleration due to gravity

:::question{title="3. A smaller planet" exam="NEET level"}
A planet has the same mean density as the Earth but half its radius. Find $g$ on its surface.

---

$g = \tfrac43\pi G\rho R$, so with the same $\rho$, $g \propto R$. Half the radius gives half of $g$: $g_p = \dfrac{10}{2} =$ **5 m/s²**.
:::

:::question{title="4. Where g is a quarter" exam="NEET level"}
At what height above the Earth's surface does $g$ become one quarter of its surface value?

---

$h$ is not small, so use the exact form: $\left(\dfrac{R_E}{R_E + h}\right)^2 = \dfrac14$, so $\dfrac{R_E}{R_E + h} = \dfrac12$ and $h = R_E =$ **6400 km**.
:::

:::question{title="5. One per cent less" exam="JEE Main level"}
Find (a) the depth and (b) the height (approximately) at which $g$ is 1% less than at the surface. Treat the Earth as a uniform sphere.

---

(a) $g(d) = g\left(1 - \dfrac{d}{R_E}\right)$, so $\dfrac{d}{R_E} = 0.01$ and $d = 0.01 \times 6400 =$ **64 km**.

(b) $h \ll R_E$, so $g(h) \approx g\left(1 - \dfrac{2h}{R_E}\right)$. Then $\dfrac{2h}{R_E} = 0.01$ and $h = 0.005 \times 6400 \approx$ **32 km**.
:::

## Energy and escape

:::question{title="6. Lifting far up" exam="JEE Main level"}
How much work is needed to lift a 100 kg body from the Earth's surface to a height equal to $R_E$? Take $R_E = 6.4 \times 10^6$ m.

---

$W = GM_Em\left(\dfrac{1}{R_E} - \dfrac{1}{2R_E}\right) = \dfrac{GM_Em}{2R_E} = \dfrac{mgR_E}{2}$, using $GM_E = gR_E^2$.

$W = \dfrac{100 \times 10 \times 6.4 \times 10^6}{2} =$ **3.2 × 10⁹ J**. ($mgh$ would wrongly give twice this.)
:::

:::question{title="7. Escape from a bigger planet" exam="NEET level"}
A planet has 8 times the Earth's mass and 2 times its radius. Find its escape speed. Take the Earth's escape speed as 11.2 km/s.

---

$v_e = \sqrt{\dfrac{2GM}{R}} \propto \sqrt{\dfrac{M}{R}} = \sqrt{\dfrac{8}{2}} = 2$. So $v_e = 2 \times 11.2 =$ **22.4 km/s**.
:::

## Satellites

:::question{title="8. Orbit at height R" exam="NEET level"}
A satellite orbits the Earth in a circle at a height equal to the Earth's radius. Find its orbital speed. Take $R_E = 6.4 \times 10^6$ m.

---

$r = 2R_E$ and $GM_E = gR_E^2$, so $v = \sqrt{\dfrac{gR_E^2}{2R_E}} = \sqrt{\dfrac{gR_E}{2}}$.

$v = \sqrt{3.2 \times 10^7} \approx 5.66 \times 10^3$ m/s, about **5.7 km/s**.
:::

:::question{title="9. Energies of a satellite" exam="NEET level"}
A satellite in a circular orbit has kinetic energy $K$. What are its potential energy and total energy? What least energy must be given to it so that it escapes from the Earth?

---

$K = \dfrac{GM_Em}{2r}$ and $U = -\dfrac{GM_Em}{r}$, so $U =$ **−2K** and $E = K + U =$ **−K**.

To escape, the total energy must be raised to zero, so it needs **K** more.
:::

:::question{title="10. Launch into orbit" exam="JEE Main level"}
A 200 kg satellite is to be placed in a circular orbit at a height $R_E$ above the surface. Ignoring the Earth's rotation and air resistance, how much energy is needed to take it from rest on the surface into this orbit? Take $R_E = 6.4 \times 10^6$ m.

---

On the surface (at rest): $E_1 = -\dfrac{GM_Em}{R_E}$.

In orbit ($r = 2R_E$): $E_2 = -\dfrac{GM_Em}{2(2R_E)} = -\dfrac{GM_Em}{4R_E}$.

$\Delta E = \dfrac{3}{4}\,\dfrac{GM_Em}{R_E} = \dfrac{3}{4}\,mgR_E$.

$\Delta E = 0.75 \times 200 \times 10 \times 6.4 \times 10^6 =$ **9.6 × 10⁹ J**.
:::
