---
title: "Circles: Short Notes"
type: short_notes
chapter: c10.mathematics.circles
order: 2
---

## 1. A circle and a line

- A **circle** is the set of all points in a plane at a fixed distance (the radius) from a fixed point (the centre).
- A line and a circle in the same plane can meet in only three ways:

| Name | Common points |
|---|---|
| Non-intersecting line | none |
| Secant | two |
| Tangent | exactly one |

- There is no fourth case. A line can never meet a circle in three points.
- The word "tangent" comes from the Latin *tangere*, "to touch".

:::example{title="Everyday tangents"}
The rope on each side of a pulley over a well is like a tangent. A wheel rolling on the road touches it at one point, so the road is a tangent to the wheel.
:::

## 2. Tangent as a special secant

- Turn a secant about a point P on the circle. Its second meeting point Q comes closer to P. When Q reaches P, the secant becomes the **tangent at P**.
- So a tangent is a secant whose chord has shrunk to a single point (the two end points coincide).
- Draw lines parallel to a secant. The chords get shorter. On each side, one line just touches the circle. So there are **at most two** tangents parallel to a given secant (one on each side).
- The common point of the tangent and the circle is the **point of contact**. We say the tangent **touches** the circle there.

## 3. Theorem 10.1: tangent and radius

:::remember
The tangent at any point of a circle is **perpendicular to the radius** through the point of contact.
:::

**Why it is true.** Let XY touch the circle at P. Take any other point Q on XY.

- Q is **outside** the circle. (If Q were inside, XY would cut the circle twice and be a secant.)
- So $OQ > OP$.
- This holds for every point of XY except P. So OP is the **shortest** distance from O to the line.
- The shortest segment from a point to a line is the perpendicular. So $OP \perp XY$.

Results that follow:

- At each point of a circle there is **one and only one** tangent.
- The line through the centre and the point of contact is called the **normal** at that point.
- The perpendicular to a tangent at its point of contact passes through the centre.
- The tangents at the two ends of a diameter are parallel. (Both are perpendicular to the same diameter.)

## 4. How many tangents from a point

| Point P | Number of tangents through P |
|---|---|
| Inside the circle | 0 |
| On the circle | 1 |
| Outside the circle | 2 |

- From an outside point P, let the tangents touch the circle at $T_1$ and $T_2$. The lengths $PT_1$ and $PT_2$ are called the **lengths of the tangents** from P.
- The length is measured from P to the point of contact only, not along the whole line.

## 5. Theorem 10.2: equal tangents

:::remember
The lengths of the tangents drawn from an external point to a circle are **equal**.
:::

**Proof.** Tangents PQ and PR touch the circle at Q and R. Join OP, OQ and OR.

- $\angle OQP = \angle ORP = 90^\circ$ (Theorem 10.1).
- $OQ = OR$ (radii) and OP is common.
- So $\triangle OQP \cong \triangle ORP$ (**RHS**), and $PQ = PR$ (CPCT).

Another way, by Pythagoras: $PQ^2 = OP^2 - OQ^2 = OP^2 - OR^2 = PR^2$.

What else the congruence gives:

- $\angle OPQ = \angle OPR$. The centre lies on the **bisector of the angle** between the two tangents.
- $\angle POQ = \angle POR$.
- In quadrilateral OQPR, the angles at Q and R are $90^\circ$. So $\angle QPR + \angle QOR = 180^\circ$.

## 6. Solved examples from the book

:::example{title="Concentric circles (Example 1)"}
A chord AB of the bigger circle touches the smaller circle at P. Then $OP \perp AB$ (Theorem 10.1). A perpendicular from the centre bisects a chord, so $AP = BP$.
:::

:::example{title="Angle between tangents (Example 2)"}
Tangents TP and TQ, with $\angle PTQ = \theta$. Since $TP = TQ$, $\angle TPQ = 90^\circ - \frac{\theta}{2}$. Then
$\angle OPQ = 90^\circ - \left(90^\circ - \frac{\theta}{2}\right) = \frac{\theta}{2}$.
So $\angle PTQ = 2\,\angle OPQ$.
:::

:::example{title="Tangents at the ends of a chord (Example 3)"}
Chord PQ = 8 cm, radius 5 cm. The tangents at P and Q meet at T. OT cuts PQ at R.

- OT is the perpendicular bisector of PQ, so $PR = 4$ cm and $OR = \sqrt{5^2 - 4^2} = 3$ cm.
- $\triangle TRP \sim \triangle PRO$ (AA), so $\dfrac{TP}{PO} = \dfrac{RP}{RO}$.
- $TP = \dfrac{5 \times 4}{3} = \dfrac{20}{3}$ cm.
:::

## 7. Figures drawn around a circle

When every side of a figure touches the circle, each corner sends out **two equal tangents**. Mark them with the same letter. Most sums then solve themselves.

- **Quadrilateral ABCD around a circle:** $AB + CD = AD + BC$. Each side splits into two tangent pieces, and both sums use each piece once.
- **Parallelogram around a circle:** opposite sides are equal, so $AB + CD = AD + BC$ gives $2AB = 2BC$. All sides are equal: it is a **rhombus**.
- **Opposite sides** of a quadrilateral around a circle subtend **supplementary** angles at the centre.
- **Triangle around a circle:** with tangent lengths $x, y, z$ from A, B, C, each side is a sum of two of them. Adding the three sides gives $2(x + y + z)$.
- **Two parallel tangents** cut by a third tangent at A and B: $\angle AOB = 90^\circ$.

:::tip
When a circle touches every side of a polygon, first write the equal tangent pieces on the figure. Then add or subtract.
:::
