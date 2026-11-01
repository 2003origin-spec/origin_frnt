---
title: "Electromagnetic Induction: Formula Sheet"
type: formula_sheet
chapter: c12.physics.electromagnetic-induction
order: 1
---

## Magnetic flux

:::formula{title="Flux through a flat area"}
$$\Phi_B = \vec B\cdot\vec A = BA\cos\theta$$
$\theta$ = angle between $\vec B$ and the **area vector** (the normal to the surface), not the plane. Needs a uniform $\vec B$ and a flat surface. Unit: weber, 1 Wb = 1 T m². Flux is a **scalar**.
:::

:::formula{title="Non-uniform field or curved surface"}
$$\Phi_B = \sum_{\text{all}} \vec B_i\cdot d\vec A_i$$
Add up $\vec B\cdot d\vec A$ over every small area element.
:::

## Faraday's law

:::formula{title="Induced emf"}
$$\varepsilon = -\frac{d\Phi_B}{dt}$$
For a closely wound coil of $N$ turns (the same flux through each turn):
$$\varepsilon = -N\frac{d\Phi_B}{dt}$$
$N\Phi_B$ is the **flux linkage**. The minus sign gives the direction (Lenz's law). Unit of emf: volt.
:::

:::formula{title="Average emf and current"}
$$|\varepsilon_{avg}| = \frac{N\,|\Delta\Phi_B|}{\Delta t}$$
$$I = \frac{\varepsilon}{R}$$
A current flows only if the circuit is closed. $R$ = total resistance of the circuit.
:::

## Motional emf

:::formula{title="Rod moving in a field"}
$$\varepsilon = Blv$$
Holds when $\vec B$ is uniform and steady, and the rod ($l$), its velocity ($\vec v$) and $\vec B$ are all **perpendicular** to each other. If the rod is perpendicular to $\vec B$ but $\vec v$ is tilted, use only the part of $\vec v$ that is perpendicular to both the rod and $\vec B$.
:::

:::formula{title="Rod rotating about one end"}
$$\varepsilon = \tfrac12 B\omega R^2$$
Emf between the pivot and the free end (or the ring). $R$ = rod length, $\omega$ = angular speed (rad/s), $\vec B$ uniform and parallel to the axis. A wheel with many spokes gives the **same** emf: the spokes are in parallel.
:::

## Inductance

Inductance = flux linkage ÷ current. Unit: henry, 1 H = 1 Wb/A = 1 V s/A. Dimensions $[\text{M L}^2\text{T}^{-2}\text{A}^{-2}]$. It is a scalar.

:::formula{title="Self-inductance"}
$$N\Phi_B = LI$$
$$\varepsilon = -L\frac{dI}{dt}$$
The self-induced (back) emf opposes any **change** in the current.
:::

:::formula{title="Long solenoid"}
$$L = \mu_r\mu_0 n^2 A l$$
$n$ = turns per metre, $A$ = cross-section area, $l$ = length, $\mu_r = 1$ for air. With $N = nl$ this is $L = \mu_r\mu_0 N^2A/l$. Needs $l \gg$ radius (edge effects ignored).
:::

:::formula{title="Mutual inductance"}
$$N_1\Phi_1 = M_{12}I_2$$
$$\varepsilon_1 = -M_{12}\frac{dI_2}{dt}$$
$$M_{12} = M_{21} = M$$
$M_{12}$ = mutual inductance of coil 1 with respect to coil 2. The equality is general, not only for solenoids.
:::

:::formula{title="Two long coaxial solenoids"}
$$M = \mu_r\mu_0 n_1 n_2\pi r_1^2 l$$
$r_1$ = radius of the **inner** solenoid, $l$ = common length, $n_1, n_2$ = turns per metre.
:::

:::formula{title="Two concentric coplanar loops"}
$$M = \frac{\mu_0\pi r_1^2}{2r_2}$$
Single-turn loops, $r_1 \ll r_2$ (the small loop sits in the nearly uniform field at the big loop's centre).
:::

:::formula{title="Both coils carrying changing currents"}
$$\varepsilon_1 = -L_1\frac{dI_1}{dt} - M_{12}\frac{dI_2}{dt}$$
:::

## Magnetic energy

:::formula{title="Energy stored in an inductor"}
$$U_B = \tfrac12 LI^2$$
Work done against the back emf to build up the current $I$. Compare $\tfrac12 mv^2$: $L$ plays the role of mass.
:::

:::formula{title="Energy density"}
$$u_B = \frac{B^2}{2\mu_0}$$
Energy per unit volume (J/m³), valid wherever there is a magnetic field in vacuum or air. Compare $u_E = \tfrac12\varepsilon_0E^2$.
:::

## AC generator

:::formula{title="Emf of a rotating coil"}
$$\Phi_B = BA\cos\omega t$$
(flux through **one** turn)
$$\varepsilon = NBA\omega\sin\omega t$$
$$\varepsilon_0 = NBA\omega$$
$$\omega = 2\pi\nu$$
$\theta = \omega t$ is the angle between $\vec B$ and the area vector; at $t = 0$ the coil's plane is **perpendicular** to $\vec B$. $\nu$ = revolutions per second. Convert rpm: $\omega = 2\pi \times \text{rpm}/60$.
:::

## Extras (not in the current NCERT chapter)

:::formula{title="Charge that flows (exam extra)"}
$$q = \frac{N\,|\Delta\Phi_B|}{R}$$
$R$ = total resistance of the closed circuit. Depends only on the change in flux, not on how fast it changes. Follows from $I = \varepsilon/R$ and Faraday's law. Unit check: Wb/Ω = V s/Ω = A s = C.
:::

:::formula{title="Rod sliding on rails (exam extra)"}
$$I = \frac{Blv}{R}$$
$$F = \frac{B^2l^2v}{R}$$
$$P = \frac{B^2l^2v^2}{R}$$
$F$ = force needed to keep the speed constant (equal to the magnetic drag $BIl$), $P = Fv$ = Joule heat per second. Rails frictionless, $R$ = total resistance.
:::

:::formula{title="LR circuit (beyond the syllabus)"}
$$I = I_0\left(1 - e^{-t/\tau}\right)$$
$$I = I_0\,e^{-t/\tau}$$
$$\tau = \frac{L}{R}$$
First line: growth after switching on a battery ($I_0 = \varepsilon/R$). Second line: decay when the battery is removed and the coil is shorted through $R$ ($I_0$ = current at that moment). Not in NCERT, and neither syllabus names it (both list only self and mutual inductance); a small aid only. $\tau$ in seconds (H/Ω = s).
:::

:::formula{title="Coupling (exam extra)"}
$$M = k\sqrt{L_1L_2}$$
$0 \le k \le 1$ (coefficient of coupling, no unit); $k = 1$ when there is no flux leakage: all the flux of each coil passes through the other. Not in NCERT; it extends mutual inductance, which both syllabi name.
:::
