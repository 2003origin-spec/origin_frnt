---
title: "Straight Lines: Quick Practice"
type: practice
chapter: c11.mathematics.straight-lines
order: 4
---

Try each question first, then tap **Show answer**.

## Slope and angle

:::question{title="1. Angle between lines" exam="JEE Main level"}
Find the acute angle between the lines $2x - y + 1 = 0$ and $3x + y - 7 = 0$.

---

Slopes: $m_1 = 2$ and $m_2 = -3$.

$\tan\theta = \left|\dfrac{-3 - 2}{1 + (2)(-3)}\right| = \left|\dfrac{-5}{-5}\right| = 1$, so $\theta =$ **45°**.
:::

:::question{title="2. Perpendicular lines" exam="JEE Main level"}
The line through $(k, 3)$ and $(2, -1)$ is perpendicular to $x - 2y + 5 = 0$. Find $k$.

---

The slope of $x - 2y + 5 = 0$ is $\dfrac12$, so the required slope is $-2$.

$\dfrac{3 - (-1)}{k - 2} = -2$ gives $k - 2 = -2$, so **$k = 0$**.
:::

## Forms of the equation

:::question{title="3. Bisected segment" exam="JEE Main level"}
A line meets the $x$-axis at $A$ and the $y$-axis at $B$. The mid-point of $AB$ is $(3, 4)$. Find the equation of the line.

---

$A = (6, 0)$ and $B = (0, 8)$. Intercept form: $\dfrac{x}{6} + \dfrac{y}{8} = 1$.

Multiply by 24: **$4x + 3y - 24 = 0$**.
:::

:::question{title="4. Through a meeting point" exam="JEE Main level"}
Find the line through the point where $x + y = 5$ and $2x - y = 1$ meet, perpendicular to $3x + 4y = 7$.

---

Adding the two equations: $3x = 6$, so $x = 2$ and $y = 3$.

A perpendicular line has the form $4x - 3y + k = 0$. At $(2, 3)$: $8 - 9 + k = 0$, so $k = 1$.

The line is **$4x - 3y + 1 = 0$**.
:::

:::question{title="5. Concurrent lines" exam="JEE Main level"}
Find $k$ if the lines $x + 2y - 5 = 0$, $3x - y - 1 = 0$ and $kx + y - 7 = 0$ pass through one point.

---

From the first, $x = 5 - 2y$. Then $3(5 - 2y) - y - 1 = 0$ gives $y = 2$, $x = 1$.

Put $(1, 2)$ into the third: $k + 2 - 7 = 0$, so **$k = 5$**.
:::

## Distances and images

:::question{title="6. Parallel lines" exam="JEE Main level"}
Find the distance between the parallel lines $6x + 8y - 15 = 0$ and $3x + 4y + 5 = 0$.

---

Make $A$ and $B$ the same: the second line is $6x + 8y + 10 = 0$.

$d = \dfrac{|-15 - 10|}{\sqrt{36 + 64}} = \dfrac{25}{10} =$ **$\dfrac52$**.

(Using $C_2 = 5$ without rescaling gives the wrong answer 2.)
:::

:::question{title="7. Image in a line" exam="JEE Main level"}
Find the image of the point $(2, 1)$ in the line $x + y - 5 = 0$.

---

Let the image be $(h, k)$. The slope of the line is $-1$, so the slope of the join is $1$: $\dfrac{k - 1}{h - 2} = 1$, that is $h - k = 1$.

The mid-point $\left(\dfrac{h + 2}{2}, \dfrac{k + 1}{2}\right)$ lies on the line: $h + k + 3 = 10$, that is $h + k = 7$.

So $h = 4$, $k = 3$. The image is **$(4, 3)$**.
:::

:::question{title="8. Distance along a line" exam="JEE Main level"}
Find the distance of the point $P(2, 3)$ from the line $x + y - 11 = 0$, measured along a line of inclination $60^\circ$.

---

Points on the line through $P$ at inclination $60^\circ$: $\left(2 + \dfrac{r}{2},\ 3 + \dfrac{\sqrt3\,r}{2}\right)$.

Put into $x + y = 11$: $5 + \dfrac{(1 + \sqrt3)\,r}{2} = 11$, so $r = \dfrac{12}{1 + \sqrt3}$.

Rationalising, $r =$ **$6(\sqrt3 - 1) \approx 4.39$** units.
:::

## Harder ones

:::question{title="9. Two lines at 45°" exam="JEE Main level"}
Find the equations of the lines through $(1, 2)$ that make an angle of $45^\circ$ with $3x - y + 2 = 0$.

---

The given slope is 3. For slope $m$: $\left|\dfrac{m - 3}{1 + 3m}\right| = 1$.

$m - 3 = 1 + 3m$ gives $m = -2$. $m - 3 = -(1 + 3m)$ gives $m = \dfrac12$.

The lines are **$2x + y - 4 = 0$** and **$x - 2y + 3 = 0$**.
:::

:::question{title="10. Orthocentre" exam="JEE Main level"}
Find the orthocentre of the triangle with vertices $A(0, 0)$, $B(6, 0)$ and $C(2, 4)$.

---

$AB$ lies on the $x$-axis, so the altitude from $C$ is $x = 2$.

The slope of $BC$ is $\dfrac{4 - 0}{2 - 6} = -1$, so the altitude from $A$ has slope 1: $y = x$.

They meet at **$(2, 2)$**. Check: the altitude from $B$, $y = -\tfrac12(x - 6)$, also passes through $(2, 2)$.
:::
