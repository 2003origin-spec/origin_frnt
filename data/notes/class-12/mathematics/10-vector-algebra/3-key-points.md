---
title: "Vector Algebra: Important Points and Traps"
type: key_points
chapter: c12.mathematics.vector-algebra
order: 3
---

## Basics

:::remember
- $l^2 + m^2 + n^2 = 1$ for direction cosines, but $a^2 + b^2 + c^2 \ne 1$ in general for direction ratios.
- Sides of a triangle taken in order add to $\vec 0$.
- $\overrightarrow{AB}$ = (position vector of $B$) $-$ (position vector of $A$): **end minus start**.
- A zero vector has no fixed direction (it can be thought of as having any direction).
:::

:::trap
**Collinear is not the same as equal.** Collinear vectors only need to be parallel to one line; their lengths and senses can differ. Equal vectors need the same length **and** the same direction. Two collinear vectors of the same length can still be opposite ($\vec a$ and $-\vec a$).
:::

- A vector equally inclined to the three axes has $l = m = n$, so $3l^2 = 1$ and $l = m = n = \pm\dfrac{1}{\sqrt3}$.
- Since $\cos^2\alpha + \cos^2\beta + \cos^2\gamma = 1$, also $\sin^2\alpha + \sin^2\beta + \sin^2\gamma = 2$.
- If two direction angles are given, the third comes from $l^2 + m^2 + n^2 = 1$. Check whether the question says "acute" before choosing the sign.

:::trap
"A vector of magnitude 5 along $\vec a$" means $5\hat a = \dfrac{5\,\vec a}{|\vec a|}$, not $5\vec a$. Find the unit vector first.
:::

## Section formula

:::trap
In $\dfrac{m\vec b + n\vec a}{m + n}$, the ratio $m$ multiplies the **far** point $\vec b$ (the point $Q$), not the near one. Mixing these up gives the point dividing in $n : m$.
:::

- External division: $\dfrac{m\vec b - n\vec a}{m - n}$. Dividing externally in the ratio $1 : 1$ is impossible ($m = n$).
- To find the ratio in which $B$ divides $AC$, write $\vec b = \dfrac{k\vec c + \vec a}{k + 1}$ and solve for $k$ from one component; the other components must agree. A negative $k$ means external division.

## Dot product

:::trap
The dot product of two vectors is a **number**, not a vector. So $(\vec a \cdot \vec b)\,\vec c$ is a vector parallel to $\vec c$, while $\vec a \cdot \vec b \cdot \vec c$ means nothing.
:::

:::trap
$\vec a \cdot \vec b = 0$ does **not** mean one of them is $\vec 0$. Non-zero vectors can be perpendicular. Example: $\hat i \cdot \hat j = 0$.

Likewise, $\vec a \cdot \vec b = \vec a \cdot \vec c$ does not give $\vec b = \vec c$. It only says $\vec a \perp (\vec b - \vec c)$.
:::

- $|\vec a + \vec b| = |\vec a - \vec b|$ for non-zero vectors means $\vec a \perp \vec b$ (squares give $\vec a \cdot \vec b = 0$).
- $(\vec a + \vec b) \perp (\vec a - \vec b)$ exactly when $|\vec a| = |\vec b|$. This is why the diagonals of a rhombus are perpendicular.
- If $\vec a + \vec b + \vec c = \vec 0$, square both sides:
$$\begin{aligned} & \vec a \cdot \vec b + \vec b \cdot \vec c + \vec c \cdot \vec a \\ & = -\tfrac12\left(|\vec a|^2 + |\vec b|^2 + |\vec c|^2\right) \end{aligned}$$
For three unit vectors this is $-\dfrac32$.

:::trap
The **projection** of $\vec a$ on $\vec b$ divides by $|\vec b|$, not $|\vec a|$: it is $\dfrac{\vec a \cdot \vec b}{|\vec b|}$. Projection of $\vec b$ on $\vec a$ is a different number, $\dfrac{\vec a \cdot \vec b}{|\vec a|}$.

NCERT's definition calls the length $|\vec p|$ of the projection vector "the projection", but its formula $\vec a \cdot \hat b$ (used in its examples) is negative for an obtuse angle. Give the signed value $\vec a \cdot \hat b$ unless a length is asked for.
:::

- The angle between two vectors is always taken in $[0, \pi]$. A negative $\cos\theta$ means an obtuse angle, not a mistake.
- Angle at vertex $B$ of triangle $ABC$ is the angle between $\overrightarrow{BA}$ and $\overrightarrow{BC}$, both drawn **from** $B$. Using $\overrightarrow{AB}$ instead gives the supplement.

## Cross product

:::trap
**Order matters.** $\vec b \times \vec a = -\,\vec a \times \vec b$. And $\hat i \times \hat k = -\hat j$, not $+\hat j$.
:::

:::trap
In the determinant expansion, the $\hat j$ term has a **minus sign in front**: $-(a_1b_3 - a_3b_1)\,\hat j$. Forgetting it is the most common slip.
:::

- $\vec a \times \vec b = \vec 0$ does not mean one of them is $\vec 0$: parallel non-zero vectors also give $\vec 0$.
- $\vec a \times \vec b$ is perpendicular to both $\vec a$ and $\vec b$. Check your answer by dotting it with each; both must give 0.
- "A unit vector perpendicular to both" has **two** answers, $\pm\dfrac{\vec a \times \vec b}{|\vec a \times \vec b|}$.
- $(\vec a - \vec b) \times (\vec a + \vec b) = 2\,(\vec a \times \vec b)$ (NCERT exercise). Expand and use $\vec a \times \vec a = \vec 0$.

:::trap
**Triangle area needs the half.** $|\vec a \times \vec b|$ is the parallelogram; the triangle on the same two sides is $\tfrac12|\vec a \times \vec b|$. For a triangle from its vertices, both side vectors must start from the **same** vertex ($\overrightarrow{AB}$ and $\overrightarrow{AC}$).
:::

## Mixing dot and cross

:::remember
- $|\vec a \times \vec b|^2 + (\vec a \cdot \vec b)^2 = |\vec a|^2\,|\vec b|^2$ (from $\sin^2\theta + \cos^2\theta = 1$; exam extra, not printed in NCERT).
- $\hat i \cdot (\hat j \times \hat k) = 1$, while $\hat j \cdot (\hat i \times \hat k) = -1$.
- If $|\vec a \cdot \vec b| = |\vec a \times \vec b|$ for non-zero vectors, then $\tan\theta = \pm 1$: $\theta = \dfrac{\pi}{4}$ or $\dfrac{3\pi}{4}$. With $\vec a \cdot \vec b = |\vec a \times \vec b|$ (no modulus on the dot), only $\theta = \dfrac{\pi}{4}$.
:::

:::tip
**Cyclic order** $\hat i \to \hat j \to \hat k \to \hat i$: going forward gives $+$ ($\hat i \times \hat j = \hat k$), going backward gives $-$ ($\hat j \times \hat i = -\hat k$). Write the three letters round a circle in that order.
:::

:::tip
For "is $\hat a + \hat b$ a unit vector?" questions: $|\hat a + \hat b|^2 = 2 + 2\cos\theta$. It equals 1 when $\theta = \dfrac{2\pi}{3}$. Similarly $|\hat a - \hat b| = 2\sin\dfrac{\theta}{2}$.
:::
