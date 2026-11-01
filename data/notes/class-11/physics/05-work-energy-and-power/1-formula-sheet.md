---
title: "Work, Energy and Power: Formula Sheet"
type: formula_sheet
chapter: c11.physics.work-energy-and-power
order: 1
---

## Scalar (dot) product

:::formula{title="Dot product"}
$$\vec A\cdot\vec B = AB\cos\theta$$
$$\vec A\cdot\vec B = A_xB_x + A_yB_y + A_zB_z$$
$\theta$ = angle between $\vec A$ and $\vec B$ (tails together). The answer is a **scalar**. It is positive for $\theta < 90^\circ$, zero at $90^\circ$, negative for $\theta > 90^\circ$.
:::

:::formula{title="Unit vectors and angle"}
$$\hat i\cdot\hat i = \hat j\cdot\hat j = \hat k\cdot\hat k = 1$$
$$\hat i\cdot\hat j = \hat j\cdot\hat k = \hat k\cdot\hat i = 0$$
$$\cos\theta = \frac{\vec A\cdot\vec B}{AB}$$
Also $\vec A\cdot\vec A = A^2$. The dot product is commutative and distributive.
:::

:::formula{title="Projection"}
$$B\cos\theta = \frac{\vec A\cdot\vec B}{A}$$
The component of $\vec B$ along $\vec A$.
:::

## Work

:::formula{title="Work by a constant force"}
$$W = \vec F\cdot\vec d = Fd\cos\theta$$
$F$ = force (N), $d$ = displacement of the point where the force acts (m), $\theta$ = angle between $\vec F$ and $\vec d$. $W$ in joule (J), 1 J = 1 N m. Only for a **constant** force.
:::

:::formula{title="Work by a variable force (1-D)"}
$$W = \int_{x_i}^{x_f} F(x)\,dx$$
Equals the **area under the $F$–$x$ graph** from $x_i$ to $x_f$. Area below the $x$-axis counts as negative.
:::

:::formula{title="Units of work and energy"}
$$1\ \text{erg} = 10^{-7}\ \text{J}$$
$$1\ \text{eV} = 1.6\times10^{-19}\ \text{J}$$
$$1\ \text{cal} = 4.186\ \text{J}$$
$$1\ \text{kWh} = 3.6\times10^{6}\ \text{J}$$
Dimensions of work and energy: $[ML^2T^{-2}]$. The kWh is a unit of **energy**, not power.
:::

## Kinetic energy and the work-energy theorem

:::formula{title="Kinetic energy"}
$$K = \frac12 mv^2$$
$$K = \frac{p^2}{2m}$$
$m$ = mass (kg), $v$ = speed (m/s), $p = mv$ = momentum. $K$ is a scalar and never negative. (The $p^2/2m$ form follows from $p = mv$.)
:::

:::formula{title="Work-energy theorem"}
$$K_f - K_i = W_{net}$$
$W_{net}$ = total work by **all** forces (conservative and non-conservative). Holds for constant and variable forces.
:::

## Potential energy

:::formula{title="Gravitational potential energy"}
$$V = mgh$$
$h$ = height above the chosen zero level (m). Valid only near the Earth's surface ($h$ much smaller than the Earth's radius), where $g$ is constant.
:::

:::formula{title="Force from potential energy"}
$$F(x) = -\frac{dV}{dx}$$
Only for a **conservative** force. Also $\Delta V = -W_c$: the work done by the conservative force is the decrease in $V$.
:::

:::formula{title="Conservation of mechanical energy"}
$$K_i + V_i = K_f + V_f$$
Holds only when **only conservative forces** do work (no friction, no air drag).
:::

:::formula{title="Speed after falling through h"}
$$v = \sqrt{2gh}$$
From rest, no friction or air drag. Same for any mass and any smooth path (free fall or a smooth slide).
:::

:::formula{title="With friction or drag (from the work-energy theorem)"}
$$W_{nc} = \Delta K + \Delta V$$
$W_{nc}$ = work by non-conservative forces (friction, drag). It is negative for friction, so mechanical energy falls.
:::

:::formula{title="Bob just completing a vertical circle (NCERT Example 5.7)"}
$$v_0 = \sqrt{5gL}$$
$$v_C = \sqrt{gL}$$
$L$ = string length (m). $v_0$ = speed at the lowest point A, $v_C$ = speed at the top C, where the tension just becomes zero. At the side point B (string horizontal), $v_B = \sqrt{3gL}$, so $K_B/K_C = 3$. To go round with the string taut, the speeds must be **at least** these values (this general "$\ge$" rule is an exam extra).
:::

## Spring

:::formula{title="Spring force (Hooke's law)"}
$$F_s = -kx$$
$k$ = spring constant (N/m), $x$ = extension (+) or compression (−) from the natural length. The force always points back towards $x = 0$. Valid for small $x$ (ideal spring).
:::

:::formula{title="Work by the spring force"}
$$W_s = -\frac12 k x_m^2$$
Pulled from $x = 0$ to $x_m$ (or pushed to $-x_m$). Between any two points:
$$W_s = -\frac12 k\left(x_f^2 - x_i^2\right)$$
:::

:::formula{title="Spring potential energy"}
$$V(x) = \frac12 kx^2$$
Zero at the natural length. The same for extension and compression by the same $x$.
:::

:::formula{title="Block on a spring (smooth surface)"}
$$v_{max} = x_m\sqrt{\frac{k}{m}}$$
$x_m$ = maximum extension or compression. Speed is largest at $x = 0$, zero at $x = \pm x_m$.
:::

## Power

:::formula{title="Average and instantaneous power"}
$$P_{av} = \frac{W}{t}$$
$$P = \frac{dW}{dt}$$
Unit: watt (W), 1 W = 1 J/s. Dimensions $[ML^2T^{-3}]$.
:::

:::formula{title="Power from force and velocity"}
$$P = \vec F\cdot\vec v = Fv\cos\theta$$
Instantaneous power of one force. $1\ \text{hp} = 746$ W.
:::

## Collisions

In every collision **total momentum is conserved** (no external force). Kinetic energy is conserved only in an elastic collision. Notation as in NCERT: mass $m_2$ is at rest before; $v_{1i}$ is the initial velocity of $m_1$; $v_{1f}$, $v_{2f}$ are the final velocities.

:::formula{title="Completely inelastic, 1-D"}
$$v_f = \frac{m_1 v_{1i}}{m_1 + m_2}$$
$$\Delta K = \frac12\,\frac{m_1 m_2}{m_1 + m_2}\,v_{1i}^2$$
The bodies stick together. $\Delta K$ = kinetic energy **lost**.
:::

:::formula{title="Elastic, 1-D (m2 at rest)"}
$$v_{1f} = \frac{m_1 - m_2}{m_1 + m_2}\,v_{1i}$$
$$v_{2f} = \frac{2m_1}{m_1 + m_2}\,v_{1i}$$
Equal masses: $v_{1f} = 0$, $v_{2f} = v_{1i}$ (they swap velocities).
:::

:::formula{title="2-D collision (m2 at rest)"}
$$\begin{aligned} m_1v_{1i} &= m_1v_{1f}\cos\theta_1 \\ &\quad + m_2v_{2f}\cos\theta_2 \end{aligned}$$
$$0 = m_1v_{1f}\sin\theta_1 - m_2v_{2f}\sin\theta_2$$
$\theta_1$, $\theta_2$ = angles of the final velocities with the initial direction, on opposite sides. Elastic, equal masses, $m_2$ at rest and **not head-on** (a glancing collision): $\theta_1 + \theta_2 = 90^\circ$.
:::

## Exam extras (not in the NCERT chapter)

:::formula{title="Coefficient of restitution (1-D)"}
$$e = \frac{v_{2f} - v_{1f}}{v_{1i} - v_{2i}}$$
For a head-on (1-D) collision: relative speed of separation over relative speed of approach. $e = 1$: elastic (NCERT's Eq. 5.25, $v_{2f} - v_{1f} = v_{1i}$, is this case). $e = 0$: completely inelastic. $0 < e < 1$: partly inelastic.
:::

:::formula{title="Elastic, 1-D, both moving"}
$$v_{1f} = \frac{(m_1 - m_2)v_{1i} + 2m_2v_{2i}}{m_1 + m_2}$$
$$v_{2f} = \frac{(m_2 - m_1)v_{2i} + 2m_1v_{1i}}{m_1 + m_2}$$
$v_{2i}$ = velocity of $m_2$ before the collision (zero in NCERT's set-up, which gives back the formulas above). Velocities are signed: pick one direction as positive.
:::

