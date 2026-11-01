---
title: "Magnetism and Matter: Formula Sheet"
type: formula_sheet
chapter: c12.physics.magnetism-and-matter
order: 1
---

Constant used throughout: $\mu_0 = 4\pi \times 10^{-7}$ T m A⁻¹, so $\dfrac{\mu_0}{4\pi} = 10^{-7}$ T m A⁻¹.

Direction of $\vec m$ (NCERT convention): along the axis of the magnet, from its **S pole to its N pole**.

## Magnetic moment

:::formula{title="Current loop or solenoid (from Chapter 4)"}
$$m = NIA$$
$N$ = number of turns, $I$ = current (A), $A$ = area of one turn (m²). Unit of $m$: A m² (same as J T⁻¹). Direction by the right-hand rule. A bar magnet has the same $m$ as the solenoid that gives the same field.
:::

## Field of a short bar magnet

These hold only far from the magnet: $r \gg l$, where $l$ is the size of the magnet and $r$ is measured from its **centre**.

:::formula{title="On the axis"}
$$B_A = \frac{\mu_0}{4\pi}\,\frac{2m}{r^3}$$
Points **along** $\vec m$ (on both sides of the magnet). NCERT's summary writes the same thing as $\dfrac{\mu_0 m}{2\pi r^3}$.
:::

:::formula{title="On the equator (normal bisector)"}
$$\vec B_E = -\frac{\mu_0}{4\pi}\,\frac{\vec m}{r^3}$$
Magnitude $\dfrac{\mu_0}{4\pi}\dfrac{m}{r^3}$. The minus sign means it points **opposite** to $\vec m$.
:::

:::formula{title="Axis vs equator"}
$$\frac{B_A}{B_E} = 2$$
Magnitudes, at the **same** distance $r$. Both fall as $1/r^3$: double $r$ and $B$ becomes $1/8$.
:::

## Magnet in a uniform field

$\theta$ = angle between $\vec m$ and $\vec B$.

:::formula{title="Torque"}
$$\vec\tau = \vec m \times \vec B$$
$$\tau = mB\sin\theta$$
Unit N m. It turns $\vec m$ towards $\vec B$. Zero at $\theta = 0^\circ$ and $180^\circ$, largest ($mB$) at $90^\circ$.
:::

:::formula{title="Net force"}
$$\vec F = 0$$
Only in a **uniform** field. In a non-uniform field there is a net force as well as a torque.
:::

:::formula{title="Potential energy"}
$$U = -\vec m\cdot\vec B = -mB\cos\theta$$
Zero of energy chosen at $\theta = 90^\circ$. Minimum $-mB$ at $\theta = 0^\circ$ (stable). Maximum $+mB$ at $\theta = 180^\circ$ (unstable).
:::

:::formula{title="Work to turn the magnet"}
$$W = mB(\cos\theta_1 - \cos\theta_2)$$
Work done by an external torque to turn the magnet slowly from $\theta_1$ to $\theta_2$; it equals $U_2 - U_1$. From $0^\circ$ to $90^\circ$: $mB$. From $0^\circ$ to $180^\circ$: $2mB$.
:::

:::formula{title="Small oscillations (beyond the syllabus)"}
$$T = 2\pi\sqrt{\frac{I}{mB}}$$
$I$ = moment of inertia of the needle about its axis of turning. Only for small angles. It follows from $\tau = mB\sin\theta \approx mB\theta$. The current NCERT book only mentions this set-up (Fig. 5.3(b)), without the formula.
:::

## The electric dipole analogy

:::formula{title="Change these to go from electric to magnetic"}
$$E \to B$$
$$p \to m$$
$$\frac{1}{4\pi\varepsilon_0} \to \frac{\mu_0}{4\pi}$$
Torque $\vec p\times\vec E \to \vec m\times\vec B$. Energy $-\vec p\cdot\vec E \to -\vec m\cdot\vec B$.
:::

## Gauss's law for magnetism

:::formula{title="Net flux through a closed surface"}
$$\phi_B = \sum_{\text{all}} \vec B\cdot\Delta\vec S = 0$$
For **any** closed surface. Flux through one small area: $\Delta\phi_B = \vec B\cdot\Delta\vec S$. Unit: weber, 1 Wb = 1 T m².
:::

## Magnetisation, H and susceptibility

:::formula{title="Magnetisation"}
$$\vec M = \frac{\vec m_{net}}{V}$$
Net magnetic moment per unit volume. Vector, unit A m⁻¹, dimensions [L⁻¹ A].
:::

:::formula{title="Field inside a long solenoid"}
$$B_0 = \mu_0 nI$$
Empty (air) core. $n$ = turns per unit length. With a magnetic core, $B = B_0 + B_m$, where $B_m = \mu_0 M$ comes from the material.
:::

:::formula{title="Magnetic intensity H"}
$$\vec H = \frac{\vec B}{\mu_0} - \vec M$$
Unit A m⁻¹ (same as $M$). Inside a long solenoid $H = nI$, whatever the core.
:::

:::formula{title="Total field in a material"}
$$\vec B = \mu_0(\vec H + \vec M)$$
$H$ = part from outside causes (the current). $M$ = part from the material.
:::

:::formula{title="Susceptibility"}
$$\vec M = \chi \vec H$$
$\chi$ has no unit. Strictly for a linear material (dia- and paramagnets). For a ferromagnet $\chi$ is not a constant (it depends on $H$), but problems that give $\chi$ or $\mu_r$ still use these relations, as NCERT Example 5.5 does.
:::

:::formula{title="Permeability"}
$$\mu_r = 1 + \chi$$
$$\mu = \mu_0\mu_r$$
$$\vec B = \mu \vec H = \mu_0\mu_r \vec H$$
$\mu_r$ has no unit; $\mu$ has the units of $\mu_0$ (T m A⁻¹ = N A⁻²). Know one of $\chi$, $\mu_r$, $\mu$ and you know the other two.
:::

:::formula{title="Magnetising current"}
$$B = \mu_0 n (I + I_M)$$
$$I_M = (\mu_r - 1)I = \chi I$$
$I_M$ = extra current that would give the same $B$ with no core (NCERT Example 5.5). $n$ = turns per unit length.
:::

## Kinds of materials

| | $\chi$ | $\mu_r$ |
| --- | --- | --- |
| Diamagnetic | $-1 \le \chi < 0$ | $0 \le \mu_r < 1$ |
| Paramagnetic | $0 < \chi < \varepsilon$ | $1 < \mu_r < 1 + \varepsilon$ |
| Ferromagnetic | $\chi \gg 1$ | $\mu_r \gg 1$ |

$\varepsilon$ is a small positive number. Typical sizes: diamagnetic $\chi \approx -10^{-5}$, paramagnetic $\chi \approx +10^{-5}$, ferromagnetic $\mu_r > 1000$. Superconductor (perfect diamagnet): $\chi = -1$, $\mu_r = 0$.

## Effect of temperature (exam extra: the JEE Main and NEET syllabi list it; NCERT gives only the idea, not these laws)

:::formula{title="Curie's law (paramagnets)"}
$$\chi \propto \frac{1}{T}$$
$T$ in kelvin. Valid while the magnetisation is far from saturation (field not too strong, temperature not too low). Older NCERT wrote $\chi = \dfrac{C\mu_0}{T}$, $C$ = Curie constant.
:::

:::formula{title="Ferromagnet above its Curie temperature"}
$$\chi \propto \frac{1}{T - T_C}$$
Curie–Weiss law. Only for $T > T_C$. Above $T_C$ (Curie temperature) a ferromagnet becomes paramagnetic. Iron: $T_C \approx 1043$ K.
:::
