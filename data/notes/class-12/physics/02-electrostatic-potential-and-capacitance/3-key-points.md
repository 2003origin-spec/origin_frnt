---
title: "Potential and Capacitance: Important Points and Traps"
type: key_points
chapter: c12.physics.electrostatic-potential-and-capacitance
order: 3
---

## Potential

- Potential is a **scalar**: add the values with their signs. Field is a **vector**: add as vectors.
- A positive charge released from rest moves towards **lower** potential. A negative charge released from rest moves towards **higher** potential. Both lose potential energy.
- Work done **by the field** in moving $q$ from A to B $= q(V_A - V_B)$. Work done **by an external agent** (no change in KE) $= q(V_B - V_A)$.

:::trap
$V = 0$ does **not** mean $E = 0$, and $E = 0$ does not mean $V = 0$.
- On the equatorial plane of a dipole: $V = 0$, but $E \neq 0$.
- Midway between two equal **like** charges: $E = 0$, but $V \neq 0$.
- Inside a charged shell or conductor: $E = 0$, but $V$ = the surface value.
:::

- For two **unlike** charges of different size, $V = 0$ at two points on the line through them: one **between** them and one **outside**, both nearer the **smaller** charge. For equal and opposite charges, $V = 0$ on the whole perpendicular bisector (the equatorial plane), and nowhere else on the line.
- For two **like** charges, $V$ is never zero at a finite point (with $V = 0$ at infinity).

:::trap
In $U = qV(\vec r)$, $V$ is the potential due to the **other** (external) charges, not due to $q$ itself. The potential of a point charge at its own position is not defined.
:::

:::remember
- Dipole: $V \propto 1/r^2$, $E \propto 1/r^3$. Point charge: $V \propto 1/r$, $E \propto 1/r^2$.
- Across the surface of a charged shell, $E$ jumps but $V$ is **continuous**.
:::

## Equipotential surfaces

- The field is always **perpendicular** to an equipotential surface. Work done in moving a charge along it is **zero**.
- (Exam extra) Two equipotential surfaces can **never cross**: at the crossing point the field would have two directions.
- (Exam extra) Around a point charge, spheres for **equal steps** of $V$ get farther apart as $r$ grows, because $E$ gets weaker. In a uniform field the planes are equally spaced.

:::tip
"Field points downhill." $\vec E$ always points from high $V$ to low $V$, along the steepest drop. Closely packed equipotentials mean a strong field.
:::

## Potential energy and dipoles

:::trap
For three or more charges, count **every pair once**. Three charges give 3 terms, four charges give 6 terms. Keep the signs of the charges in each term.
:::

- Work needed to separate a system fully (to infinity, ending at rest) $= -U$. For unlike charges $U < 0$, so this work is positive.
- In a **uniform** field a dipole feels **no net force**, only a torque. In a non-uniform field there is a net force too.
- Work to turn a dipole from $\theta = 0^\circ$ to $180^\circ$ $= 2pE$. From $0^\circ$ to $90^\circ$ $= pE$.
- Left free, a dipole in a field **oscillates** about the field direction. It settles along $\vec E$ only if energy is lost (damping).

## Conductors

- Inside a conductor: $E = 0$, no excess charge, $V$ constant. On the surface: $\vec E$ normal to it.
- (Exam extra) On a conductor of uneven shape, $\sigma$ is largest where the surface is most sharply curved (pointed ends), so the field there is strongest. For two spheres far apart and joined by a thin wire (same $V$), $\sigma_1R_1 = \sigma_2R_2$, so the smaller sphere has the larger $\sigma$.

:::trap
**Shielding works one way only.** A charge-free cavity in a conductor is shielded from outside fields. But a charge placed **inside** the cavity does produce a field outside the conductor.
:::

## Capacitors

:::trap
Capacitors combine the **opposite** way to resistors. Series: $1/C = 1/C_1 + 1/C_2$ (smaller than each). Parallel: $C = C_1 + C_2$.
:::

- In series, the **smaller** capacitor gets the **larger** voltage ($V \propto 1/C$, as $Q$ is the same).
- In parallel, the **larger** capacitor gets the **larger** charge ($Q \propto C$, as $V$ is the same).
- $n$ equal capacitors $C$: series gives $C/n$, parallel gives $nC$.
- $C$ does **not** depend on $Q$ or $V$. Doubling $V$ doubles $Q$; $C$ stays the same.

:::trap
**Battery on or off?** Before inserting a dielectric (or changing the gap), check:
- battery connected: $V$ stays fixed, so use $U = \tfrac12CV^2$;
- battery removed: $Q$ stays fixed, so use $U = Q^2/2C$.

A dielectric filling the gap: battery on, $U$ becomes $K$ times; battery off, $U$ becomes $1/K$ times.
:::

- Dielectric constant $K > 1$ for every dielectric ($K = 1$ for vacuum). A metal sheet filling the gap acts like $K \to \infty$ and shorts the capacitor.
- (Exam extra) A slab of thickness $t$, parallel to the plates and of the same area, works like reducing the gap by $t(1 - 1/K)$. Its position in the gap does not matter.
- When two capacitors at different voltages are joined, **charge is conserved but energy is not**. Some energy is lost as heat and radiation.
- (Exam extra) When a battery charges a capacitor, the battery gives energy $QV$, the capacitor stores only $\tfrac12QV$, and the other half is lost as heat in the wires.

:::remember
- 1 F is a very large unit: practical values are μF, nF, pF.
- Dielectric strength of air ≈ $3 \times 10^6$ V m⁻¹.
- The charge **on a capacitor** means the charge on one plate (the higher-potential plate); the total charge is zero.
:::

## NCERT lines to know

:::remember
- The work done by an electrostatic field in moving a charge depends only on the initial and final points, not on the path.
- Electric field is in the direction in which the potential decreases steepest.
- Electrostatic field is zero inside a conductor; any excess charge resides on its surface.
- The energy of a capacitor can be viewed as stored in the electric field between the plates, with energy density $\tfrac12\varepsilon_0E^2$.
:::
