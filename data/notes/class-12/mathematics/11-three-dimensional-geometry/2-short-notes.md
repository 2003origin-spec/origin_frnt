---
title: "3D Geometry (Class 12): Short Notes"
type: short_notes
chapter: c12.mathematics.three-dimensional-geometry
order: 2
---

This chapter uses the vectors of the previous chapter to study **lines in space**. The current NCERT book covers direction cosines and ratios, the equation of a line, the angle between two lines, and the distance between two lines. Planes were removed from the book and are not in the JEE Main 2026 syllabus. (The chapter's opening paragraph still mentions planes, but there is no section on them.) Coordinates and the distance formula are in the Class 11 chapter. The section formula is in the previous chapter (Vector Algebra), in vector form.

## 1. Direction cosines

- A **directed line** makes angles $\alpha, \beta, \gamma$ with the positive $x$, $y$ and $z$-axes. These are its **direction angles**.
- Their cosines $l = \cos\alpha$, $m = \cos\beta$, $n = \cos\gamma$ are the **direction cosines** (d.c.'s).
- A line can point two ways. Reversing it replaces each angle by its supplement ($180^\circ - \alpha$, ...), so all three d.c.'s change sign. To get one fixed set, take the line as directed.
- A line not through the origin has the same d.c.'s as the parallel line through the origin.
- Always $l^2 + m^2 + n^2 = 1$.

:::example{title="Equal angles with the axes"}
If $l = m = n$, then $3l^2 = 1$, so $l = m = n = \pm\dfrac{1}{\sqrt3}$.
:::

## 2. Direction ratios

- **Direction ratios** (d.r.'s) $a, b, c$ are any three numbers proportional to $l, m, n$. Some books call them direction numbers.
- A line has infinitely many sets of d.r.'s: if $a, b, c$ is one set, so is $ka, kb, kc$ for any $k \ne 0$.
- To turn d.r.'s into d.c.'s, divide each by $\sqrt{a^2 + b^2 + c^2}$, with the same sign ($+$ or $-$) on all three.

:::example{title="From ratios to cosines"}
D.r.'s $2, -1, -2$: here $\sqrt{4 + 1 + 4} = 3$, so the d.c.'s are $\dfrac23, -\dfrac13, -\dfrac23$ (or all three signs reversed).
:::

## 3. Line through two points

- For $P(x_1, y_1, z_1)$ and $Q(x_2, y_2, z_2)$, the d.r.'s of $PQ$ are $x_2 - x_1,\ y_2 - y_1,\ z_2 - z_1$. Dividing by the length $PQ$ gives the d.c.'s.
- **Collinear points:** $A, B, C$ lie on one line when the d.r.'s of $AB$ and $BC$ are proportional. (Parallel, with the point $B$ common, means the same line.)

:::example{title="Collinear check"}
$A(2, 3, -4)$, $B(1, -2, 3)$, $C(3, 8, -11)$ (an NCERT example). $AB$ has d.r.'s $-1, -5, 7$ and $BC$ has $2, 10, -14$, which is $-2$ times the first. So $A, B, C$ are collinear.
:::

## 4. Equation of a line

A line is fixed by **a point and a direction**, or by **two points**.

- **Vector form:** $\vec r = \vec a + \lambda\vec b$. Here $\vec a$ is a point on the line, $\vec b$ is along the line, and each real $\lambda$ gives one point.
- **Cartesian form:** with $\vec a = x_1\hat i + y_1\hat j + z_1\hat k$ and $\vec b = a\hat i + b\hat j + c\hat k$, comparing components gives the parametric equations $x = x_1 + \lambda a$, $y = y_1 + \lambda b$, $z = z_1 + \lambda c$. Removing $\lambda$:

$$\frac{x - x_1}{a} = \frac{y - y_1}{b} = \frac{z - z_1}{c}$$

- The numbers under $x, y, z$ are d.r.'s; the numbers subtracted from $x, y, z$ give a point.
- **Two points** with position vectors $\vec a$ and $\vec b$: $\vec r = \vec a + \lambda(\vec b - \vec a)$.

:::example{title="Vector to Cartesian"}
Through $(5, 2, -4)$, parallel to $3\hat i + 2\hat j - 8\hat k$ (NCERT):
$\vec r = 5\hat i + 2\hat j - 4\hat k + \lambda(3\hat i + 2\hat j - 8\hat k)$, that is
$$\frac{x - 5}{3} = \frac{y - 2}{2} = \frac{z + 4}{-8}$$
:::

- **Standard form first.** Before reading d.r.'s, make each coefficient of $x$, $y$, $z$ equal to $+1$. For example, $\dfrac{1 - x}{2}$ is $\dfrac{x - 1}{-2}$, and $\dfrac{2z - 4}{6}$ is $\dfrac{z - 2}{3}$.

## 5. Angle between two lines

- Only the directions matter. For lines along $\vec b_1$ and $\vec b_2$, the acute angle $\theta$ has $\cos\theta = \dfrac{|\vec b_1 \cdot \vec b_2|}{|\vec b_1|\,|\vec b_2|}$.
- With d.r.'s, the top is $|a_1a_2 + b_1b_2 + c_1c_2|$ and the bottom is the product of the lengths $\sqrt{a_1^2 + b_1^2 + c_1^2}$ and $\sqrt{a_2^2 + b_2^2 + c_2^2}$.
- With d.c.'s the lengths are 1, so $\cos\theta = |l_1l_2 + m_1m_2 + n_1n_2|$.
- **Perpendicular:** $a_1a_2 + b_1b_2 + c_1c_2 = 0$. **Parallel:** $\dfrac{a_1}{a_2} = \dfrac{b_1}{b_2} = \dfrac{c_1}{c_2}$.
- The angle between **skew lines** is the angle between two intersecting lines drawn through one point (say the origin), parallel to them.

:::example{title="Angle from vector equations (NCERT)"}
$\vec b_1 = \hat i + 2\hat j + 2\hat k$ and $\vec b_2 = 3\hat i + 2\hat j + 6\hat k$:
$\cos\theta = \dfrac{3 + 4 + 12}{3 \times 7} = \dfrac{19}{21}$, so $\theta = \cos^{-1}\dfrac{19}{21}$.
:::

## 6. Kinds of line pairs

| Pair | Meet? | Shortest distance |
|---|---|---|
| Intersecting | Yes | 0 |
| Parallel | No | Perpendicular distance |
| Skew | No | Along the common perpendicular |

- **Skew lines** are neither parallel nor intersecting. They do not lie in one plane. Example from NCERT: in a room, a diagonal across the ceiling, and a diagonal of a wall that starts from a different corner of the ceiling. They are not parallel and never meet.
- The shortest distance between skew lines is along the segment **perpendicular to both** lines. Its direction is $\vec b_1 \times \vec b_2$.

## 7. Shortest distance between skew lines

- Take $S$ on the first line ($\vec a_1$) and $T$ on the second ($\vec a_2$). The shortest distance is the projection of $\overrightarrow{ST} = \vec a_2 - \vec a_1$ on the unit vector along $\vec b_1 \times \vec b_2$:

$$d = \frac{|N|}{|\vec b_1 \times \vec b_2|}$$
where
$$N = (\vec b_1 \times \vec b_2) \cdot (\vec a_2 - \vec a_1)$$

- In Cartesian form, the numerator is the **modulus** of the determinant with rows $(x_2 - x_1,\ y_2 - y_1,\ z_2 - z_1)$, $(a_1, b_1, c_1)$, $(a_2, b_2, c_2)$.
- If this comes out **zero** (and the lines are not parallel), the lines **intersect**.

:::example{title="NCERT Example 9"}
$\vec a_2 - \vec a_1 = \hat i - \hat k$ and $\vec b_1 \times \vec b_2 = 3\hat i - \hat j - 7\hat k$, of length $\sqrt{59}$.
$d = \dfrac{|3 - 0 + 7|}{\sqrt{59}} = \dfrac{10}{\sqrt{59}}$.
:::

## 8. Distance between parallel lines

- Parallel lines $\vec r = \vec a_1 + \lambda\vec b$ and $\vec r = \vec a_2 + \mu\vec b$ lie in one plane. The skew-line formula fails here because $\vec b \times \vec b = \vec 0$.
- Use instead $d = \dfrac{|\vec b \times (\vec a_2 - \vec a_1)|}{|\vec b|}$. This is $|ST|\sin\theta$, where $\theta$ is the angle between $\overrightarrow{ST}$ and $\vec b$.
- If the two direction vectors are multiples (say $\vec b$ and $2\vec b$), first write both with the same $\vec b$.

## 9. Point and line (exam extra, not in NCERT)

JEE Main often asks these under "equation of a line".

- **Foot of the perpendicular** from $P$ to $\vec r = \vec a + \lambda\vec b$: write the general point $F = \vec a + \lambda\vec b$, then make $\overrightarrow{PF} \cdot \vec b = 0$ and solve for $\lambda$.
- **Distance** of $P$ from the line $= |PF|$, or directly $\dfrac{|(\vec p - \vec a) \times \vec b|}{|\vec b|}$.
- **Image** of $P$ in the line: $F$ is the midpoint of $P$ and its image, so the image is $2\vec f - \vec p$.
- **Feet of the common perpendicular** of two skew lines: take general points on both lines, then make the joining vector perpendicular to $\vec b_1$ and to $\vec b_2$. Two equations give $\lambda$ and $\mu$.
