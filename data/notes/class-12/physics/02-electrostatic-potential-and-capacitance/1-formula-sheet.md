---
title: "Potential and Capacitance: Formula Sheet"
type: formula_sheet
chapter: c12.physics.electrostatic-potential-and-capacitance
order: 1
---

Constants (NCERT values): $\dfrac{1}{4\pi\varepsilon_0} = 9 \times 10^{9}$ N m² C⁻², $\varepsilon_0 = 8.854 \times 10^{-12}$ C² N⁻¹ m⁻², $e = 1.6 \times 10^{-19}$ C. Potential at infinity is taken as zero throughout.

## Potential and potential energy

:::formula{title="Potential energy difference"}
$$\Delta U = U_P - U_R = W_{RP}$$
$W_{RP}$ = work by an **external** force moving $q$ from R to P without acceleration. Work by the field $= -W_{RP}$. Independent of the path.
:::

:::formula{title="Potential difference"}
$$V_P - V_R = \frac{U_P - U_R}{q}$$
$$W_{RP} = q\,(V_P - V_R)$$
$V$ in volt (1 V = 1 J C⁻¹). Dimensions of $V$: $[\text{M L}^2\text{T}^{-3}\text{A}^{-1}]$. Only differences of $V$ have physical meaning.
:::

:::formula{title="Potential of a point charge"}
$$V(r) = \frac{1}{4\pi\varepsilon_0}\,\frac{Q}{r}$$
$r$ = distance from $Q$ (m). True for either sign of $Q$: $V < 0$ for $Q < 0$. $V \propto 1/r$, while $E \propto 1/r^2$.
:::

:::formula{title="Potential of a dipole"}
$$V = \frac{1}{4\pi\varepsilon_0}\,\frac{p\cos\theta}{r^2}$$
$$V = \frac{1}{4\pi\varepsilon_0}\,\frac{\vec p\cdot\hat r}{r^2}$$
$p = q \times 2a$, from $-q$ to $+q$. $\theta$ = angle between $\vec r$ and $\vec p$. Valid for $r \gg a$ (exact for a point dipole). On the axis $V = \pm\dfrac{p}{4\pi\varepsilon_0 r^2}$ ($+$ for $\theta = 0$, $-$ for $\theta = \pi$). On the equatorial plane $V = 0$.
:::

:::formula{title="System of charges (superposition)"}
$$V = \frac{1}{4\pi\varepsilon_0}\sum_{i} \frac{q_i}{r_{iP}}$$
An **algebraic** (scalar) sum: put the sign of each charge in.
:::

:::formula{title="Uniformly charged spherical shell"}
$$V = \frac{1}{4\pi\varepsilon_0}\,\frac{q}{r} \quad (r \ge R)$$
$$V = \frac{1}{4\pi\varepsilon_0}\,\frac{q}{R} \quad (r \le R)$$
Inside, $E = 0$, so $V$ is constant and equal to its value at the surface. The same holds for a charged conducting sphere.
:::

## Field and potential

:::formula{title="Field from potential"}
$$|\vec E| = -\frac{\delta V}{\delta l}$$
$\delta V$ = change in $V$ over a small distance $\delta l$ taken **along the field**, normal to the equipotential surface. $\delta V$ is negative there, so $|\vec E| = |\delta V|/\delta l$. $\vec E$ points the way $V$ falls fastest.
:::

:::formula{title="Uniform field"}
$$V = E\,d$$
$d$ = distance **along** the field between the two equipotential planes (for a capacitor, the plate gap). Unit of $E$: V m⁻¹ = N C⁻¹.
:::

:::formula{title="Calculus form (exam extra)"}
$$E_x = -\frac{\partial V}{\partial x}$$
$$V_B - V_A = -\int_A^B \vec E\cdot d\vec l$$
Same for $E_y$ and $E_z$. Exam extra: NCERT uses only $\delta V/\delta l$, but JEE Main and NEET both set questions on this form (field and potential relation, in both syllabi).
:::

## Potential energy of charges

:::formula{title="Two charges"}
$$U = \frac{1}{4\pi\varepsilon_0}\,\frac{q_1q_2}{r_{12}}$$
Put in the signs: $U > 0$ for like charges, $U < 0$ for unlike. Work needed to pull them apart to infinity $= -U$.
:::

:::formula{title="Three charges"}
$$\begin{aligned} U = \frac{1}{4\pi\varepsilon_0}\Big(&\frac{q_1q_2}{r_{12}} \\ &+ \frac{q_1q_3}{r_{13}} + \frac{q_2q_3}{r_{23}}\Big) \end{aligned}$$
One term for **each pair**. For $n$ charges there are $n(n-1)/2$ terms.
:::

:::formula{title="Charge in an external field"}
$$U = q\,V(\vec r)$$
$V(\vec r)$ = potential due to the **external** sources only. 1 eV = $1.6 \times 10^{-19}$ J: the energy a charge $e$ gains when it moves through 1 V.
:::

:::formula{title="Two charges in an external field"}
$$\begin{aligned} U = {} & q_1V(\vec r_1) + q_2V(\vec r_2) \\ & + \frac{q_1q_2}{4\pi\varepsilon_0\, r_{12}} \end{aligned}$$
:::

:::formula{title="Dipole in a uniform field"}
$$\vec\tau = \vec p \times \vec E$$
$$U(\theta) = -pE\cos\theta = -\vec p\cdot\vec E$$
$$W = pE(\cos\theta_0 - \cos\theta_1)$$
$U = 0$ is chosen at $\theta = 90^\circ$. $W$ = work by the external torque to turn the dipole from $\theta_0$ to $\theta_1$. Net force on the dipole in a **uniform** field = 0.
:::

## Conductors and dielectrics

:::formula{title="Field just outside a charged conductor"}
$$\vec E = \frac{\sigma}{\varepsilon_0}\,\hat n$$
$\sigma$ = surface charge density (C m⁻²), $\hat n$ = outward normal. Inside the conductor $E = 0$.
:::

:::formula{title="Polarisation"}
$$\vec P = \varepsilon_0\,\chi_e\,\vec E$$
$P$ = dipole moment per unit volume (C m⁻²). $\chi_e$ = electric susceptibility. For linear isotropic dielectrics only.
:::

## Capacitance

:::formula{title="Capacitance"}
$$C = \frac{Q}{V}$$
$Q$ = charge on one plate (the other has $-Q$), $V$ = potential difference. 1 F = 1 C V⁻¹. Dimensions $[\text{M}^{-1}\text{L}^{-2}\text{T}^{4}\text{A}^{2}]$ (the table at the end of the NCERT chapter prints $\text{T}^{-4}$, a misprint: $Q/V$ gives $\text{T}^{+4}$). $C$ depends only on geometry and the medium, not on $Q$ or $V$.
:::

:::formula{title="Parallel plate capacitor (vacuum)"}
$$C_0 = \frac{\varepsilon_0 A}{d}$$
$$E = \frac{\sigma}{\varepsilon_0} = \frac{Q}{\varepsilon_0 A}$$
$A$ = area of each plate, $d$ = gap. Needs $d^2 \ll A$ (ignore fringing at the edges). Field is uniform between the plates and zero outside.
:::

:::formula{title="Dielectric filling the whole gap"}
$$C = K C_0 = \frac{\varepsilon_0 K A}{d}$$
$$\varepsilon = \varepsilon_0 K$$
$$K = \frac{\varepsilon}{\varepsilon_0} = \frac{C}{C_0}$$
$K$ = dielectric constant ($K > 1$, no unit). With the charge kept fixed, $E = E_0/K$ inside.
:::

:::formula{title="Slab of thickness t (part of the gap)"}
$$C = \frac{\varepsilon_0 A}{d - t + t/K}$$
Exam extra: the general formula is not in NCERT. Slab parallel to the plates, same area as the plates, $t < d$, anywhere in the gap. NCERT Example 2.8 is the case $t = \tfrac34 d$, giving $C = \dfrac{4K}{K+3}C_0$. A metal slab acts like $K \to \infty$: $C = \dfrac{\varepsilon_0 A}{d - t}$.
:::

:::formula{title="Series combination"}
$$\frac{1}{C} = \frac{1}{C_1} + \frac{1}{C_2} + \dots$$
Same charge $Q$ on each. For two: $C = \dfrac{C_1C_2}{C_1 + C_2}$, and $V_1 = \dfrac{C_2}{C_1 + C_2}V$ (the **smaller** $C$ takes the **larger** voltage).
:::

:::formula{title="Parallel combination"}
$$C = C_1 + C_2 + \dots$$
Same $V$ across each. $Q_i = C_iV$, so charge divides in the ratio of the capacitances.
:::

:::formula{title="Energy stored"}
$$U = \frac{Q^2}{2C} = \frac12 CV^2 = \frac12 QV$$
All three forms are always equal. To compare before and after a change, use $Q^2/2C$ when $Q$ is fixed (battery removed) and $\tfrac12 CV^2$ when $V$ is fixed (battery connected).
:::

:::formula{title="Energy density of an electric field"}
$$u = \frac12\,\varepsilon_0 E^2$$
Energy per unit volume (J m⁻³). True for any field in vacuum. In a dielectric, $u = \tfrac12\varepsilon_0 K E^2$ (exam extra).
:::

## Exam extras (not in NCERT, but JEE Main and NEET use them)

:::formula{title="Isolated sphere"}
$$C = 4\pi\varepsilon_0 R$$
A single conducting sphere of radius $R$, the other "plate" at infinity.
:::

:::formula{title="Sharing charge between two capacitors"}
$$V_{\text{common}} = \frac{C_1V_1 + C_2V_2}{C_1 + C_2}$$
$$\Delta U = \frac{C_1C_2\,(V_1 - V_2)^2}{2\,(C_1 + C_2)}$$
Positive plates joined together. $\Delta U$ = energy lost as heat and radiation. It is never zero unless $V_1 = V_2$.
:::

:::formula{title="Force between the plates"}
$$F = \frac{Q^2}{2\varepsilon_0 A}$$
Attractive. Each plate feels the field of the **other** plate only, $\sigma/2\varepsilon_0$, not $\sigma/\varepsilon_0$.
:::
