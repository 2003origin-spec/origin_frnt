---
title: "Straight Lines: Important Points and Traps"
type: key_points
chapter: c11.mathematics.straight-lines
order: 3
---

## Slope

:::remember
- Slope of the $x$-axis (and any horizontal line) is **0**. Slope of the $y$-axis (and any vertical line) is **not defined**. "Not defined" is not the same as 0.
- Two non-vertical lines are parallel if and only if their slopes are equal.
- Two non-vertical lines are perpendicular if and only if the product of their slopes is $-1$.
- Three points $A$, $B$, $C$ are collinear if and only if slope of $AB$ = slope of $BC$.
:::

:::trap
**Angle from the $y$-axis.** A line making $30^\circ$ with the positive $y$-axis, measured anticlockwise, has inclination $90^\circ + 30^\circ = 120^\circ$. Its slope is $\tan 120^\circ = -\sqrt3$, not $\tan 30^\circ$.
:::

:::trap
$m_1 m_2 = -1$ cannot test a vertical line, because it has no slope. $x = 2$ and $y = 5$ **are** perpendicular. For general equations, $A_1A_2 + B_1B_2 = 0$ works for every pair of lines, vertical ones included.
:::

- Slope from $Ax + By + C = 0$ is $-\dfrac{A}{B}$, not $\dfrac{A}{B}$ and not $-\dfrac{B}{A}$. Quick check: $y = 2x$ is $2x - y = 0$, and $-\dfrac{2}{-1} = 2$.
- The inclination is always measured from the **positive** $x$-axis, anticlockwise. A line falling to the right has an obtuse inclination and a negative slope.
- Inclination range: we use $0^\circ \le \theta < 180^\circ$. NCERT prints $0^\circ \le \theta \le 180^\circ$; both describe the same lines, since $180^\circ$ and $0^\circ$ give the same direction.

## Angle between lines

:::trap
The formula $\tan\theta = \left|\dfrac{m_2 - m_1}{1 + m_1 m_2}\right|$ gives the **acute** angle. If the question asks for the obtuse angle, use $180^\circ - \theta$.

If $1 + m_1 m_2 = 0$, the formula breaks down: the lines are perpendicular ($\theta = 90^\circ$).
:::

:::trap
**Two answers.** "A line makes $45^\circ$ with a given line" has two possible slopes, from $\dfrac{m - m_1}{1 + m m_1} = +1$ and $= -1$. Keep both unless the question rules one out.

If one of the lines is vertical, the formula fails. Use $\theta = |90^\circ - \alpha|$, where $\alpha$ is the inclination of the other line.
:::

## Equations and intercepts

:::trap
An intercept is a **signed** number. "Cuts the $y$-axis 2 units below the origin" means $c = -2$. "Intercepts equal in length" can mean $a = b$ or $a = -b$; "equal intercepts" means $a = b$.
:::

:::trap
The intercept form $\dfrac{x}{a} + \dfrac{y}{b} = 1$ cannot describe a line through the origin, or a line parallel to an axis. If "equal intercepts" could include $a = b = 0$, a line through the origin also counts. NCERT takes the intercepts as non-zero.
:::

- $y = mx + c$ cannot describe a vertical line. Use $x = b$.
- Every non-vertical line has exactly one slope-intercept form, but many general forms: $2x + 4y - 6 = 0$ and $x + 2y - 3 = 0$ are the **same** line.
- To show a point lies on a line, put its coordinates into the equation. To show three points are collinear, find the line through two of them and check the third.

:::tip
Lines **parallel** to $Ax + By + C = 0$: keep $A$, $B$ and change $C$. Lines **perpendicular** to it: swap $A$ and $B$ and change one sign, $Bx - Ay + k = 0$. Then put in the given point to find $k$.
:::

## Distances

:::trap
**Same $A$ and $B$ first.** For $9x + 6y - 7 = 0$ and $3x + 2y + 6 = 0$, write the second as $9x + 6y + 18 = 0$ before using $\dfrac{|C_1 - C_2|}{\sqrt{A^2 + B^2}}$. Here $d = \dfrac{25}{\sqrt{117}}$.
:::

:::trap
The modulus in $d = \dfrac{|Ax_1 + By_1 + C|}{\sqrt{A^2 + B^2}}$ means "a distance $d$ from the line" usually gives **two** points, one on each side. Solve $Ax_1 + By_1 + C = \pm d\sqrt{A^2 + B^2}$.
:::

- "Distance of a point from a line **measured along** another line" is not the perpendicular distance. Find where the two lines meet and use the distance formula.
- The line midway between two parallel lines $Ax + By + C_1 = 0$ and $Ax + By + C_2 = 0$ is $Ax + By + \dfrac{C_1 + C_2}{2} = 0$.
- Perpendicular distance from the origin to $Ax + By + C = 0$ is $\dfrac{|C|}{\sqrt{A^2 + B^2}}$.

## Concurrency, images and reflection

- Concurrent lines: find the meeting point of two, then substitute it into the third.
- For $y = m_i x + c_i$ ($i = 1, 2, 3$), the lines are concurrent when $m_1(c_2 - c_3) + m_2(c_3 - c_1) + m_3(c_1 - c_2) = 0$ (NCERT miscellaneous exercise). The condition is also true when all three lines are parallel, which is not concurrency, so check that the slopes are not all equal.

:::tip
**Image in a line:** the line is the perpendicular bisector of the point and its image. Two conditions: slopes multiply to $-1$, and the mid-point lies on the line. (Exam shortcut: image $= (x_1 - 2At,\ y_1 - 2Bt)$ with $t = \dfrac{Ax_1 + By_1 + C}{A^2 + B^2}$.)
:::

:::tip
**Light reflecting off the $x$-axis:** reflect one point in the axis ($(x, y) \to (x, -y)$) and join it to the other point. Where this line cuts the axis is the point of reflection.
:::

## Triangle centres (exam extra, in the JEE Main syllabus)

:::remember
- **Right triangle:** orthocentre at the right-angle vertex; circumcentre at the mid-point of the hypotenuse.
- **Equilateral triangle:** centroid, orthocentre, circumcentre and incentre are the same point.
- (Beyond the syllabus, but a quick check.) Orthocentre $H$, centroid $G$ and circumcentre $O$ are collinear, with $HG : GO = 2 : 1$. So $H = 3G - 2O$ (coordinate-wise).
:::
