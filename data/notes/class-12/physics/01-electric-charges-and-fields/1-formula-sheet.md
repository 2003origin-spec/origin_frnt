---
title: "Electric Charges and Fields: Formula Sheet"
type: formula_sheet
chapter: c12.physics.electric-charges-and-fields
order: 1
---

Below, $k = \dfrac{1}{4\pi\varepsilon_0} \approx 9 \times 10^9$ N m² C⁻² and $\varepsilon_0 = 8.854 \times 10^{-12}$ C² N⁻¹ m⁻² (permittivity of free space). All results are for **vacuum** (air is almost the same).

## Electric charge

:::formula{title="Quantisation of charge"}
$$q = ne$$
$n$ = any integer ($0, \pm1, \pm2, \dots$), $e = 1.6 \times 10^{-19}$ C (NCERT: $1.602192 \times 10^{-19}$ C). Charges also **add** with their signs (additivity), and the total charge of an isolated system never changes (conservation).
:::

:::formula{title="Touching identical conducting spheres"}
$$q' = \frac{q_1 + q_2}{2}$$
Each sphere's charge after contact, signs included. Only for **identical** spheres (used in NCERT Example 1.4).
:::

## Coulomb's law

:::formula{title="Coulomb's law"}
$$F = k\,\frac{|q_1 q_2|}{r^2}$$
$r$ = distance between the charges (m), $F$ in N. Only for **point charges** (sizes much smaller than $r$) at rest.
:::

:::formula{title="Vector form"}
$$\vec F_{21} = k\,\frac{q_1 q_2}{r_{21}^2}\,\hat r_{21}$$
$\vec F_{21}$ = force **on $q_2$ due to $q_1$**; $\hat r_{21}$ points from 1 to 2. Put in the signs: $q_1q_2 > 0$ gives repulsion, $q_1q_2 < 0$ attraction. $\vec F_{12} = -\vec F_{21}$.
:::

:::formula{title="Electric vs gravitational force"}
$$\frac{F_e}{F_G} = \frac{k e^2}{G m_p m_e}$$
$\approx 2.4 \times 10^{39}$ for an electron and a proton. For two protons, put $m_p^2$ in place of $m_p m_e$: $\approx 1.3 \times 10^{36}$ (NCERT Example 1.3). Same at any distance (both go as $1/r^2$).
:::

:::formula{title="In a medium (exam extra)"}
$$F = \frac{k}{K}\,\frac{|q_1 q_2|}{r^2}$$
$K = \varepsilon/\varepsilon_0$ = dielectric constant (no unit; 1 for vacuum). Exam extra: not in NCERT, which defines $K$ only in Chapter 2; dielectrics are in the JEE Main and NEET syllabi. Holds when both charges sit inside one large, uniform dielectric.
:::

:::formula{title="Superposition"}
$$\vec F_1 = \vec F_{12} + \vec F_{13} + \dots + \vec F_{1n}$$
Each pair force is the plain Coulomb force. Add them as **vectors**. Fields add the same way.
:::

:::formula{title="Zero-force point (derived shortcut)"}
$$x = \frac{d}{1 + \sqrt{q_2/q_1}}$$
Distance from $q_1$ between two **like** charges $q_1, q_2$ that are $d$ apart. A third charge here feels no net force. For **unequal unlike** charges the point is **outside**, beyond the smaller one (for equal unlike charges there is no such point). Not an NCERT formula.
:::

## Electric field

:::formula{title="Definition"}
$$\vec E = \lim_{q \to 0} \frac{\vec F}{q}$$
$$\vec F = q\vec E$$
Unit N/C (= V/m). $q$ = small positive test charge. On a negative charge, $\vec F$ is **opposite** to $\vec E$.
:::

:::formula{title="Point charge"}
$$\vec E = k\,\frac{Q}{r^2}\,\hat r$$
$\hat r$ points from $Q$ to the point: outward for $Q > 0$, inward for $Q < 0$.
:::

:::formula{title="Charge in a uniform field"}
$$a = \frac{qE}{m}$$
From rest, ignoring gravity, time to move a distance $h$ along the line of the force:
$$t = \sqrt{\frac{2hm}{qE}}$$
**Depends on mass**, unlike free fall (NCERT Example 1.7).
:::

:::formula{title="Sideways deflection"}
$$y = \frac{qE L^2}{2 m v^2}$$
Charge entering a uniform field at right angles with speed $v$, after moving $L$ forward. Gravity ignored. A parabola, like a horizontal projectile with $g \to qE/m$ (Class 11 ideas; see NCERT Exercise 1.13).
:::

## Charge densities

:::formula{title="Line, surface, volume"}
$$\lambda = \frac{\Delta Q}{\Delta l}$$
$$\sigma = \frac{\Delta Q}{\Delta S}$$
$$\rho = \frac{\Delta Q}{\Delta V}$$
Units: C/m, C/m², C/m³.
:::

## Flux and Gauss's law

:::formula{title="Electric flux"}
$$\Delta\phi = \vec E \cdot \Delta\vec S$$
$$\Delta\phi = E\,\Delta S\cos\theta$$
$\theta$ = angle between $\vec E$ and the **normal** to the area. On a closed surface the normal points **outward**. Unit N m² C⁻¹ (= V m). A scalar.
:::

:::formula{title="Gauss's law"}
$$\oint \vec E \cdot d\vec S = \frac{q_{enc}}{\varepsilon_0}$$
$q_{enc}$ = net charge **inside** the closed surface (any shape). $\vec E$ is the field of **all** charges, inside and outside.
:::

:::formula{title="Charge at the centre of a cube"}
$$\phi_{face} = \frac{q}{6\varepsilon_0}$$
The total $q/\varepsilon_0$ is shared equally by the 6 faces.
:::

## Fields from Gauss's law

:::formula{title="Infinitely long straight wire"}
$$E = \frac{\lambda}{2\pi\varepsilon_0 r}$$
$r$ = perpendicular distance. Radial. Needs an **infinite** wire (good near the middle of a long one).
:::

:::formula{title="Infinite plane sheet"}
$$E = \frac{\sigma}{2\varepsilon_0}$$
Normal to the sheet, **independent of distance**. For a large finite sheet, true near its middle.
:::

:::formula{title="Two parallel sheets, +σ and −σ"}
$$E = \frac{\sigma}{\varepsilon_0}$$
Between the sheets, from $+\sigma$ to $-\sigma$. Zero outside (NCERT Exercise 1.23).
:::

:::formula{title="Thin spherical shell (charge q, radius R)"}
Outside ($r \ge R$):
$$E = \frac{kq}{r^2}$$
Inside ($r < R$): $E = 0$. Just outside the surface, $E = \sigma/\varepsilon_0$, where $q = 4\pi R^2\sigma$.
:::

:::formula{title="Uniformly charged solid sphere"}
Outside ($r \ge R$), like a point charge (NCERT summary):
$$E = \frac{kQ}{r^2}$$
Inside ($r \le R$), from Gauss's law. NCERT does not state this result, but its Example 1.12 (atom model) uses exactly this working; the syllabi name only the wire, sheet and shell:
$$E = \frac{kQr}{R^3}$$
Non-conducting sphere only. A charged **conductor** behaves like the shell.
:::

## Electric dipole

:::formula{title="Dipole moment"}
$$\vec p = q \times 2a\,\hat p$$
$2a$ = separation. Direction **from $-q$ to $+q$** (NCERT). Unit C m.
:::

:::formula{title="On the axis"}
$$E = \frac{2kpr}{(r^2 - a^2)^2}$$
For $r \gg a$:
$$E_{axial} = \frac{2kp}{r^3}$$
$r$ = distance from the centre. Along $\vec p$.
:::

:::formula{title="On the equatorial plane"}
$$E = \frac{kp}{(r^2 + a^2)^{3/2}}$$
For $r \gg a$:
$$E_{eq} = \frac{kp}{r^3}$$
**Opposite** to $\vec p$. At the same large $r$, $E_{axial} = 2E_{eq}$.
:::

:::formula{title="General point (exam extra)"}
$$E = \frac{kp}{r^3}\sqrt{3\cos^2\theta + 1}$$
For $r \gg a$; $\theta$ = angle between $\vec r$ and $\vec p$. Exam extra: NCERT gives only the axis and equatorial cases; the syllabi list "field due to a dipole". $\theta = 0$ and $90^\circ$ give back those two.
:::

:::formula{title="Dipole in a uniform field"}
$$\vec\tau = \vec p \times \vec E$$
$$\tau = pE\sin\theta$$
Net force $= 0$ in a **uniform** field. $\tau_{max} = pE$ at $90^\circ$.
:::

## Dimensions

$E$: [M L T⁻³ A⁻¹]. Flux: [M L³ T⁻³ A⁻¹]. $p$: [L T A]. $\varepsilon_0$: [M⁻¹ L⁻³ T⁴ A²] (from Coulomb's law; not in the NCERT table).
