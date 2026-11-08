---
title: "Mechanical Properties of Solids: Important Points and Traps"
type: key_points
chapter: c11.physics.mechanical-properties-of-solids
order: 3
---

## Stress and strain

- Strain is a ratio of two lengths (or two volumes), so it has **no unit**. Shearing strain $\theta$ is in **radians**.
- Stress has the same unit and dimensions as pressure, but in NCERT stress is the internal **restoring** force per area, not the applied force.

:::trap
A wire hangs from the ceiling with a weight $F$ at its lower end. The ceiling pulls up with $F$ and the weight pulls down with $F$, but the tension at any cross-section is just **F, not 2F**. So the stress is $F/A$.
:::

:::remember
NCERT: stress is **not a vector**, because it cannot be given one direction. Only the force on a chosen side of a section has a definite direction.
:::

## Hooke's law and the stress-strain curve

- Hooke's law holds only in the **linear part** of the curve (O to A), not up to the breaking point.
- NCERT calls point B both the **yield point** and the **elastic limit**. Some books put a separate "proportional limit" at A. Follow NCERT in NEET answers.
- After the yield point, removing the load leaves a **permanent set**: stress zero, strain not zero.
- **Brittle:** ultimate strength and fracture points close together. **Ductile:** far apart.

:::trap
"More elastic" does **not** mean "stretches more". A material that stretches **less** for the same load is **more elastic**. So steel is more elastic than rubber, and $Y_{steel} > Y_{rubber}$.
:::

## Young's modulus

- $Y$ depends only on the **material** (and temperature), not on the length or thickness of the wire.
- The **extension** $\Delta L = \dfrac{FL}{AY}$ does depend on size: double the length, double the extension; double the radius, one-fourth the extension.
- A perfectly rigid body would have $Y$ = **infinity** (no strain for any stress).
- **Breaking stress** depends only on the material. **Breaking force** = breaking stress × area, so a thicker wire can hold more. Its length does not matter (if the wire's own weight is ignored).

:::trap
Unit traps:
- 1 mm² $= 10^{-6}$ m² and 1 cm² $= 10^{-4}$ m²;
- 1 GPa $= 10^9$ Pa;
- use $A = \pi r^2$ with the **radius**. If the diameter is given, halve it first;
- a hollow column has $A = \pi(R^2 - r^2)$.
:::

:::tip
For two wires of the **same material** and same load, $\Delta L \propto \dfrac{L}{r^2}$. Compare ratios instead of putting in numbers.
:::

- Wires joined **end to end** (series) carry the **same tension**. With equal areas, they have equal stress but different strains if $Y$ differs.

## Shear and bulk modulus

- $Y$ and $G$ make sense **only for solids**, because only solids have a fixed length and shape. Shearing stress is possible only in solids.
- $B$ applies to **solids, liquids and gases**.
- For most materials $G \approx Y/3$, so $G < Y$.

:::trap
In $G = F/(A\theta)$, $A$ is the area of the face **parallel** to the force (the face that slides), not the face the force is "pushing on".
:::

:::trap
In $B = -p/(\Delta V/V)$, $p$ is the **increase** in pressure. At a depth $h$ in water, use $p = h\rho g$ (the extra pressure over the surface), not the total pressure with the atmosphere added.
:::

:::remember
NCERT (exercise): the stretching of a **coil spring** is decided by the **shear modulus** of its wire, not by Young's modulus. The wire of a coil twists rather than lengthens.
:::

## Poisson's ratio and energy

- Poisson's ratio is a ratio of two strains: **no unit**. NCERT writes it as a ratio of sizes, $(\Delta d/d)/(\Delta L/L)$, so it comes out positive.
- (Exam extra) If Poisson's ratio is 0.5, a stretched wire keeps its volume. For real materials it is below 0.5, so the volume increases slightly.
- Energy stored $= \frac12 F l$, **not** $Fl$. The force grows from zero to $F$ as the wire stretches.
- (Exam extra) A load $Mg$ hung suddenly on a wire and left to settle at extension $l$ loses gravitational energy $Mg\,l$, but only $\frac12 Mg\,l$ is stored. The other half is lost as heat while the oscillations die out.

## Applications

- Beam sag $\delta \propto \dfrac{1}{b\,d^3}$: increasing **depth** helps far more than increasing breadth. Hence beams are deep (I-section), not wide.
- Very deep, thin beams can **buckle**; the I-section avoids this and saves weight.
- Ropes of cranes are made of many **thin wires braided** together, not one thick rod.

## NCERT lines to know

:::remember
- Stress is the restoring force per unit area; strain is the fractional change in dimension.
- Hooke's law: for small deformations, stress is directly proportional to strain.
- Metals have larger Young's moduli than alloys and elastomers.
- Gases are about a **million times** more compressible than solids.
- The maximum height of a mountain on Earth is about **10 km**, set by the elastic limit of rock.
:::

:::tip
**Which modulus?** Length → **Y**oung's; shape (sliding faces) → shear **G**; volume (squeezing all round) → **B**ulk. Only $B$ works for fluids.
:::
