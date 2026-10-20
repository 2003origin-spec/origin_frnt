---
title: "Work, Energy and Power: Short Notes"
type: short_notes
chapter: c11.physics.work-energy-and-power
order: 2
---

## 1. The scalar product

The scalar (dot) product of two vectors is a **scalar**:
$$\vec A\cdot\vec B = AB\cos\theta$$

- It is $A$ times the component of $\vec B$ along $\vec A$ (or $B$ times the component of $\vec A$ along $\vec B$).
- **Commutative:** $\vec A\cdot\vec B = \vec B\cdot\vec A$. **Distributive:** $\vec A\cdot(\vec B + \vec C) = \vec A\cdot\vec B + \vec A\cdot\vec C$.
- In components: $\vec A\cdot\vec B = A_xB_x + A_yB_y + A_zB_z$, because $\hat i\cdot\hat i = 1$ and $\hat i\cdot\hat j = 0$.
- $\vec A\cdot\vec B = 0$ for non-zero vectors means they are **perpendicular**.

:::example{title="Angle between two vectors"}
$\vec A = \hat i + \hat j$, $\vec B = \hat i - \hat j$. $\vec A\cdot\vec B = 1 - 1 = 0$, so the angle is $90^\circ$.
:::

## 2. Work

Work is done when a force acts on a body and the body moves with a component of displacement along the force.
$$W = \vec F\cdot\vec d = Fd\cos\theta$$

| Angle $\theta$ | Work | Example |
| --- | --- | --- |
| $0^\circ \le \theta < 90^\circ$ | Positive | Gravity on a falling ball |
| $\theta = 90^\circ$ | Zero | Normal force on a block sliding on a level floor |
| $90^\circ < \theta \le 180^\circ$ | Negative | Kinetic friction on a sliding block |

- Work is a **scalar**. Unit: joule (J), $1\ \text{J} = 1\ \text{N m}$. Dimensions $[ML^2T^{-2}]$.
- **Zero work** when: the displacement is zero (pushing a wall), the force is zero (a body moving at constant velocity in free space), or the force is perpendicular to the displacement.
- Work depends on the **frame** in which the displacement is measured.

## 3. Kinetic energy and the work-energy theorem

**Kinetic energy** is the energy a body has because of its motion: $K = \tfrac12 mv^2$. It is a scalar and never negative.

**Work-energy theorem:** the change in kinetic energy equals the work done by the **net** force.
$$K_f - K_i = W$$

- It comes from Newton's second law, so it holds in every inertial frame. (In a non-inertial frame, include the pseudo forces.)
- It works for variable forces too. The KE side needs only the start and end speeds, not the time or the acceleration.
- It is a **scalar** statement. It has no direction information, so it can't replace Newton's laws completely.

:::example{title="Stopping distance"}
A car brakes with a constant force $F$. From speed $v$: $Fs = \tfrac12 mv^2$, so $s \propto v^2$. Double the speed, four times the stopping distance.
:::

## 4. Work by a variable force

When the force changes with position, split the path into tiny steps $\Delta x$ and add $F\,\Delta x$:
$$W = \int_{x_i}^{x_f} F(x)\,dx$$

- This is the **area under the $F$–$x$ graph**.
- Area above the $x$-axis is positive work; area below it is negative work.

## 5. Potential energy

**Potential energy** is the "stored" energy a body has because of its position or configuration (shape).

- It exists only for **conservative forces**. Work done against such a force is stored and can be fully recovered.
- **Gravitational PE** near the Earth: $V = mgh$, measured from a zero level you choose. Only **changes** in $V$ matter, so the zero level is your choice.
- For a conservative force in one dimension: $F(x) = -\dfrac{dV}{dx}$.
- Dimensions of PE are the same as of work and KE: $[ML^2T^{-2}]$.

**A force is conservative if:**
1. it can be written as $F(x) = -dV/dx$;
2. the work it does depends only on the start and end points, not on the path;
3. the work it does around any **closed path** is zero.

| Conservative | Non-conservative |
| --- | --- |
| Gravity | Kinetic friction |
| Spring force | Air drag, viscous drag |
| Electrostatic force | |

## 6. Conservation of mechanical energy

If only conservative forces do work, the total mechanical energy stays constant:
$$K + V = \text{constant}$$

- As a body falls, $V$ falls and $K$ rises by the same amount.
- Speed after a fall from rest through $h$: $v = \sqrt{2gh}$, the same for every mass and every smooth path.
- With friction or drag, mechanical energy is **not** conserved. The lost mechanical energy becomes heat, sound and so on. Use: work by non-conservative forces $= \Delta K + \Delta V$.

:::remember
NCERT works out a bob on a string given a speed $v_0$ at the lowest point. To just complete the circle (string slack only at the top): $v_0 = \sqrt{5gL}$ at the bottom, $v = \sqrt{3gL}$ when the string is horizontal, and $v = \sqrt{gL}$ at the top. At the top, tension is zero and gravity alone gives the centripetal force.
:::

## 7. Potential energy of a spring

An ideal spring obeys **Hooke's law**: $F_s = -kx$. The minus sign means the force always acts **towards** the natural length (a restoring force).

- $k$ = spring constant (N/m). A stiff spring has a large $k$.
- Work by the spring when stretched from $0$ to $x_m$: $W_s = -\tfrac12 kx_m^2$. Work by the **pulling** force: $+\tfrac12 kx_m^2$.
- The spring force is conservative, with $V(x) = \tfrac12 kx^2$ (zero at natural length).
- A block oscillating on a spring on a smooth surface: $\tfrac12 kx_m^2 = \tfrac12 kx^2 + \tfrac12 mv^2$. KE is largest at $x = 0$; PE is largest at $x = \pm x_m$.

:::example{title="Spring stops a block"}
A 1 kg block at 4 m/s hits a spring with $k = 400$ N/m on a smooth floor. $\tfrac12 kx_m^2 = \tfrac12 mv^2$ gives $x_m = v\sqrt{m/k} = 4 \times 0.05 = 0.2$ m.
:::

## 8. Power

Power is the **rate of doing work**.

- Average power $P_{av} = W/t$. Instantaneous power $P = dW/dt = \vec F\cdot\vec v$.
- Power is a scalar. Unit: watt (W) $= 1$ J/s. Dimensions $[ML^2T^{-3}]$.
- $1$ horsepower (hp) $= 746$ W.
- The **kilowatt hour** (kWh) is energy, not power: $1\ \text{kWh} = 3.6\times10^6$ J. Electricity bills count kWh ("units").

## 9. Collisions

In a collision, two bodies push on each other for a short time. External forces are negligible during that time.

| Type | Momentum | Kinetic energy |
| --- | --- | --- |
| Elastic | Conserved | Conserved (same before and after) |
| Inelastic | Conserved | Not conserved (some is lost) |
| Completely inelastic | Conserved | Largest loss; bodies stick together |

- **Total energy** is always conserved. In an inelastic collision the "lost" KE becomes heat, sound or deformation.
- Even in an elastic collision, KE is **not** conserved **during** the brief contact: some is stored as deformation and given back.

**1-D elastic, $m_2$ at rest:**
- Equal masses: they **swap velocities**. The first stops; the second moves off with $v_{1i}$.
- $m_1 \gg m_2$ (heavy hits light): the heavy body hardly slows; the light one moves off at about $2v_{1i}$.
- $m_1 \ll m_2$ (light hits heavy): the light body bounces back at about $-v_{1i}$; the heavy one hardly moves.
- A neutron loses the most energy when it hits a nucleus of about its own mass. So light nuclei (for example deuterium, in heavy water) are used to slow down neutrons in a nuclear reactor.

**2-D collisions:** momentum is conserved along $x$ and along $y$ separately. For an elastic collision of **equal masses** with one at rest, the two bodies move off at **90°** to each other (unless it is head-on).
