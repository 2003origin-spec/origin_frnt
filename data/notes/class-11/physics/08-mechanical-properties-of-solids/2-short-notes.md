---
title: "Mechanical Properties of Solids: Short Notes"
type: short_notes
chapter: c11.physics.mechanical-properties-of-solids
order: 2
---

## 1. Elasticity and plasticity

- A **rigid body** keeps its shape under any force. It is an idealisation: real solids can be stretched, compressed and bent.
- **Elasticity:** the property by which a body tends to regain its original size and shape when the deforming force is removed. Example: a spring.
- **Plasticity:** the body does not regain its shape; it stays permanently deformed. Putty and mud are close to **ideal plastics**.
- Elastic behaviour matters in engineering design: buildings, bridges, cranes, artificial limbs, aeroplanes.

## 2. Stress

When a deforming force acts and the body is in equilibrium, a **restoring force** develops inside it, equal in size and opposite in direction to the applied force.

**Stress** = restoring force per unit area, $\sigma = F/A$. Unit Pa (N m⁻²), dimensions $[\mathrm{ML^{-1}T^{-2}}]$.

| Stress | How the forces act | Result |
| --- | --- | --- |
| Tensile / compressive (longitudinal) | Normal to the cross-section | Length changes |
| Shearing (tangential) | Parallel to the faces | Shape changes |
| Hydraulic | Normal to the surface, equal everywhere | Volume changes, shape stays |

Hydraulic stress is equal in size to the hydraulic pressure.

## 3. Strain

Strain = change in a dimension ÷ the original dimension. It has **no unit and no dimensions**.

- **Longitudinal strain** $= \Delta L/L$ (stretching or compressing).
- **Shearing strain** $= \Delta x/L = \tan\theta \approx \theta$. A book pushed sideways by your hand shows it: the top face shifts relative to the bottom.
- **Volume strain** $= \Delta V/V$ (body under uniform pressure, like a sphere deep in a fluid).

## 4. Hooke's law

For **small deformations**, stress is proportional to strain:
$$\text{stress} = k \times \text{strain}$$
$k$ is the **modulus of elasticity**. Hooke's law is **empirical** (found by experiment). Most materials obey it for small strains; some, like rubber, do not.

## 5. Stress-strain curve (metal wire under tension)

| Part of curve | What happens |
| --- | --- |
| O to A | Straight line. Hooke's law holds. Fully elastic. |
| A to B | Not proportional, but the body still returns to its original size. |
| B | **Yield point** (NCERT also calls it the **elastic limit**). Stress here = yield strength $\sigma_y$. |
| B to D | Strain grows fast for a small rise in stress. **Plastic** region. |
| D | **Ultimate tensile strength** $\sigma_u$ (highest stress). |
| E | **Fracture** point. |

- Unload at a point C between B and D: the stress returns to zero but the strain does **not**. The material has a **permanent set** (plastic deformation).
- Beyond D, extra strain is produced even by a **reduced** force, and the wire breaks at E.
- **Brittle:** D and E are **close** (glass). **Ductile:** D and E are **far apart** (copper, mild steel).

:::remember
**Elastomers** (rubber, the elastic tissue of the aorta) can be stretched to large strains and still return to shape. Their elastic region is very large, but they do **not** obey Hooke's law over most of it, and they have no well-defined plastic region.
:::

## 6. Elastic moduli

In the linear region (O to A), stress ÷ strain is a constant that depends only on the **material**.

**Young's modulus** $Y = \dfrac{\text{tensile (or compressive) stress}}{\text{longitudinal strain}} = \dfrac{FL}{A\,\Delta L}$
- For a given material, the strain is the same whether the stress is tensile or compressive.
- **Metals** have large $Y$. They need a large force for a small change in length. Wood, bone, concrete and glass have rather small $Y$.
- NCERT data: to stretch wires of area 0.1 cm² by 0.1%, steel needs 2000 N; aluminium, brass and copper need 690 N, 900 N and 1100 N. So **steel is more elastic**, and it is used in heavy machines and structures.

**Shear modulus (modulus of rigidity)** $G = \dfrac{\text{shearing stress}}{\text{shearing strain}} = \dfrac{F}{A\theta}$
- Usually **less** than $Y$; for most materials $G \approx Y/3$.

**Bulk modulus** $B = -\dfrac{p}{\Delta V/V}$
- The minus sign is because more pressure means **less** volume; so $B$ is positive.
- **Compressibility** $k = 1/B$.
- $B$: solids ≫ liquids ≫ gases. Gases are about a **million times** more compressible than solids. Solids resist because neighbouring atoms are tightly coupled; molecules in gases are very weakly coupled.

| Modulus | Changes | Applies to |
| --- | --- | --- |
| Young's $Y$ | Length | Solids |
| Shear $G$ | Shape | Solids |
| Bulk $B$ | Volume | Solids, liquids, gases |

:::example{title="Stretching a steel rod"}
A steel rod of radius 10 mm and length 1.0 m is pulled by 31.4 kN. $Y = 2.0\times10^{11}$ Pa.

$A = \pi r^2 = 3.14\times10^{-4}$ m², so stress $= 10^8$ Pa.

$\Delta L = \dfrac{\text{stress}\times L}{Y} = \dfrac{10^8\times 1}{2\times10^{11}} = 5\times10^{-4}$ m $= 0.5$ mm. Strain $= 5\times10^{-4}$ (0.05%).
:::

## 7. Poisson's ratio

- A stretched wire gets longer **and** thinner. The strain perpendicular to the force is the **lateral strain**, $\Delta d/d$.
- Within the elastic limit, lateral strain ∝ longitudinal strain (Simon Poisson).
- **Poisson's ratio** = lateral strain ÷ longitudinal strain $= \dfrac{\Delta d/d}{\Delta L/L}$.
- A pure number with no unit; depends only on the material. Steel 0.28 to 0.30; aluminium alloys about 0.33.

## 8. Elastic potential energy

Stretching a wire does work against the interatomic forces. This work is stored as **elastic potential energy**. The force rises from 0 to $F$ as the extension rises from 0 to $l$, so
$$U = \frac{1}{2}\,\frac{YA}{L}\,l^2$$
$$U = \frac{1}{2}\,\sigma\,\varepsilon\,(AL)$$
that is, $\frac12 \times$ stress $\times$ strain $\times$ volume of the wire.
Energy per unit volume: $u = \frac12\sigma\varepsilon$.

## 9. Applications of elastic behaviour

- **Crane rope:** the load must not stretch the rope beyond the elastic limit, so $A \ge Mg/\sigma_y$. For 10 tonnes and mild steel ($\sigma_y \approx 3\times10^8$ Pa), $A \approx 3.3\times10^{-4}$ m², radius about 1 cm. With a safety factor of 10 on the load, about 3 cm is recommended. A single wire that thick would be a rigid rod, so ropes are made of **many thin wires braided together**: easier to make, flexible and strong.
- **Beams:** a bar loaded at the centre sags by $\delta = \dfrac{Wl^3}{4bd^3Y}$. To reduce sag, use a large $Y$, a short span, and above all a large **depth** $d$ ($\delta \propto d^{-3}$, but only $\propto b^{-1}$).
- **Buckling:** a deep, thin bar can bend sideways (buckle) if the load is not exactly in place. The **I-section** is the compromise: a large load-bearing surface and enough depth, with less weight and cost.
- **Pillars:** a pillar with **distributed (spread-out) ends** supports more load than one with rounded ends.
- **Mountains:** at the base, the weight of rock gives a force per unit area of $h\rho g$. The sides of a mountain are free, so this is **not** uniform (bulk) compression: there is a shear component of about $h\rho g$. This must stay below the critical shearing stress at which rock flows (NCERT uses the elastic limit of rock, $3\times10^8$ N m⁻²), which gives $h_{max} \approx 10$ km. Mt Everest is lower than this.
