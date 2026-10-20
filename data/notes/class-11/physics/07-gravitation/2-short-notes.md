---
title: "Gravitation: Short Notes"
type: short_notes
chapter: c11.physics.gravitation
order: 2
---

## 1. From the sky to Kepler

- Every object near the Earth falls towards it. Newton saw that the same pull keeps the Moon and the planets in their orbits.
- The **geocentric** model (Ptolemy, about 2000 years ago) put the Earth at the centre. NCERT notes that Aryabhata (5th century AD) had already mentioned a Sun-centred (**heliocentric**) model in his treatise. About a thousand years later, Copernicus proposed a full model with the planets moving in circles round a fixed Sun.
- Kepler studied Tycho Brahe's careful records of planet positions and found three laws.

## 2. Kepler's three laws

1. **Law of orbits:** every planet moves in an **ellipse**, with the Sun at one **focus** (not at the centre).
2. **Law of areas:** the line from the Sun to a planet sweeps out **equal areas in equal times**. So a planet moves **faster** when it is closer to the Sun.
3. **Law of periods:** $T^2 \propto a^3$, where $a$ is the semi-major axis of the ellipse.

- **Perihelion** = closest point to the Sun; **aphelion** = farthest point.
- The semi-major axis $a$ is half the long axis: $a = (r_P + r_A)/2$.

:::remember
The law of areas is **conservation of angular momentum**. Gravity on a planet points along the line to the Sun (a central force), so it has no torque about the Sun. Then $\Delta A/\Delta t = L/2m$ stays constant.
:::

## 3. Universal law of gravitation

Every body attracts every other body with a force
$$F = \frac{G\,m_1 m_2}{r^2}$$

- The force is **attractive** and acts along the line joining the two point masses.
- The two forces form an action–reaction pair: **equal in size**, opposite in direction, even if one mass is far bigger.
- With many masses, add the forces as vectors (**superposition**).
- For extended bodies, add up the forces from all their small parts. The shell theorem makes spheres easy.

**Shell theorem** (uniform shell):
- A point mass **outside** is pulled as if the whole shell mass were at its **centre**.
- A point mass **inside** feels **zero** net force from the shell.

A uniform solid sphere is a set of shells, so outside it also acts like a point mass at its centre.

:::example{title="Why the Earth hardly moves"}
A 0.2 kg apple and the Earth pull each other with the same force, about 2 N. The apple's acceleration is $2/0.2 = 10$ m/s². The Earth's is $2/(6 \times 10^{24}) \approx 3 \times 10^{-25}$ m/s², far too small to notice.
:::

## 4. The constant G

- $G = 6.67 \times 10^{-11}$ N m² kg⁻². It is the same for all bodies, everywhere.
- First measured by **Henry Cavendish (1798)** with a torsion balance: two small lead spheres on a rod hung from a thin wire, attracted by two large lead spheres. The twist of the wire gives the force, and from it $G$.
- $G$ is very small, so gravity between everyday objects is tiny. It matters only when at least one mass is huge.

## 5. Acceleration due to gravity

Treat the Earth as a uniform sphere of mass $M_E$ and radius $R_E$. At the surface, $mg = GM_Em/R_E^2$, so
$$g = \frac{GM_E}{R_E^2}$$

- $g$ does not depend on the mass of the falling body.
- Knowing $g$, $R_E$ and $G$ gives $M_E = gR_E^2/G \approx 6 \times 10^{24}$ kg.
- $g$ is about 9.8 m/s² at the surface (rotation ignored).

## 6. g above and below the surface

| Place | Formula | Behaviour |
| --- | --- | --- |
| Height $h$ | $g\dfrac{R_E^2}{(R_E + h)^2}$ | Falls as $1/r^2$ |
| Small $h$ | $g\left(1 - \dfrac{2h}{R_E}\right)$ | Only for $h \ll R_E$ |
| Depth $d$ | $g\left(1 - \dfrac{d}{R_E}\right)$ | Falls linearly to 0 |

- **Below the surface:** at depth $d$, the outer shell (thickness $d$) pulls with zero net force. Only the inner sphere of radius $R_E - d$ counts. Its mass is $M_E(R_E - d)^3/R_E^3$, which gives the depth formula.
- So in this uniform-density model, $g$ is **largest at the surface**. It decreases going up and going down, and is **zero at the centre**.

## 7. Gravitational potential energy

- Gravity is a **conservative** force, so it has a potential energy. The work done against it depends only on the start and end points.
- Near the surface ($h \ll R_E$), $g$ is nearly constant and $\Delta U = mgh$.
- Far from the surface, $g$ changes. Taking $U = 0$ at infinity:
$$U(r) = -\frac{GM_Em}{r}$$
- $U$ is **negative** everywhere at a finite distance. It rises (gets less negative) as $r$ grows.
- Two point masses: $U = -Gm_1m_2/r$. For many masses, add the $U$ of every pair (it is a scalar sum).
- **Gravitational potential** $V$ = potential energy per unit mass: $V = -GM_E/r$ (J/kg).

## 8. Escape speed

The least speed a body needs at the surface to go to infinity and never return. At infinity it may just reach zero speed, so energy conservation gives
$$\frac12 mv_e^2 = \frac{GM_Em}{R_E}$$
$$v_e = \sqrt{2gR_E} \approx 11.2 \text{ km/s}$$

- $v_e$ does not depend on the mass of the body, or on the direction it is thrown (air resistance ignored).
- The Moon's escape speed is only about 2.3 km/s. Gas molecules there can reach this speed, so they escape, and the Moon has **no atmosphere**.

## 9. Earth satellites

- A satellite is a body that orbits a planet. The Moon is Earth's natural satellite. Artificial satellites are used for communication, weather and remote sensing.
- In a circular orbit of radius $r = R_E + h$, gravity supplies the centripetal force:
$$\frac{mv^2}{r} = \frac{GM_Em}{r^2}$$
$$v = \sqrt{\frac{GM_E}{r}}$$
- Period $T = 2\pi r/v$, which gives $T^2 = \dfrac{4\pi^2}{GM_E}r^3$ (Kepler's third law for satellites).
- Close to the surface: $v \approx \sqrt{gR_E} \approx 7.9$ km/s and $T \approx 85$ minutes.
- A higher orbit means a **smaller speed** and a **longer period**.

## 10. Energy of an orbiting satellite

| Energy | Value |
| --- | --- |
| Kinetic $K$ | $+\dfrac{GM_Em}{2r}$ |
| Potential $U$ | $-\dfrac{GM_Em}{r}$ |
| Total $E$ | $-\dfrac{GM_Em}{2r}$ |

- $E < 0$: the satellite is **bound** to the Earth. To free it, you must supply energy $|E|$.
- A higher orbit has **more** total energy (less negative), even though its kinetic energy is smaller.
- In an elliptical orbit, $K$ and $U$ change from point to point, but the total energy stays constant and negative (NCERT). (Exam extra: $E = -GMm/2a$, with $a$ the semi-major axis.)

## 11. Weightlessness (NCERT "Points to ponder")

The full section was removed from the rationalised book, but NCERT still states the key idea: an astronaut in an orbiting satellite feels weightless **not** because gravity is small there, but because the astronaut and the satellite are both in **free fall** towards the Earth. Nothing presses on the floor, so a weighing scale reads **zero**. Gravity still acts.

## 12. Exam extras (dropped from the rationalised NCERT book)

- **Geostationary satellite:** period 24 h, orbit over the equator, moving west to east like the Earth. It stays above one point on the ground, about 35,800 km up. Used for communication (TV, telephone).
- **Polar satellite:** low orbit (about 500–800 km) passing over the poles, period about 100 minutes. The Earth turns under it, so it scans the whole surface: used for remote sensing and weather.
