---
title: "Potential and Capacitance: Short Notes"
type: short_notes
chapter: c12.physics.electrostatic-potential-and-capacitance
order: 2
---

## 1. Electrostatic potential energy

- The Coulomb force between charges at rest is **conservative**, like gravity and the spring force. So we can define a potential energy.
- Move a charge $q$ from R to P **without acceleration** (external force $= -$ electric force). The work done by the external force is stored as potential energy: $U_P - U_R = W_{RP}$.
- This work depends only on the end points, **not on the path**.
- Only **differences** of $U$ matter. We are free to pick the zero; the usual choice is $U = 0$ at infinity.

:::remember
Potential energy of $q$ at a point = work done by an external force in bringing $q$ from infinity to that point (without acceleration).
:::

## 2. Electrostatic potential

- **Potential** $V$ = work done per unit positive test charge in bringing it from infinity to the point (without acceleration). It is a **scalar**. Unit: volt, 1 V = 1 J C⁻¹.
- $V_P - V_R = (U_P - U_R)/q$. Only potential **difference** has physical meaning.
- The test charge must be tiny, so that it does not disturb the charges that make the field.

## 3. Potential of a point charge

$$V = \frac{Q}{4\pi\varepsilon_0 r}$$

- Works for both signs: $V > 0$ near a positive charge, $V < 0$ near a negative charge.
- $V \propto 1/r$, but $E \propto 1/r^2$. So $V$ falls off more slowly.
- At the charge itself ($r = 0$), $V$ is not defined (infinite).

## 4. Potential of a dipole

A dipole is $+q$ and $-q$ a small distance $2a$ apart. Dipole moment $p = q \times 2a$, directed from $-q$ to $+q$ (NCERT convention).

$$V = \frac{p\cos\theta}{4\pi\varepsilon_0 r^2}$$

- Valid for $r \gg a$ (exact for a point dipole).
- Depends on $r$ **and** on the angle $\theta$ between $\vec r$ and $\vec p$. It is the same on any cone around $\vec p$ (axially symmetric).
- On the axis: $V = \pm p/(4\pi\varepsilon_0 r^2)$. On the equatorial plane ($\theta = 90^\circ$): $V = 0$.
- Falls as $1/r^2$ (a single charge: $1/r$). The dipole's field falls as $1/r^3$.

## 5. Many charges, and a charged shell

- **Superposition:** the total potential is the **algebraic sum** of the potentials of each charge. No angles, no components.
- **Charged spherical shell** (charge $q$, radius $R$):
  - outside ($r \ge R$): $V = q/(4\pi\varepsilon_0 r)$, as if all the charge were at the centre;
  - inside: $E = 0$, so $V$ is **constant** and equals the surface value $q/(4\pi\varepsilon_0 R)$.
- $E$ jumps at the surface of the shell (zero inside, $\sigma/\varepsilon_0$ just outside), but $V$ is **continuous**.

## 6. Equipotential surfaces

A surface on which $V$ has the same value everywhere. No work is done in moving a charge along it.

| Source | Equipotential surfaces |
| --- | --- |
| Point charge | Concentric spheres centred on the charge |
| Uniform field | Planes perpendicular to the field |
| Dipole, two equal charges | Curved surfaces (NCERT Fig. 2.11) |

- The field is **normal** to the equipotential surface at every point. (If it had a part along the surface, moving a charge along the surface would need work.)

## 7. Field from potential

$$|\vec E| = -\frac{\delta V}{\delta l}$$

- $\delta l$ is taken **normal** to the equipotential surface, in the direction of $\vec E$.
- $\vec E$ points in the direction in which $V$ **decreases fastest**.
- Its size = change of potential per unit distance normal to the equipotential surface.
- Uniform field: $V = Ed$ between two planes a distance $d$ apart along the field.

## 8. Potential energy of a system of charges

- Bring the charges in one by one from infinity and add up the work. The first charge costs nothing.
- Two charges: $U = q_1q_2/(4\pi\varepsilon_0 r_{12})$. Three charges: one term **for each pair**.
- The answer does not depend on the order in which the charges are brought in.
- Like charges: $U > 0$ (work needed to push them together). Unlike charges: $U < 0$ (work needed to pull them apart).

## 9. Potential energy in an external field

- A charge $q$ at a point where the **external** potential is $V(\vec r)$ has $U = qV(\vec r)$. Here $V$ is due to other sources, not to $q$ itself.
- **Electron volt:** energy gained by an electron moving through 1 V. 1 eV = $1.6 \times 10^{-19}$ J; 1 keV $= 10^3$ eV, 1 MeV $= 10^6$ eV.
- Two charges in an external field: $q_1V(\vec r_1) + q_2V(\vec r_2)$ plus their mutual energy.
- **Dipole in a uniform field:** no net force, but a torque $\vec\tau = \vec p \times \vec E$. Potential energy $U = -pE\cos\theta$, zero at $\theta = 90^\circ$.

| Position | $\theta$ | $U$ | Equilibrium |
| --- | --- | --- | --- |
| $\vec p$ along $\vec E$ | 0° | $-pE$ (least) | Stable |
| $\vec p$ across $\vec E$ | 90° | 0 | Not equilibrium |
| $\vec p$ against $\vec E$ | 180° | $+pE$ (most) | Unstable |

## 10. Conductors in electrostatics

Free electrons in a metal move until the field inside is zero. In the static state:

1. $E = 0$ everywhere **inside** a conductor.
2. Just outside a charged conductor, $\vec E$ is **normal** to the surface.
3. Any excess charge sits **only on the surface** (from Gauss's law).
4. $V$ is the **same** throughout the conductor and on its surface.
5. Field just outside: $\vec E = (\sigma/\varepsilon_0)\,\hat n$, outward for $\sigma > 0$, inward for $\sigma < 0$.
6. **Electrostatic shielding:** in a charge-free cavity inside a conductor, $E = 0$, whatever the outside charges and fields. Charges then sit only on the outer surface.

:::example{title="NCERT Example 2.7 in short"}
Aircraft tyres are made slightly conducting, and fuel trucks drag a metal chain, so that charge built up by friction leaks to the ground instead of causing a spark. A bird on a single live wire is safe because there is no potential difference across its body.
:::

## 11. Dielectrics and polarisation

- **Dielectrics** are insulators: no (or very few) free charges.
- **Non-polar molecules** (O₂, H₂): centres of + and − charge coincide. A field **induces** a dipole moment by pulling them apart.
- **Polar molecules** (HCl, H₂O): have a **permanent** dipole moment, randomly oriented by thermal motion. A field **lines them up** (partly).
- Either way the dielectric gets a net dipole moment: it is **polarised**. Polarisation $\vec P$ = dipole moment per unit volume; $\vec P = \varepsilon_0\chi_e\vec E$ for linear isotropic dielectrics.
- Bound charges $\pm\sigma_p$ appear on the faces. Their field **opposes** the applied field and **reduces** it, but never to zero (a conductor cancels it fully).

## 12. Capacitors and capacitance

- A **capacitor** = two conductors separated by an insulator, with charges $+Q$ and $-Q$. Its total charge is zero; "charge on the capacitor" means $Q$.
- $C = Q/V$ depends only on the **geometry** (shape, size, gap) and the **medium**, not on $Q$ or $V$.
- 1 F is huge: for $d = 1$ cm, a 1 F parallel plate capacitor needs $A \approx 10^9$ m² (about 30 km × 30 km). Common units: μF, nF, pF.
- **Dielectric strength** = largest field a medium can stand before it breaks down. Air: about $3 \times 10^6$ V m⁻¹. A large $C$ stores a large $Q$ at a small $V$, so the field stays below breakdown and the charge does not leak away.

## 13. Parallel plate capacitor

- Two large plates, area $A$, gap $d$ ($d^2 \ll A$). Charge densities $\pm\sigma$, $\sigma = Q/A$.
- Field between the plates: $E = \sigma/\varepsilon_0$, uniform, from the + plate to the − plate. Outside: zero.
- $V = Ed$, so $C = \varepsilon_0 A/d$.
- Near the edges the field lines bend outward (**fringing**); we ignore this.

## 14. Effect of a dielectric

- A dielectric filling the gap is polarised. The field inside drops to $E_0/K$ (charge fixed), so $V$ drops and $C$ rises: $C = KC_0$.
- $K = \varepsilon/\varepsilon_0 = C/C_0$ is the **dielectric constant**, always more than 1. $\varepsilon = \varepsilon_0K$ is the permittivity of the medium.
- A slab filling only part of the gap: the field is $E_0$ in the air and $E_0/K$ in the slab. Add the two voltage drops (NCERT Example 2.8).

| Dielectric fills the gap | Battery stays on | Battery removed first |
| --- | --- | --- |
| $V$ | Same | Falls to $V/K$ |
| $Q$ | Rises to $KQ$ | Same |
| $E$ between plates | Same | Falls to $E/K$ |
| Energy $U$ | Rises to $KU$ | Falls to $U/K$ |

## 15. Combinations

| | Series | Parallel |
| --- | --- | --- |
| Same on each | Charge $Q$ | Voltage $V$ |
| Shared out | Voltage | Charge |
| Result | Less than the smallest $C$ | Sum of all $C$ |

- Series: $1/C = 1/C_1 + 1/C_2 + \dots$. The inner plates get equal and opposite charges, so every capacitor carries the same $Q$.
- Parallel: $C = C_1 + C_2 + \dots$, and $Q_i = C_iV$.

## 16. Energy stored

- Charging moves charge from one plate to the other against the field. The work is stored as energy:
$$U = \frac{Q^2}{2C} = \frac12 CV^2 = \frac12 QV$$
- The energy can be thought of as stored **in the field** between the plates, with **energy density** $u = \tfrac12\varepsilon_0E^2$. This holds for any electric field.

:::remember
NCERT Example 2.10: a charged capacitor joined to an equal uncharged one. The charge is shared equally, $V$ halves, and the total energy becomes **half**. The other half is lost as heat and electromagnetic radiation while the charge flows.
:::
