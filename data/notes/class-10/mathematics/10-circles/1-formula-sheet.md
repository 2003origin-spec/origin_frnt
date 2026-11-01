---
title: "Circles: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.circles
order: 1
---

In every box: O is the centre and $r$ is the radius.

## A line and a circle

:::formula{title="Three cases"}
| Line | Common points |
|---|---|
| Non-intersecting line | 0 |
| Tangent | 1 |
| Secant | 2 |

The common point of a tangent and the circle is the **point of contact**.
:::

:::formula{title="Tangents through a point P"}
| Where P is | Tangents through P |
|---|---|
| Inside the circle | 0 |
| On the circle | exactly 1 |
| Outside the circle | exactly 2 |
:::

## Tangent and radius

:::formula{title="Tangent is perpendicular to radius (Theorem 10.1)"}
If XY is the tangent at P, then
$$OP \perp XY$$
So $\angle OPX = \angle OPY = 90^\circ$. The line through O and P is called the **normal** at P.
:::

:::formula{title="Length of a tangent"}
P is outside the circle and PT is a tangent with point of contact T. Let $d = OP$. Then $\triangle OTP$ has a right angle at T, so
$$PT^2 = OP^2 - OT^2$$
$$PT = \sqrt{d^2 - r^2}$$
Only for $d > r$ (P outside). OP is the **hypotenuse**.
:::

## Two tangents from an outside point

PA and PB are the two tangents from P, touching the circle at A and B.

:::formula{title="Equal tangents (Theorem 10.2)"}
$$PA = PB$$
Proof: $\triangle OAP \cong \triangle OBP$ (RHS).
:::

:::formula{title="OP bisects the angles"}
From the same congruent triangles:
$$\angle APO = \angle BPO$$
$$\angle AOP = \angle BOP$$
The centre lies on the bisector of the angle between the two tangents.
:::

:::formula{title="OP and the chord AB"}
OP is the perpendicular bisector of AB (from Example 3 of the book):
$$OP \perp AB$$
AB is cut into two equal halves where it meets OP.
:::

:::formula{title="Angle between tangents and angle at centre"}
$$\angle APB + \angle AOB = 180^\circ$$
OAPB has two right angles (at A and B), and the four angles of a quadrilateral add up to $360^\circ$.
:::

:::formula{title="Angle with the chord (Example 2)"}
$$\angle APB = 2\,\angle OAB$$
:::

## Standard results from the book

:::formula{title="Concentric circles"}
Radii $R$ (big) and $r$ (small). A chord AB of the big circle touches the small circle at M. Then M is the mid-point of AB and
$$AB = 2\sqrt{R^2 - r^2}$$
:::

:::formula{title="Tangents at the ends of a diameter"}
They are **parallel**. A circle has **at most two** tangents parallel to a given line. The gap between them is the diameter $2r$.
:::

:::formula{title="Two parallel tangents and a third tangent"}
Parallel tangents are cut at A and B by a third tangent. Then
$$\angle AOB = 90^\circ$$
:::

:::formula{title="Quadrilateral around a circle"}
ABCD touches the circle on all four sides. Then
$$AB + CD = AD + BC$$
Also, opposite sides subtend supplementary angles at the centre:
$$\angle AOB + \angle COD = 180^\circ$$
A parallelogram around a circle must be a **rhombus**.
:::

:::formula{title="Triangle around a circle"}
Let the tangent lengths from A, B, C be $x$, $y$, $z$. Then
$$AB = x + y$$
$$BC = y + z$$
$$CA = z + x$$
Adding all three gives $2(x + y + z)$ = perimeter. So $x + y + z$ is half the perimeter. Subtract one side from it to get the third tangent length.
:::

:::formula{title="Area of a triangle around a circle"}
(beyond the Class 10 book) Only when the circle touches **all three sides**. Join O to A, B and C. This splits the triangle into three triangles, each with height $r$.
$$\text{Area} = \frac{1}{2}\,r \times \text{perimeter}$$
It works for any polygon whose **every side** touches the circle, and for no other figure. Useful with Heron's formula (Class 9).
:::
