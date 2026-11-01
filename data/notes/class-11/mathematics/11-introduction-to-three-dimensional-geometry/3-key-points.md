---
title: "3D Geometry (Intro): Important Points and Traps"
type: key_points
chapter: c11.mathematics.introduction-to-three-dimensional-geometry
order: 3
---

## Axes, planes and octants

:::remember
- The three axes are mutually perpendicular lines. The three coordinate planes are XY, YZ and ZX.
- The coordinate planes divide space into **8 octants**.
- $x, y, z$ are the distances of P from the **YZ, ZX and XY-planes**, in that order.
- On the x-axis: $(x, 0, 0)$. In the YZ-plane: $(0, y, z)$. Origin: $(0, 0, 0)$.
:::

:::trap
**Axis or plane? Count the zeros.** Two zero coordinates put the point on an **axis**. One zero puts it in a **plane**. $(0, 3, 0)$ is on the y-axis; $(0, 3, 5)$ is in the YZ-plane.
:::

:::trap
**The coordinate that is zero is the one missing from the plane's name.** A point in the XZ-plane has $y = 0$, not $x = 0$ or $z = 0$. (The XZ-plane and the ZX-plane are the same plane.)
:::

:::trap
A point with a zero coordinate lies **on** a coordinate plane, so it is in **no** octant. $(3, 0, -2)$ is not in octant V or VIII.
:::

:::tip
**Octant numbers:** I to IV are above the XY-plane ($z > 0$), and the $(x, y)$ signs go round like the quadrants: $(+,+), (-,+), (-,-), (+,-)$. V to VIII repeat this below ($z < 0$). So octant $= $ quadrant number, plus 4 if $z < 0$.
:::

## Distances

:::trap
**Distance from an axis is not a single coordinate.** For $P(x, y, z)$:
- from the **XY-plane** it is $|z|$ (one coordinate);
- from the **z-axis** it is $\sqrt{x^2 + y^2}$ (the other two).

Students often swap these. A plane loses one coordinate; an axis keeps one and uses the other two. (Distance from an axis is exam extra.)
:::

:::trap
Watch the signs when subtracting. For $(1, -3, 4)$ and $(-4, 1, 2)$: $y_2 - y_1 = 1 - (-3) = 4$, not $-2$. Using $-2$ gives a wrong square (4 instead of 16).
:::

- Distances are never negative. Coordinates can be.
- $(x_2 - x_1)^2 = (x_1 - x_2)^2$, so either point can be "first".
- The space diagonal of a cube of side $a$ is $a\sqrt3$. The diagonal of a box with edges $a, b, c$ is $\sqrt{a^2 + b^2 + c^2}$.

## Collinearity and shapes

:::remember
- **Collinear:** largest distance = sum of the other two. The middle point is the one **not** on the longest segment.
- **Right-angled:** largest square = sum of the other two squares. Compare **squares**, not lengths.
- **Not a rectangle:** in Example 7, NCERT shows ABCD is a parallelogram but not a rectangle because the diagonals are unequal ($\sqrt3 \ne \sqrt{155}$).
:::

:::trap
**In space, equal opposite sides alone do not prove a parallelogram.** Four points with AB = CD and BC = DA need not lie in one plane. For example, the four corners of a regular tetrahedron have all six distances equal, but they do not form a parallelogram.

NCERT's Example 7 checks equal opposite sides, and its answer is right: there the diagonals AC and BD do share the midpoint $\left(\tfrac32, \tfrac52, \tfrac52\right)$. The Note after Example 7 gives this midpoint test. It is the safer test in space: if AC and BD **bisect each other**, ABCD is a parallelogram.
:::

:::trap
Take vertices **in order**. In parallelogram ABCD the diagonals are AC and BD, and $D = A + C - B$. Using $A + B - C$ gives the fourth vertex of a **different** parallelogram, one with AB as a diagonal. Always pair opposite vertices.
:::

:::tip
For collinearity a faster check (from Class 12 direction ratios; also in the JEE Main syllabus): the differences $(x_2 - x_1, y_2 - y_1, z_2 - z_1)$ for AB and for AC should be **proportional**. For $A(-2, 3, 5)$, $B(1, 2, 3)$, $C(7, 0, -1)$: $(3, -1, -2)$ and $(9, -3, -6)$, ratio 3. Collinear.
:::

## Locus equations

- Let $P = (x, y, z)$ first, then write the condition. Square to remove roots.
- $PA = PB$: all the squared terms cancel, so the answer is **linear** in $x, y, z$. If $x^2$ terms are left over, recheck your algebra.
- $PA^2 + PB^2 = k^2$ or $PA = \lambda\, PB$ ($\lambda \ne 1$): the answer has $x^2 + y^2 + z^2$ with equal coefficients.

:::trap
For $PA + PB = 10$, square **twice**: isolate one root, square, isolate the remaining root, square again. For $A(4, 0, 0)$, $B(-4, 0, 0)$ the answer is $9x^2 + 25y^2 + 25z^2 = 225$.
:::

## Section formula

:::remember
The section formula was **removed from this Class 11 chapter**, but it is still in NCERT: Class 12 Vector Algebra (Section 10.5.3) teaches it in vector form. It is also in the JEE Main syllabus, and this chapter's Example 9 uses the centroid formula. Learn it.
:::

:::trap
In $\dfrac{m x_2 + n x_1}{m + n}$ for the ratio $m : n$ (P to Q), $m$ multiplies the coordinates of **Q**, not P. Mixing this up is the most common error.
:::

- YZ-plane divides PQ in the ratio $-x_1 : x_2$. A negative answer means **external** division: P and Q are on the same side of the plane.
- The centroid G lies on each median, with $AG : GD = 2 : 1$ (D = midpoint of BC).
- If the origin is the centroid, the coordinates of the vertices add up to 0 (for each of $x$, $y$, $z$).
