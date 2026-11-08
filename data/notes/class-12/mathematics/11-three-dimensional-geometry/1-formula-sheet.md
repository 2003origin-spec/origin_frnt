---
title: "3D Geometry (Class 12): Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.three-dimensional-geometry
order: 1
---

Notation as in NCERT. A point $A$ has position vector $\vec a$. A line's direction is a vector $\vec b$. Direction cosines are $l, m, n$; direction ratios are $a, b, c$. Do not mix up the number $b$ (a direction ratio) with the vector $\vec b$.

The current NCERT chapter covers **lines only**. Planes have no section in the current NCERT chapter (only its opening paragraph still mentions them) and are not in the JEE Main 2026 syllabus.

## Direction cosines and ratios

:::formula{title="Direction cosines"}
$$l = \cos\alpha$$
$$m = \cos\beta$$
$$n = \cos\gamma$$
$\alpha, \beta, \gamma$ = angles the **directed** line makes with the positive $x$, $y$ and $z$-axes. Reversing the line changes the sign of all three.
:::

:::formula{title="The basic identity"}
$$l^2 + m^2 + n^2 = 1$$
True for direction cosines only, not for direction ratios.
:::

:::formula{title="From direction ratios to direction cosines"}
$$l = \pm\frac{a}{\sqrt{a^2 + b^2 + c^2}}$$
$$m = \pm\frac{b}{\sqrt{a^2 + b^2 + c^2}}$$
$$n = \pm\frac{c}{\sqrt{a^2 + b^2 + c^2}}$$
Take the **same** sign in all three. Direction ratios are any three numbers proportional to $l, m, n$: $a = \lambda l$, $b = \lambda m$, $c = \lambda n$ for any $\lambda \ne 0$.
:::

:::formula{title="Line through two points"}
For $P(x_1, y_1, z_1)$ and $Q(x_2, y_2, z_2)$, direction ratios:
$$x_2 - x_1,\ y_2 - y_1,\ z_2 - z_1$$
Direction cosines (from $P$ to $Q$):
$$\frac{x_2 - x_1}{PQ},\ \frac{y_2 - y_1}{PQ},\ \frac{z_2 - z_1}{PQ}$$
$$\begin{aligned} PQ^2 = {} & (x_2 - x_1)^2 + (y_2 - y_1)^2 \\ & + (z_2 - z_1)^2 \end{aligned}$$
:::

:::formula{title="Axes"}
Direction cosines of the $x$, $y$ and $z$-axes: $1, 0, 0$; $\ 0, 1, 0$; $\ 0, 0, 1$.
:::

## Equation of a line

:::formula{title="Through a point, parallel to a vector (vector form)"}
$$\vec r = \vec a + \lambda\vec b$$
$\vec a$ = position vector of a point on the line, $\vec b$ = a vector along the line, $\lambda$ = any real number (the parameter).
:::

:::formula{title="Same line, Cartesian form"}
Through $(x_1, y_1, z_1)$ with direction ratios $a, b, c$:
$$\frac{x - x_1}{a} = \frac{y - y_1}{b} = \frac{z - z_1}{c}$$
With direction cosines, put $l, m, n$ in place of $a, b, c$. Here $\vec b = a\hat i + b\hat j + c\hat k$.
:::

:::formula{title="Parametric form"}
$$x = x_1 + \lambda a$$
$$y = y_1 + \lambda b$$
$$z = z_1 + \lambda c$$
Every point of the line comes from one value of $\lambda$.
:::

:::formula{title="Through two points"}
$$\vec r = \vec a + \lambda(\vec b - \vec a)$$
Here $\vec a$ and $\vec b$ are the position vectors of the two points.
:::

## Angle between two lines

:::formula{title="Vector form"}
For $\vec r = \vec a_1 + \lambda\vec b_1$ and $\vec r = \vec a_2 + \mu\vec b_2$, the acute angle $\theta$ is given by
$$\cos\theta = \frac{|\vec b_1 \cdot \vec b_2|}{|\vec b_1|\,|\vec b_2|}$$
Only the directions matter, not the points $\vec a_1, \vec a_2$.
:::

:::formula{title="With direction ratios"}
$$\cos\theta = \frac{|a_1a_2 + b_1b_2 + c_1c_2|}{r_1\,r_2}$$
where
$$r_1 = \sqrt{a_1^2 + b_1^2 + c_1^2}$$
$$r_2 = \sqrt{a_2^2 + b_2^2 + c_2^2}$$
The modulus gives the acute angle. ($r_1, r_2$ are just short names here; NCERT writes the roots out in full.)
:::

:::formula{title="With direction cosines"}
$$\cos\theta = |l_1l_2 + m_1m_2 + n_1n_2|$$
No denominator, because $l^2 + m^2 + n^2 = 1$ for each line.
:::

:::formula{title="Sine of the angle"}
$$\sin\theta = \frac{|\vec b_1 \times \vec b_2|}{|\vec b_1|\,|\vec b_2|}$$
In direction ratios, $|\vec b_1 \times \vec b_2|^2$ is
$$\begin{aligned} & (a_1b_2 - a_2b_1)^2 + (b_1c_2 - b_2c_1)^2 \\ & + (c_1a_2 - c_2a_1)^2 \end{aligned}$$
:::

:::formula{title="Perpendicular lines"}
$$a_1a_2 + b_1b_2 + c_1c_2 = 0$$
:::

:::formula{title="Parallel lines"}
$$\frac{a_1}{a_2} = \frac{b_1}{b_2} = \frac{c_1}{c_2}$$
Direction ratios proportional. (If a direction ratio is 0, read this as $\vec b_1 \times \vec b_2 = \vec 0$.)
:::

## Distances between lines

:::formula{title="Shortest distance between skew lines (vector form)"}
For $\vec r = \vec a_1 + \lambda\vec b_1$ and $\vec r = \vec a_2 + \mu\vec b_2$:
$$d = \frac{|N|}{|\vec b_1 \times \vec b_2|}$$
where
$$N = (\vec b_1 \times \vec b_2) \cdot (\vec a_2 - \vec a_1)$$
Needs $\vec b_1 \times \vec b_2 \ne \vec 0$ (lines not parallel). Take the modulus so $d \ge 0$.
:::

:::formula{title="Shortest distance (Cartesian form)"}
For the lines through $(x_1, y_1, z_1)$ and $(x_2, y_2, z_2)$ with direction ratios $a_1, b_1, c_1$ and $a_2, b_2, c_2$:
$$d = \frac{|D|}{|\vec b_1 \times \vec b_2|}$$
$$D = \begin{vmatrix} x_2 - x_1 & y_2 - y_1 & z_2 - z_1 \\ a_1 & b_1 & c_1 \\ a_2 & b_2 & c_2 \end{vmatrix}$$
Here $\vec b_1 = a_1\hat i + b_1\hat j + c_1\hat k$ and $\vec b_2 = a_2\hat i + b_2\hat j + c_2\hat k$. The denominator is the square root of the sum in "Sine of the angle" above.

The NCERT derivation puts a modulus around the whole fraction; the chapter summary prints this form without it. Either way, take the absolute value of $D$, because a distance cannot be negative.
:::

:::formula{title="Do the lines meet?"}
Two lines that are **not parallel** intersect exactly when
$$(\vec b_1 \times \vec b_2) \cdot (\vec a_2 - \vec a_1) = 0$$
That is, $D = 0$. If this is not zero, the lines are skew. (This follows directly from the formula above.)
:::

:::formula{title="Distance between parallel lines"}
For $\vec r = \vec a_1 + \lambda\vec b$ and $\vec r = \vec a_2 + \mu\vec b$:
$$d = \frac{|\vec b \times (\vec a_2 - \vec a_1)|}{|\vec b|}$$
:::

## Exam extras (not in NCERT)

NCERT does not state these results. JEE Main asks them under its syllabus topics "direction cosines" and "equation of a line".

:::formula{title="Angles with the axes"}
$$\sin^2\alpha + \sin^2\beta + \sin^2\gamma = 2$$
$$\cos 2\alpha + \cos 2\beta + \cos 2\gamma = -1$$
Both follow from $l^2 + m^2 + n^2 = 1$.
:::

:::formula{title="Foot of the perpendicular from P to a line"}
Line $\vec r = \vec a + \lambda\vec b$. The foot $F$ has position vector $\vec f = \vec a + \lambda_0\vec b$, where
$$\lambda_0 = \frac{(\vec p - \vec a) \cdot \vec b}{|\vec b|^2}$$
$\vec p$ = position vector of $P$. Image of $P$ in the line: $2\vec f - \vec p$.
:::

:::formula{title="Distance of a point from a line"}
$$PF = \frac{|(\vec p - \vec a) \times \vec b|}{|\vec b|}$$
The same formula as for parallel lines, with $P$ on the second line. (NCERT's parallel-lines proof finds exactly this distance, but does not state it as a separate result.)
:::
