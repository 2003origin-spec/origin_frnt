---
title: "Electric Charges and Fields: Important Points and Traps"
type: key_points
chapter: c12.physics.electric-charges-and-fields
order: 3
---

## Charge

- A body becomes **positive** by **losing** electrons and **negative** by **gaining** them. Protons do not move when bodies are rubbed.
- Charge is **invariant**: the same in every frame of reference. (Kinetic energy, also a scalar, is not.)
- Quantisation is a basic law of nature with no known explanation. Mass has no such law.

:::trap
$q = ne$ needs a **whole number** $n$. A charge of $2.4 \times 10^{-19}$ C ($= 1.5e$) is impossible on a free body. Divide by $1.6 \times 10^{-19}$ and check.
:::

:::trap
Charge conservation is about the **net** charge. Charged particles can be created or destroyed (a neutron becomes a proton and an electron).
:::

## Coulomb's law

:::trap
The formula is for **point charges** (or spheres far apart compared with their size). Two big charged spheres close together redistribute their charge, and the simple formula fails.
:::

- The force between two charges does **not** change when a third charge is brought near. Only the **net** force on each changes.
- Both charges feel **equal and opposite** forces, even if one is 100 times the other.
- Double both charges and halve the distance: **16 times** the force. Halve both charges and halve the distance: **no change** (NCERT Example 1.4).

:::trap
Touch two identical spheres with $+6$ µC and $-2$ µC: each gets $\dfrac{6 + (-2)}{2} = +2$ µC, not $+4$ µC. Attraction can turn into repulsion.
:::

## Electric field

:::trap
On a **negative** charge the force is **opposite** to $\vec E$. An electron released in a field moves **against** the field lines.
:::

- $\vec E$ belongs to the **source** charges. Doubling the test charge doubles the force, not the field.
- Midpoint of two **equal like** charges: $E = 0$. Of two **equal unlike** charges: the fields **add**, pointing to the negative charge.
- Zero-field point: **between** like charges (nearer the smaller one); **outside** unequal unlike charges (beyond the smaller one). Equal unlike charges (a dipole) have **no** such point at a finite distance.
- Equal charges at the corners of a regular polygon give **zero** field at the centre. Change one charge, and the field is what that change alone would give.
- Same field: the electron and proton feel the **same** force, but the electron's acceleration is about **1840 times** larger ($m_p/m_e$).

:::remember
Free fall takes the same time for all masses. Fall in an electric field does **not**: $t = \sqrt{2hm/(qE)}$ (NCERT Example 1.7).
:::

## Field lines

:::remember
Start on **+**, end on **−** (or at infinity). Never **cross**. No **breaks** in charge-free space. No **closed loops**. Denser lines mean a stronger field.
:::

- Field lines are **not** paths of charges. A charge released from rest follows a line only if the line is **straight**.

## Dipole

:::trap
NCERT draws the dipole moment from **$-q$ to $+q$**. Chemistry books often draw the bond-dipole arrow from + to −. In physics, use $-$ to $+$.
:::

- On the **axis** the field is **along** $\vec p$, on **both** sides. On the **equatorial** line it is **opposite** to $\vec p$.
- Same large distance: $E_{axial} : E_{eq} = 2 : 1$.
- Far field $\propto 1/r^3$: double the distance, the field falls **8 times** (a point charge: 4 times).

:::trap
**Uniform** field: zero net force, but a torque. **Non-uniform** field: a net force too. Never say "zero force" without checking that the field is uniform.
:::

- Torque is **largest** ($pE$) at $90^\circ$, **zero** at $0^\circ$ and $180^\circ$. At $0^\circ$ the dipole is **stable**, at $180^\circ$ **unstable** (Chapter 2 shows this with $U = -pE\cos\theta$).
- Neutral paper bits are attracted to a charged comb because they get **polarised** and the comb's field is **non-uniform**.

## Flux and Gauss's law

:::trap
In $\phi = ES\cos\theta$, $\theta$ is measured from the **normal**, not the surface. A field **parallel** to a surface gives **zero** flux.
:::

:::trap
**Net flux** depends only on the charge **inside**. The **field** on the surface depends on **all** charges. Moving a charge around **inside** changes the field but not the total flux.
:::

- Total flux is the same for any closed surface around the charge: small cube, big sphere or any odd shape.
- A **uniform** field gives **zero** net flux through any closed surface.
- **Zero flux** means zero **net** charge inside; equal $+$ and $-$ charges may be there.
- Charge **off-centre** in a cube: faces get unequal shares, but the total is still $q/\varepsilon_0$.
- (Exam extra: not in NCERT, a Gauss's-law trick that exams use) Charge at a **corner** of a cube: $q/(8\varepsilon_0)$ through that cube (8 cubes would surround it). The 3 faces touching the corner get zero; each of the other 3 gets $q/(24\varepsilon_0)$.

## Line, sheet and shell

:::trap
$E = \sigma/(2\varepsilon_0)$ has **no $r$** in it. It needs an **infinite** sheet (or a point near the middle of a large one).
:::

- Sheets $+\sigma$ and $-\sigma$: $\sigma/\varepsilon_0$ **between**, zero **outside**. Two sheets with the **same** $+\sigma$: zero between, $\sigma/\varepsilon_0$ outside.
- Field **inside** a uniformly charged thin shell is **zero**, for any radius or charge. Just outside, $E = \sigma/\varepsilon_0$, so $E$ **jumps** at the surface.

:::tip
How fast the field falls: **sheet $r^0$ → line $1/r$ → point and shell $1/r^2$ → dipole $1/r^3$**.
:::

## NCERT lines to know

:::remember
- Charge has three basic properties: quantisation, additivity and conservation.
- The field due to a uniformly charged thin shell is zero at all points inside it.
- Outside a uniformly charged shell, the field is as if all the charge were at the centre.
- Gauss's law is based on the inverse-square law of Coulomb.
:::
