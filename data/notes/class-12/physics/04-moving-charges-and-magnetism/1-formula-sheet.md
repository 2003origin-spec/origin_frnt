---
title: "Moving Charges and Magnetism: Formula Sheet"
type: formula_sheet
chapter: c12.physics.moving-charges-and-magnetism
order: 1
---

Constant used throughout (NCERT): $\dfrac{\mu_0}{4\pi} = 10^{-7}$ T m/A, so $\mu_0 = 4\pi \times 10^{-7}$ T m/A. All formulas are for **steady currents** in vacuum (or air).

## Force on a moving charge

:::formula{title="Lorentz force"}
$$\vec F = q\,(\vec E + \vec v \times \vec B)$$
$$F_{mag} = qvB\sin\theta$$
$q$ in C, $\vec v$ in m/s, $\vec E$ in N/C, $\vec B$ in tesla (T); $\theta$ = angle between $\vec v$ and $\vec B$. The magnetic force is zero if $\vec v \parallel \vec B$ (or antiparallel) or $v = 0$. It is perpendicular to $\vec v$, so it **does no work**. Reversed for a negative charge.
:::

:::formula{title="Unit of B"}
$$1\ \text{T} = 1\ \text{N s C}^{-1}\text{m}^{-1}$$
$= 1$ N A⁻¹ m⁻¹; dimensions $[\text{M T}^{-2}\text{A}^{-1}]$. 1 gauss $= 10^{-4}$ T (not SI). Earth's field is about $3.6 \times 10^{-5}$ T (NCERT).
:::

:::formula{title="Force on a straight wire"}
$$\vec F = I\,\vec l \times \vec B$$
$\vec l$ points along the current; $F = IlB\sin\theta$. $\vec B$ = **external** field. Straight wire, uniform field; for any shape, add up $I\,d\vec l \times \vec B$.
:::

## Charge in a uniform magnetic field

:::formula{title="Circle (v perpendicular to B)"}
$$r = \frac{mv}{qB}$$
Derived forms (not in NCERT): $r = \dfrac{\sqrt{2mK}}{qB}$ for kinetic energy $K$; $r = \dfrac{1}{B}\sqrt{\dfrac{2mV}{q}}$ after acceleration from rest through p.d. $V$.
:::

:::formula{title="Cyclotron frequency"}
$$\nu_c = \frac{qB}{2\pi m}$$
$$T = \frac{2\pi m}{qB}$$
Angular frequency $\omega = qB/m$ (rad/s). Independent of the speed, the energy and the radius.
:::

:::formula{title="Helix (v at angle θ to B)"}
$$r = \frac{m v\sin\theta}{qB}$$
$$p = v_\parallel T = \frac{2\pi m\,v\cos\theta}{qB}$$
$p$ = pitch, the distance moved along $\vec B$ in one turn. Only $v_\perp = v\sin\theta$ makes the circle; $v_\parallel = v\cos\theta$ stays constant.
:::

:::formula{title="Velocity selector (exam extra, not in NCERT)"}
$$v = \frac{E}{B}$$
$\vec E$, $\vec B$, $\vec v$ mutually perpendicular, the two forces opposite: a particle of this speed goes straight, whatever its charge or mass. Both syllabi list "force on a moving charge in uniform magnetic and electric fields".
:::

## Biot-Savart law

:::formula{title="Field of a current element"}
$$d\vec B = \frac{\mu_0}{4\pi}\,\frac{I\,d\vec l \times \vec r}{r^3}$$
$$dB = \frac{\mu_0}{4\pi}\,\frac{I\,dl\sin\theta}{r^2}$$
$\vec r$ goes from the element to the point P; $\theta$ = angle between $d\vec l$ and $\vec r$. $dB = 0$ along the line of the element. Also $\varepsilon_0\mu_0 = 1/c^2$; $\mu_0$ has dimensions $[\text{M L T}^{-2}\text{A}^{-2}]$.
:::

:::formula{title="Circular loop: axis and centre"}
$$B = \frac{\mu_0 I R^2}{2(x^2 + R^2)^{3/2}}$$
$$B_0 = \frac{\mu_0 N I}{2R}$$
$R$ = radius, $x$ = distance from the centre along the axis. $B_0$ = field at the centre of $N$ closely wound turns (for $N$ turns, multiply the axis formula by $N$ too). Direction by the right-hand thumb rule.
:::

:::formula{title="Arc at its centre"}
$$B = \frac{\mu_0 I}{4\pi R}\,\phi$$
$\phi$ = angle of the arc at the centre, **in radians**. Semicircle: $B = \mu_0 I/4R$, half a full loop (NCERT Example 4.5). Straight parts whose line passes through the centre add nothing. The general arc form is an exam extra (not in NCERT).
:::

:::formula{title="Finite straight wire (exam extra, not in NCERT)"}
$$B = \frac{\mu_0 I}{4\pi d}(\sin\phi_1 + \sin\phi_2)$$
$d$ = perpendicular distance of P from the wire's line; $\phi_1$, $\phi_2$ = angles of the two ends at P, from that perpendicular (if its foot is outside the wire, the nearer end's angle is negative). $\phi_1 = \phi_2 = 90^\circ$ gives the long wire. The syllabi name only the loop as a Biot-Savart application, but JEE Main square-loop questions use this.
:::

## Ampere's circuital law

:::formula{title="Ampere's law"}
$$\oint \vec B \cdot d\vec l = \mu_0 I$$
$I$ = net current through the surface bounded by the loop; positive along the thumb when the right-hand fingers curl along the loop. Simplified form $BL = \mu_0 I_e$ only if $\vec B$ is tangential and constant over a length $L$ of the loop, and normal or zero elsewhere.
:::

:::formula{title="Long straight wire"}
$$B = \frac{\mu_0 I}{2\pi r}$$
$$B_{in} = \frac{\mu_0 I r}{2\pi a^2}$$
$r$ = perpendicular distance from the wire; field lines are circles round it. $B_{in}$: inside a thick wire of radius $a$ with uniform current ($r < a$, NCERT Example 4.7); outside, the first formula holds. Largest at the surface. Exam extra (Ampere's law): inside a long **hollow** pipe with current along its length, $B = 0$.
:::

:::formula{title="Long solenoid"}
$$B = \mu_0 n I$$
$n$ = turns per unit length ($N/L$), not the total turns. Uniform inside, about zero outside; needs length much larger than radius. Exam extra (not in NCERT): on the axis at either end of a long solenoid, $B = \tfrac12\mu_0 nI$.
:::

## Force between parallel currents

:::formula{title="Force per unit length"}
$$f = \frac{\mu_0 I_a I_b}{2\pi d}$$
Long parallel wires, $d$ = separation (m), $f$ in N/m. Same direction: attract. Opposite: repel. On a length $L$: $F = fL$.
:::

## Torque on a loop and magnetic dipole

:::formula{title="Torque in a uniform field"}
$$\vec\tau = \vec m \times \vec B$$
$$\tau = NIAB\sin\theta$$
$\vec m = NI\vec A$ (unit A m² = J/T), direction by the right-hand thumb rule. $\theta$ = angle between $\vec m$ (the **normal**) and $\vec B$. Net force zero. Largest torque $NIAB$ when the plane of the loop is along $\vec B$.
:::

:::formula{title="Potential energy (NCERT Chapter 5)"}
$$U = -\vec m \cdot \vec B = -mB\cos\theta$$
$$W = mB(\cos\theta_1 - \cos\theta_2)$$
$W$ = work needed to turn from $\theta_1$ to $\theta_2$. $\theta = 0$: stable ($U = -mB$). $\theta = 180^\circ$: unstable ($U = +mB$).
:::

:::formula{title="Small loop far away (x much larger than R)"}
$$B_{axis} = \frac{\mu_0}{4\pi}\,\frac{2m}{x^3}$$
$$B_{plane} = \frac{\mu_0}{4\pi}\,\frac{m}{x^3}$$
$B_{plane}$: in the plane of the loop, at distance $x$ from its centre. Exact for a point dipole. Same form as the electric dipole with $1/\varepsilon_0 \to \mu_0$.
:::

:::formula{title="Revolving electron (exam extra, not in current NCERT)"}
$$m = \frac{evr}{2}$$
$$\frac{m}{L} = \frac{e}{2m_e}$$
From $I = ev/2\pi r$ and $m = I\pi r^2$. $L$ = angular momentum, $m_e$ = electron mass. A use of "current loop as a magnetic dipole", which both syllabi list.
:::

## Moving coil galvanometer

:::formula{title="Deflection and sensitivities"}
$$k\phi = NIAB$$
$$\frac{\phi}{I} = \frac{NAB}{k}$$
$$\frac{\phi}{V} = \frac{NAB}{kR_G}$$
$k$ = torsion constant (N m/rad), $\phi$ = deflection. Radial field, so $\sin\theta = 1$ always and $\phi \propto I$. Current sensitivity in rad/A, voltage sensitivity in rad/V. $R_G$ = coil resistance (NCERT Eq. 4.28 writes $R$).
:::

:::formula{title="Ammeter: shunt in parallel"}
$$r_s = \frac{I_g R_G}{I - I_g}$$
$I_g$ = full-scale current of the galvanometer, $I$ = ammeter range. Ammeter resistance $R_G r_s/(R_G + r_s) \approx r_s$ (NCERT). Exam extra: the $r_s$ formula (both syllabi list the conversion).
:::

:::formula{title="Voltmeter: large resistance in series"}
$$R = \frac{V}{I_g} - R_G$$
$V$ = range. Voltmeter resistance $R_G + R \approx R$ (NCERT). Exam extra: the formula for $R$.
:::
