---
title: "Electric Charges and Fields: Short Notes"
type: short_notes
chapter: c12.physics.electric-charges-and-fields
order: 2
---

## 1. Electric charge

- **Electrostatics** studies forces, fields and potentials of charges **at rest**.
- Two kinds of charge: **like charges repel, unlike charges attract**. This property is the **polarity** of charge.
- By convention (Franklin), the charge on a glass rod or on cat's fur is **positive**; on a plastic rod or on silk it is **negative**.
- Rubbing does **not create** charge. Electrons move from one body to the other: glass rubbed with silk loses electrons to the silk. Only a tiny fraction of the electrons moves.
- A **gold-leaf electroscope** detects charge: the leaves get like charge and spread apart. More spread, more charge.

## 2. Conductors and insulators

| Type | Charges free to move? | Examples |
| --- | --- | --- |
| Conductor | Yes | Metals, human body, earth |
| Insulator | No | Glass, plastic, nylon, wood |
| Semiconductor | In between | (NCERT footnote) |

- Charge given to a conductor spreads over its **whole surface**; on an insulator it **stays put**.
- In metals the mobile charges are electrons; in electrolytes, positive and negative ions.
- A metal spoon held in the hand does not stay charged: the charge leaks through your body to the earth.

## 3. Basic properties of charge

A **point charge** is a charged body much smaller than the distances involved.

1. **Additivity:** charges add like real numbers, with signs. Charge is a scalar and, unlike mass, can be negative.
2. **Conservation:** the total charge of an isolated system never changes. Particles may be created (a neutron becomes a proton and an electron), but the **net** charge stays the same.
3. **Quantisation:** every free charge is $q = ne$ ($n$ an integer). Faraday's laws of electrolysis suggested it; Millikan showed it in 1912.

:::remember
At the large scale, charges are huge compared with $e$ (1 µC is about $10^{13}$ electrons' worth), so quantisation can be **ignored**. At the atomic scale it cannot.
:::

**SI unit:** coulomb. 1 C = charge carried by 1 A in 1 s. It is a very big unit, so µC and mC are used.

## 4. Coulomb's law

The force between two point charges at rest is proportional to the **product** of the charges, inversely proportional to the **square** of the distance, and acts **along the line** joining them:
$$F = \frac{1}{4\pi\varepsilon_0}\,\frac{q_1 q_2}{r^2}$$

- Coulomb used a **torsion balance**. Not knowing the charges, he halved them by touching a charged sphere with an identical uncharged one.
- It was found with large spheres, and has been confirmed down to atomic distances ($r \sim 10^{-10}$ m).
- Two charges of 1 C, 1 m apart, push with $9 \times 10^9$ N, so 1 C is huge.
- The two forces are **equal and opposite** (Newton's third law), even for unequal charges.
- The vector form handles both signs: $q_1q_2 > 0$ gives repulsion, $q_1q_2 < 0$ attraction.
- Electric force is about $2.4 \times 10^{39}$ times gravity for an electron and a proton.

:::tip
Gravity still rules at large scales: matter is nearly neutral, so electric forces cancel out. Gravity is only attractive and never cancels.
:::

## 5. Superposition principle

The force on a charge due to many charges is the **vector sum** of the forces due to each one, taken **one at a time**. Each pair force is unchanged by the others. NCERT: all of electrostatics follows from Coulomb's law and superposition.

:::example{title="Charges at the corners of a triangle (NCERT Example 1.5)"}
Equal charges $q$ at the corners of an equilateral triangle push a charge $Q$ at the centroid with three equal forces at $120^\circ$ to each other. **Net force = 0**.
:::

## 6. Electric field

A **source charge** $Q$ sets up a field around it; a charge $q$ placed there feels $\vec F = q\vec E$.

- Field = force per unit positive **test charge**, with the test charge made tiny so it doesn't disturb the source.
- $\vec E$ does **not** depend on the test charge, only on the source and the position.
- Point charge: radially **outward** for $+Q$, **inward** for $-Q$, same size all over a sphere around $Q$.
- Unit: N/C (also V/m). For many charges, add the fields as vectors.

**Why fields matter:** in electrostatics they are just convenient. For **accelerated** charges the effect travels at speed $c$, so the force is delayed; fields (electromagnetic waves) carry energy and are real. Faraday introduced the idea.

**Uniform field (NCERT Example 1.7):** $a = qE/m$. An electron and a proton feel the same size of force, but the heavier proton takes longer to cover the same distance. Their accelerations are huge, so gravity can be ignored.

## 7. Electric field lines

A field line is a curve whose **tangent** gives the direction of the field at each point.

1. They **start on positive** and **end on negative** charges (or at infinity, when the charges do not balance, as for a single charge).
2. They are **continuous** in a charge-free region.
3. Two lines **never cross** (the field would have two directions at one point).
4. Electrostatic lines **never form closed loops** (the field is conservative, Chapter 2).

- **Crowded lines = strong field.** A **uniform** field has parallel, equally spaced lines.
- Only the **relative** density of lines matters, not their number.
- The same number of lines crosses every sphere around a point charge. The area grows as $r^2$, so $E$ falls as $1/r^2$. (Solid angle: $\Delta\Omega = \Delta S/r^2$.)
- Patterns: single $+q$ (lines out), single $-q$ (lines in), two equal positive charges (lines push apart), dipole (lines go from $+$ to $-$).

## 8. Electric flux

Flux measures the field lines crossing a surface: $\Delta\phi = E\,\Delta S\cos\theta$.

- The **area vector** is along the **normal**; on a closed surface it points **outward**.
- Field along the surface ($\theta = 90^\circ$): **zero** flux.
- Flux is a **scalar**. Lines going **out** of a closed surface count $+$, lines coming **in** count $-$.

## 9. Electric dipole

Charges $+q$ and $-q$ a distance $2a$ apart.

- **Dipole moment** $p = q \times 2a$, pointing **from $-q$ to $+q$**.
- Net charge is zero, but the field is **not**: the two fields don't cancel exactly.
- Far away ($r \gg a$) the field falls as $\boldsymbol{1/r^3}$, not $1/r^2$. On the **axis** it points **along** $\vec p$; on the **equatorial plane**, **opposite** to $\vec p$, and half as strong.
- **Point dipole:** $2a \to 0$, $q \to \infty$, $p$ fixed. Its $1/r^3$ formulas are exact.

**Molecules:** in **non-polar** ones (CO₂, CH₄) the centres of $+$ and $-$ charge coincide, so $p = 0$ until a field **induces** one. **Polar** ones (H₂O) have a **permanent** dipole moment.

## 10. Dipole in an external field

**Uniform field:** forces $+q\vec E$ and $-q\vec E$ cancel, so **net force = 0**. They act at different points, so there is a torque $\vec\tau = \vec p \times \vec E$ that turns $\vec p$ towards $\vec E$.

**Non-uniform field:** there is a **net force**. With $\vec p$ along $\vec E$, it pulls towards the **stronger** field; with $\vec p$ opposite, towards the **weaker** field.

This is why a **comb** run through dry hair picks up paper bits: its field **polarises** the paper, and the field is non-uniform, so the paper is pulled to the comb.

## 11. Continuous charge

Spread-out charge is described by a **density**: linear $\lambda$ (C/m), surface $\sigma$ (C/m²), volume $\rho$ (C/m³). Each element is small on our scale but holds many electrons, so quantisation is ignored. Field: split into small pieces, use Coulomb's law on each, and add.

## 12. Gauss's law

$$\phi_{closed} = \frac{q_{enc}}{\varepsilon_0}$$

- True for **any closed surface** (the **Gaussian surface**), any shape or size.
- $q_{enc}$ = charges **inside** only. Charges outside give **zero net** flux, but the field on the surface is due to **all** charges.
- Zero net flux means zero **net** charge inside, not "no charge".
- The surface must not pass through a **point** charge (the field there is undefined); it may pass through a continuous distribution.
- Gauss's law follows from the **inverse-square** law; its failure would mean the $1/r^2$ law is wrong.
- Most useful for **symmetric** charges.

**NCERT Fig. 1.23:** a closed cylinder in a uniform field. Ends give $-ES$ and $+ES$, the curved side 0. Total 0, so the net charge inside is zero.

## 13. Applications of Gauss's law

| Charge | Gaussian surface | Field |
| --- | --- | --- |
| Infinite line | Coaxial cylinder | $\propto 1/r$ |
| Infinite sheet | Box through the sheet | Constant |
| Shell, outside | Concentric sphere | $\propto 1/r^2$ |
| Shell, inside | Concentric sphere | Zero |

- **Line:** radial field; flux only through the curved side, $E \times 2\pi rl = \lambda l/\varepsilon_0$. The infinite length is essential.
- **Sheet:** flux leaves through **both** faces, $2EA = \sigma A/\varepsilon_0$. The field does not depend on distance.
- **Shell:** outside, as if all the charge were at the centre; inside, **zero**. Finding zero field inside confirms the $1/r^2$ law.
- A **solid sphere** with uniform charge also acts like a point charge for points **outside** (NCERT summary).

:::example{title="Early atom model (NCERT Example 1.12)"}
A point nucleus $+Ze$ sits in a uniform sphere of charge $-Ze$, radius $R$. For $r < R$, the enclosed charge is $Ze(1 - r^3/R^3)$, so the field is outward. For $r > R$ the atom is neutral, so $E = 0$. At $r = R$ both give $E = 0$.
:::
