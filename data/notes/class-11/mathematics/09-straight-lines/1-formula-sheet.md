---
title: "Straight Lines: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.straight-lines
order: 1
---

## Recap from earlier classes

NCERT starts the chapter with these. $P(x_1, y_1)$ and $Q(x_2, y_2)$ are two points.

:::formula{title="Distance between two points"}
$$PQ = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$
:::

:::formula{title="Section formula (internal division)"}
The point dividing $PQ$ internally in the ratio $m : n$ is $(x, y)$ with
$$x = \frac{m x_2 + n x_1}{m + n}$$
$$y = \frac{m y_2 + n y_1}{m + n}$$
For the **mid-point** ($m = n$): $\left(\dfrac{x_1 + x_2}{2}, \dfrac{y_1 + y_2}{2}\right)$.
:::

:::formula{title="Area of a triangle"}
Vertices $(x_1, y_1)$, $(x_2, y_2)$, $(x_3, y_3)$:
$$\begin{aligned} \Delta = \tfrac12\,\big|\,&x_1(y_2 - y_3) \\ +\,&x_2(y_3 - y_1) \\ +\,&x_3(y_1 - y_2)\,\big| \end{aligned}$$
Area $= 0$ means the three points are **collinear**.
:::

## Slope

:::formula{title="Slope from the inclination"}
$$m = \tan\theta$$
Only for $\theta \ne 90^\circ$. $\theta$ = inclination: the angle from the positive $x$-axis to the line, measured anticlockwise, $0^\circ \le \theta < 180^\circ$. (NCERT prints $0^\circ \le \theta \le 180^\circ$; since $180^\circ$ gives the same line as $0^\circ$, we use the usual $< 180^\circ$.) A vertical line ($\theta = 90^\circ$) has **no** slope (not defined).
:::

:::formula{title="Slope from two points"}
$$m = \frac{y_2 - y_1}{x_2 - x_1} = \frac{y_1 - y_2}{x_1 - x_2}$$
Only when $x_1 \ne x_2$. If $x_1 = x_2$ the line is vertical.
:::

:::formula{title="Slope and intercepts from Ax + By + C = 0"}
Rewrite as $y = mx + c$. For $B \ne 0$:
$$m = -\frac{A}{B}$$
$x$-intercept $= -\dfrac{C}{A}$ (if $A \ne 0$), $y$-intercept $= -\dfrac{C}{B}$ (if $B \ne 0$).
:::

:::formula{title="Parallel and perpendicular lines"}
For two **non-vertical** lines with slopes $m_1$ and $m_2$:
$$\text{parallel} \iff m_1 = m_2$$
$$\text{perpendicular} \iff m_1 m_2 = -1$$
Two vertical lines are parallel, and a vertical line and a horizontal line are perpendicular, but there these slope tests cannot be used.
:::

:::formula{title="Angle between two lines"}
The **acute** angle $\theta$ between two **non-vertical** lines with slopes $m_1$ and $m_2$:
$$\tan\theta = \left|\frac{m_2 - m_1}{1 + m_1 m_2}\right|$$
Needs $1 + m_1 m_2 \ne 0$ (if it is 0, the lines are perpendicular). The obtuse angle is $180^\circ - \theta$.
:::

:::formula{title="Collinear points"}
$A$, $B$, $C$ are collinear exactly when
$$\text{slope of } AB = \text{slope of } BC$$
(or when area of $\triangle ABC = 0$). If a side is vertical its slope is not defined; then use the area test.
:::

## Equations of a line

:::formula{title="Lines parallel to the axes"}
$$y = a \quad (\text{parallel to the } x\text{-axis})$$
$$x = b \quad (\text{parallel to the } y\text{-axis})$$
The $x$-axis is $y = 0$; the $y$-axis is $x = 0$.
:::

:::formula{title="Point-slope form"}
Through $(x_0, y_0)$ with slope $m$:
$$y - y_0 = m\,(x - x_0)$$
:::

:::formula{title="Two-point form"}
Through $(x_1, y_1)$ and $(x_2, y_2)$, with $x_1 \ne x_2$:
$$y - y_1 = \frac{y_2 - y_1}{x_2 - x_1}\,(x - x_1)$$
:::

:::formula{title="Slope-intercept form"}
Slope $m$, $y$-intercept $c$:
$$y = mx + c$$
Slope $m$, $x$-intercept $d$:
$$y = m\,(x - d)$$
Intercepts are signed: $c < 0$ means the line cuts the negative $y$-axis.
:::

:::formula{title="Intercept form"}
$x$-intercept $a$, $y$-intercept $b$ (both non-zero):
$$\frac{x}{a} + \frac{y}{b} = 1$$
:::

:::formula{title="General equation"}
$$Ax + By + C = 0$$
$A$ and $B$ not both zero. Every line can be written this way.
:::

:::formula{title="Parallel and perpendicular through a point"}
Parallel to $Ax + By + C = 0$ through $(x_1, y_1)$ (NCERT Exercise 9.3):
$$A(x - x_1) + B(y - y_1) = 0$$
Perpendicular to it through $(x_1, y_1)$ (shortcut, not printed in NCERT; it follows from $m_1 m_2 = -1$):
$$B(x - x_1) - A(y - y_1) = 0$$
:::

## Distances and areas

:::formula{title="Distance of a point from a line"}
From $(x_1, y_1)$ to $Ax + By + C = 0$:
$$d = \frac{|Ax_1 + By_1 + C|}{\sqrt{A^2 + B^2}}$$
This is the **perpendicular** distance (the shortest one).
:::

:::formula{title="Distance between parallel lines"}
$$d = \frac{|c_1 - c_2|}{\sqrt{1 + m^2}}$$
for $y = mx + c_1$ and $y = mx + c_2$.
$$d = \frac{|C_1 - C_2|}{\sqrt{A^2 + B^2}}$$
for $Ax + By + C_1 = 0$ and $Ax + By + C_2 = 0$: the **same** $A$ and $B$ in both.
:::

:::formula{title="Perpendicular from the origin"}
If a line has intercepts $a$ and $b$ and $p$ is the perpendicular distance from the origin:
$$\frac{1}{p^2} = \frac{1}{a^2} + \frac{1}{b^2}$$
:::

:::formula{title="Triangle cut off by two lines and the y-axis"}
Lines $y = m_1 x + c_1$, $y = m_2 x + c_2$ and $x = 0$, with $m_1 \ne m_2$:
$$\text{Area} = \frac{(c_1 - c_2)^2}{2\,|m_1 - m_2|}$$
:::

## Exam extras (not in current NCERT)

Normal form and distance form come under "various forms of the equation of a line" in the JEE Main syllabus. Concurrency and the centroid, orthocentre and circumcentre are named in it. The other results are shortcuts for tasks NCERT does by hand (meeting point, foot, image, equal distances, ratio of division).

:::formula{title="Normal form"}
$$x\cos\omega + y\sin\omega = p$$
$p$ = length of the perpendicular from the origin ($p \ge 0$), $\omega$ = angle that perpendicular makes with the positive $x$-axis, measured anticlockwise.
:::

:::formula{title="Distance (parametric) form"}
The point at distance $r$ from $(x_1, y_1)$ along a line of inclination $\theta$:
$$(x_1 + r\cos\theta,\ y_1 + r\sin\theta)$$
$r > 0$ in the direction of $\theta$, $r < 0$ the other way.
:::

:::formula{title="Line through the meeting point of two lines"}
$$L_1 + \lambda L_2 = 0$$
$L_1 \equiv A_1x + B_1y + C_1$, $L_2 \equiv A_2x + B_2y + C_2$. For two lines that meet (not parallel), this gives every line through their meeting point except $L_2 = 0$ itself.
:::

:::formula{title="Foot of perpendicular and image"}
For $(x_1, y_1)$ and the line $Ax + By + C = 0$, let
$$t = \frac{Ax_1 + By_1 + C}{A^2 + B^2}$$
Foot $= (x_1 - At,\ y_1 - Bt)$. Image $= (x_1 - 2At,\ y_1 - 2Bt)$.
:::

:::formula{title="Side of a line"}
$(x_1, y_1)$ and $(x_2, y_2)$ are on the **same side** of $Ax + By + C = 0$ when $Ax_1 + By_1 + C$ and $Ax_2 + By_2 + C$ have the same sign. If the segment joining them is not parallel to the line, the line divides it (from the first point) in the ratio
$$-\frac{Ax_1 + By_1 + C}{Ax_2 + By_2 + C}$$
(internally if this is positive).
:::

:::formula{title="Angle bisectors"}
$$\begin{aligned} &\frac{A_1x + B_1y + C_1}{\sqrt{A_1^2 + B_1^2}} \\ = \pm\,&\frac{A_2x + B_2y + C_2}{\sqrt{A_2^2 + B_2^2}} \end{aligned}$$
For two lines that meet. The two bisectors are perpendicular to each other. (NCERT Example 16 does this by hand as "points equidistant from two lines".)
:::

:::formula{title="Three concurrent lines"}
If no two of $a_i x + b_i y + c_i = 0$ ($i = 1, 2, 3$) are parallel, they meet at one point exactly when
$$
\begin{vmatrix}
a_1 & b_1 & c_1 \\
a_2 & b_2 & c_2 \\
a_3 & b_3 & c_3
\end{vmatrix} = 0
$$
:::

:::formula{title="Centroid and incentre"}
Triangle $A(x_1, y_1)$, $B(x_2, y_2)$, $C(x_3, y_3)$.

Centroid $G = (G_x, G_y)$:
$$G_x = \frac{x_1 + x_2 + x_3}{3}$$
$$G_y = \frac{y_1 + y_2 + y_3}{3}$$
Incentre $I = (I_x, I_y)$:
$$I_x = \frac{a x_1 + b x_2 + c x_3}{a + b + c}$$
$I_y$ the same with $y$'s. $a = BC$, $b = CA$, $c = AB$ (the side opposite each vertex). The centroid is in the JEE Main syllabus; the incentre is not named there (beyond the syllabus: a small aid only).
:::
