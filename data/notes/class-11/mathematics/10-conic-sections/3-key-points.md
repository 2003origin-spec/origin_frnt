---
title: "Conic Sections: Important Points and Traps"
type: key_points
chapter: c11.mathematics.conic-sections
order: 3
---

## Sections of a cone

:::remember
- $\alpha$ = angle between the axis and a generator. $\beta$ = angle between the cutting plane and the **axis**.
- $\beta = 90^\circ$ circle, $\alpha < \beta < 90^\circ$ ellipse, $\beta = \alpha$ parabola, $\beta < \alpha$ hyperbola.
- Through the vertex: point, single line (degenerate parabola), pair of lines (degenerate hyperbola).
:::

:::trap
$\beta$ is measured from the **axis**, not from the base. A plane perpendicular to the axis has $\beta = 90^\circ$ and gives a circle.
:::

## Circle

:::trap
Before reading the centre and radius, make the $x^2$ and $y^2$ coefficients **both 1**. For $2x^2 + 2y^2 - x = 0$, divide by 2 first: centre $\left(\tfrac14, 0\right)$, radius $\tfrac14$.
:::

:::trap
$x^2 + y^2 + 2gx + 2fy + c = 0$ has centre $(-g, -f)$: the **signs flip**, and $g$, $f$ are **half** the coefficients of $x$ and $y$. For $x^2 + y^2 + 8x + 10y - 8 = 0$, the centre is $(-4, -5)$, not $(4, 5)$ or $(-8, -10)$.
:::

- (Exam extra) If $g^2 + f^2 - c < 0$, there is no real circle. If it is 0, the "circle" is just the point $(-g, -f)$.
- Circle through the origin: the constant term is 0. Centre on the $x$-axis: $k = 0$. Touches the $x$-axis: $r = |k|$.

## Parabola

:::trap
In $y^2 = 4ax$, $a$ is a **quarter** of the coefficient of $x$. For $y^2 = 10x$: $4a = 10$, so $a = \tfrac52$, focus $\left(\tfrac52, 0\right)$, latus rectum 10.
:::

:::trap
The directrix is on the **opposite side** of the vertex from the focus. $x^2 = -16y$: focus $(0, -4)$, directrix $y = 4$ (not $y = -4$).
:::

:::remember
- Squared variable: tells the axis. $y^2$ means the $x$-axis is the axis.
- Sign of the other term: tells the direction of opening.
- Latus rectum $= 4a$ = the coefficient of the first-degree term (ignoring sign).
- Ends of the latus rectum of $y^2 = 4ax$: $(a, \pm 2a)$.
:::

- Distance of any point of the parabola from the focus = its distance from the directrix. For $y^2 = 4ax$ this is $x + a$.
- The vertex is the point of the parabola nearest to the focus (distance $a$).

:::tip
Triangle formed by the vertex and the two ends of the latus rectum: base $4a$, height $a$, so area $= 2a^2$. For $x^2 = 12y$ ($a = 3$) it is 18.
:::

## Ellipse

:::trap
$a$ is always the **semi-major axis**, the root of the **larger** denominator. In $\dfrac{x^2}{16} + \dfrac{y^2}{25} = 1$, $a = 5$ is under $y^2$, so the foci are on the $y$-axis: $(0, \pm 3)$.
:::

:::trap
Ellipse: $c^2 = a^2 - b^2$. Hyperbola: $c^2 = a^2 + b^2$. Mixing these up is the most common slip in the chapter.
:::

- The latus rectum $\dfrac{2b^2}{a}$ uses the semi-major $a$, even for a vertical ellipse.
- Equation in the form $Ax^2 + By^2 = C$ ($A, B, C > 0$): divide by $C$ first to get 1 on the right.
- Given two points on an ellipse (axes along the coordinate axes), put each in $\dfrac{x^2}{a^2} + \dfrac{y^2}{b^2} = 1$ and solve for $\dfrac{1}{a^2}$ and $\dfrac{1}{b^2}$ as two unknowns.

:::remember
- $0 < e < 1$. The closer $e$ is to 0, the rounder the ellipse.
- $PF_1 + PF_2 = 2a$, the length of the major axis, for **every** point $P$ on the ellipse.
- If the sum of distances equals the distance between the foci, the "ellipse" is just the segment joining them.
:::

## Hyperbola

:::trap
In a hyperbola, $a$ is **not** the larger number. It is under the **positive** term. For $9y^2 - 4x^2 = 36$, write $\dfrac{y^2}{4} - \dfrac{x^2}{9} = 1$: $a = 2$, $b = 3$, $c = \sqrt{13}$, transverse axis along the $y$-axis, latus rectum $\dfrac{2 \times 9}{2} = 9$.
:::

:::trap
When solving for $a$ (for example from the latus rectum, as in $a^2 + 18a - 144 = 0$), reject the negative root. Lengths $a$, $b$, $c$ are positive.
:::

- $|PF_1 - PF_2| = 2a$, the length of the transverse axis. On the branch nearer $F_2$, $PF_1 - PF_2 = 2a$.
- Equilateral hyperbola ($a = b$): $c = a\sqrt2$, so $e = \sqrt2$.

## A line and a circle (exam extra)

:::remember
- $y = mx + c$ touches $x^2 + y^2 = r^2$ when $c^2 = r^2(1 + m^2)$, that is, when its distance from the centre is $r$.
- Only this circle case is in the JEE Main syllabus. The tangency conditions for the parabola, ellipse and hyperbola are beyond the syllabus (see the end of the formula sheet).
:::

:::trap
In $y = mx + c$, the letter $c$ is the line's **intercept**, not the focal distance $c$ of an ellipse or hyperbola. Use a different letter in your working if it helps.
:::

## Sliding rod

:::tip
A rod with one end on each axis: the point $P$ on it moves on an ellipse. The $x$-semi-axis is the part of the rod from $P$ to the end on the **$y$-axis**, and vice versa. NCERT: rod 15 cm, $AP = 6$ from the end on the $x$-axis, so $\dfrac{x^2}{81} + \dfrac{y^2}{36} = 1$.
:::
