---
title: "3D Geometry (Class 12): Important Points and Traps"
type: key_points
chapter: c12.mathematics.three-dimensional-geometry
order: 3
---

## Direction cosines and ratios

:::remember
- Direction cosines are the cosines of the angles a line makes with the **positive** directions of the axes.
- $l^2 + m^2 + n^2 = 1$ for direction cosines. Direction ratios need not satisfy this.
- Any two sets of direction ratios of a line are proportional.
- D.c.'s of the axes: $x$-axis $1, 0, 0$; $y$-axis $0, 1, 0$; $z$-axis $0, 0, 1$.
:::

:::trap
When you turn direction ratios into direction cosines, use the **same sign** on all three. From $2, -1, -2$ you get $\dfrac23, -\dfrac13, -\dfrac23$ or $-\dfrac23, \dfrac13, \dfrac23$, never a mix such as $\dfrac23, \dfrac13, -\dfrac23$.
:::

:::trap
Not every three angles are direction angles. Check $\cos^2\alpha + \cos^2\beta + \cos^2\gamma = 1$ first. A line **cannot** make $45^\circ$ with all three axes: $3 \times \dfrac12 \ne 1$.
:::

- Equal angles with the three axes: $l = m = n = \pm\dfrac{1}{\sqrt3}$.
- (Exam extra) From $l^2 + m^2 + n^2 = 1$: $\sin^2\alpha + \sin^2\beta + \sin^2\gamma = 2$ and $\cos 2\alpha + \cos 2\beta + \cos 2\gamma = -1$.

## Reading a line's equation

:::trap
Read direction ratios only from the **standard form** $\dfrac{x - x_1}{a} = \dfrac{y - y_1}{b} = \dfrac{z - z_1}{c}$, where $x$, $y$, $z$ each have coefficient $+1$.

The line
$$\frac{1 - x}{2} = \frac{y + 3}{-1} = \frac{2z - 4}{6}$$
is the same as
$$\frac{x - 1}{-2} = \frac{y + 3}{-1} = \frac{z - 2}{3}$$

So the point is $(1, -3, 2)$ and the d.r.'s are $-2, -1, 3$, not $2, -1, 6$.
:::

:::trap
Signs of the point: $\dfrac{x + 3}{2}$ means $x_1 = -3$. The point is what makes each numerator zero.
:::

- In $\vec r = \vec a + \lambda\vec b$, the vector **multiplied by** $\lambda$ is the direction. The other one is a point.
- NCERT uses $a, b, c$ for direction ratios **and** $\vec a$, $\vec b$ for vectors. Do not confuse the number $b$ with $\vec b$, or with $|\vec b|$.
- The $x$-axis is $\vec r = \lambda\hat i$, that is $y = 0$ and $z = 0$.

:::tip
You will see $\dfrac{x}{1} = \dfrac{y}{0} = \dfrac{z}{0}$ for the $x$-axis in exam papers, and in NCERT's own answer to the Miscellaneous Exercise question on a line through the origin parallel to the $x$-axis. A **0 under** a variable is shorthand: that coordinate stays fixed ($y = 0$, $z = 0$ here). Nothing is divided by zero.
:::

## Angle between lines

:::trap
Use the **direction vectors only**. The points $\vec a_1$ and $\vec a_2$ play no part in the angle.
:::

:::trap
The formula has a **modulus** to give the acute angle. If $\vec b_1 \cdot \vec b_2 < 0$, the angle between the vectors is obtuse; the angle between the lines is its supplement. Answer $\cos^{-1}\dfrac49$, not $\cos^{-1}\left(-\dfrac49\right)$.
:::

- **Perpendicular:** $a_1a_2 + b_1b_2 + c_1c_2 = 0$. **Parallel:** d.r.'s proportional.
- Perpendicular lines in space need not meet. Skew lines can be perpendicular.

## Shortest distance

:::remember
- Intersecting lines: shortest distance 0.
- Parallel lines: the length of the perpendicular from a point of one line to the other.
- Skew lines: neither parallel nor intersecting; they lie in different planes. The shortest-distance segment is perpendicular to both lines.
:::

:::trap
**Check for parallel lines first.** If $\vec b_1 \times \vec b_2 = \vec 0$ (d.r.'s proportional, for example $\hat i + 2\hat j + 2\hat k$ and $2\hat i + 4\hat j + 4\hat k$), the skew formula gives $\dfrac00$. Use $d = \dfrac{|\vec b \times (\vec a_2 - \vec a_1)|}{|\vec b|}$ instead.
:::

:::trap
Take the **modulus** of $(\vec b_1 \times \vec b_2) \cdot (\vec a_2 - \vec a_1)$. A distance is never negative.
:::

- Shortest distance 0 for non-parallel lines means the lines **intersect**. This is the quick test for "find $k$ so that the lines meet".
- The determinant form is the same as the vector form: the determinant equals $(\vec a_2 - \vec a_1) \cdot (\vec b_1 \times \vec b_2)$.

:::tip
Order of work for two lines:
1. Write each in standard form; read a point and a direction.
2. Directions proportional? Then **parallel**: use the parallel-lines formula.
3. Otherwise find $\vec b_1 \times \vec b_2$ and its dot product with $\vec a_2 - \vec a_1$.
4. Zero means **intersecting**; not zero means **skew**, and $d$ = |dot product| ÷ $|\vec b_1 \times \vec b_2|$.
:::

## Point and line (exam extra, not in NCERT)

:::tip
**Foot of the perpendicular in three steps:** write the general point $F(x_1 + \lambda a,\ y_1 + \lambda b,\ z_1 + \lambda c)$; set $\overrightarrow{PF} \cdot (a, b, c) = 0$; solve for $\lambda$. Then the image of $P$ is $2F - P$, and the distance is $|PF|$.
:::

:::trap
After finding the foot $F$, check that $\overrightarrow{PF}$ is really perpendicular to the line. A sign slip in $\overrightarrow{PF}$ is the most common error.
:::
