---
title: "Application of Integrals: Short Notes"
type: short_notes
chapter: c12.mathematics.application-of-integrals
order: 2
---

## 1. Area as a sum of thin strips

- Cut the region into many very thin vertical strips. A strip at position $x$ has height $y = f(x)$ and width $dx$, so its area is $dA = y\,dx$ (the **elementary area**).
- Adding all the strips from $x = a$ to $x = b$ gives the area:

$$A = \int_a^b y\,dx = \int_a^b f(x)\,dx$$

- This is the area bounded by the curve $y = f(x)$, the **x-axis** and the **ordinates** $x = a$ and $x = b$.

## 2. Horizontal strips

- For a curve written as $x = g(y)$, use horizontal strips of length $x$ and width $dy$.
- The area bounded by the curve, the **y-axis** and the lines $y = c$, $y = d$ is

$$A = \int_c^d x\,dy = \int_c^d g(y)\,dy$$

- The limits are now **$y$-values**.

| Strip | Area of strip | Limits |
|---|---|---|
| Vertical | $y\,dx$ | $x$-values |
| Horizontal | $x\,dy$ | $y$-values |

:::example{title="Horizontal strips are easier"}
Area bounded by $y^2 = 9x$, the y-axis and the line $y = 6$. Write the curve as $x = \dfrac{y^2}{9}$. Then
$A = \displaystyle\int_0^6 \frac{y^2}{9}\,dy = \left[\frac{y^3}{27}\right]_0^6 = 8$.
:::

## 3. Curves below the x-axis

- If $f(x) < 0$ on $[a, b]$, every $y\,dx$ is negative, so the integral is **negative**. Area is never negative: take the **absolute value** $\left|\int_a^b f(x)\,dx\right|$.
- If the curve is partly below and partly above the axis, split the interval where the curve cuts the axis. Find each piece separately and add their sizes: $A = |A_1| + A_2$.
- In one line: area $= \displaystyle\int_a^b |f(x)|\,dx$.

:::example{title="A line that crosses the axis"}
Area between $y = 2x - 2$, the x-axis, $x = 0$ and $x = 3$. The line cuts the axis at $x = 1$.

$\displaystyle\int_0^1 (2x - 2)\,dx = -1$ and $\displaystyle\int_1^3 (2x - 2)\,dx = 4$.

Area $= |-1| + 4 = 5$. (The plain integral from 0 to 3 gives $3$, which is wrong for area.)
:::

## 4. Trigonometric curves

- One arch of $\sin x$ (from $0$ to $\pi$) has area 2. The next arch (from $\pi$ to $2\pi$) is below the axis and also has area 2.
- So from $0$ to $2\pi$ the area is **4**, though $\int_0^{2\pi} \sin x\,dx = 0$. The same holds for $\cos x$: split at $\dfrac{\pi}{2}$ and $\dfrac{3\pi}{2}$ to get $1 + 2 + 1 = 4$.

## 5. Circle and ellipse: use symmetry

- **Circle** $x^2 + y^2 = a^2$: it is symmetric about both axes. Find the first-quadrant part and multiply by 4.
- In the first quadrant, $y = +\sqrt{a^2 - x^2}$ (take the positive root, because $y \ge 0$ there).
- $A = 4\displaystyle\int_0^a \sqrt{a^2 - x^2}\,dx = 4 \cdot \frac{\pi a^2}{4} = \pi a^2$.
- **Ellipse** $\dfrac{x^2}{a^2} + \dfrac{y^2}{b^2} = 1$: in the first quadrant $y = \dfrac{b}{a}\sqrt{a^2 - x^2}$, so $A = 4 \cdot \dfrac{b}{a} \cdot \dfrac{\pi a^2}{4} = \pi a b$.
- Horizontal strips give the same answers (NCERT shows both ways).

:::remember
$\displaystyle\int_0^a \sqrt{a^2 - x^2}\,dx = \frac{\pi a^2}{4}$, the area of a quarter circle. At the upper limit, $\sin^{-1} 1 = \dfrac{\pi}{2}$.
:::

## 6. How to solve an area question

1. **Sketch** the curve(s) and the given lines. Shade the region.
2. Find where the curve meets the axis or the lines (these give the limits).
3. Choose vertical or horizontal strips: pick the one where **one formula** covers the whole region.
4. Use symmetry if the region has it.
5. Integrate. If any part lies below the x-axis (or left of the y-axis for horizontal strips), take absolute values piece by piece.
6. Check: the answer must be positive, and roughly match a rectangle or triangle estimate.

## 7. Area between two curves (exam extra)

Not in the current NCERT chapter. It is covered by the JEE Main syllabus line "areas of the regions bounded by simple curves in standard forms", and it is very common in the exam.

- If $y = f(x)$ is **above** $y = g(x)$ for all $x$ in $[a, b]$, each vertical strip has height $f(x) - g(x)$:

$$A = \int_a^b \left[f(x) - g(x)\right] dx$$

- This works even if both curves are below the x-axis: top minus bottom is always positive.
- Usually $a$ and $b$ are where the curves meet: solve $f(x) = g(x)$.
- If the curves cross inside $[a, b]$, split at the crossing and swap top and bottom.
- With horizontal strips: right curve minus left curve, integrated with respect to $y$.

:::example{title="Parabola and line"}
Region between $y = x^2$ and $y = x$. They meet where $x^2 = x$: $x = 0, 1$. On $[0, 1]$ the line is on top.

$A = \displaystyle\int_0^1 (x - x^2)\,dx = \frac12 - \frac13 = \frac16$
:::

:::example{title="When horizontal strips win"}
Region between $y^2 = x$ and $x = y + 2$. They meet where $y^2 = y + 2$: $y = -1, 2$. The line is on the right.

$A = \displaystyle\int_{-1}^{2} \left(y + 2 - y^2\right) dy = \frac92$

With vertical strips you would need two integrals, because the lower boundary changes at $x = 1$.
:::

## 8. Regions given by inequalities (exam extra)

- A region like $\{(x, y) : x^2 \le y \le 1\}$ means: above $y = x^2$ and below $y = 1$.
- Sketch each boundary, shade the common part, then find the meeting points. Here $x^2 = 1$ gives $x = \pm 1$, so $A = \displaystyle\int_{-1}^{1} (1 - x^2)\,dx = \frac43$.
- $|x| + |y| \le a$ is a square with diagonals $2a$, so its area is $2a^2$.
