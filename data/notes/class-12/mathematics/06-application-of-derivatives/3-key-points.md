---
title: "Application of Derivatives: Important Points and Traps"
type: key_points
chapter: c12.mathematics.application-of-derivatives
order: 3
---

## Rate of change

:::trap
**Put in numbers only after differentiating.** If you put $r = 10$ into $A = \pi r^2$ first, you get a constant, and its derivative is 0. Differentiate the general relation, then substitute the values at that instant.
:::

:::trap
**Signs of rates.** "Decreasing at 3 cm/min" means $\dfrac{dx}{dt} = -3$. If the answer comes out negative, the quantity is decreasing. When asked "how fast is it decreasing", give the size, for example "5/24 m/s".
:::

:::trap
**Cone problems.** $V = \frac13\pi r^2 h$ has two changing quantities. Use the fixed shape (similar triangles, or the given semi-vertical angle) to write $r$ in terms of $h$ **before** differentiating.
:::

- Rate of change "with respect to the radius" means $\dfrac{dA}{dr}$, not $\dfrac{dA}{dt}$. Read the words "per second" or "with respect to" carefully.
- Units: area rates in cm²/s, volume rates in cm³/s. Check that the units of the given rates match before you use them.

:::remember
- $\dfrac{dA}{dr} = 2\pi r$ for a circle: it equals the circumference.
- $\dfrac{dV}{dr} = 4\pi r^2$ for a sphere: it equals the surface area.
- Marginal cost $= \dfrac{dC}{dx}$, marginal revenue $= \dfrac{dR}{dx}$.
:::

## Increasing and decreasing

:::trap
**$f' > 0$ is enough but not needed** for strict increase. $f(x) = x^3$ is strictly increasing on $\mathbb{R}$, but $f'(0) = 0$. (Exam extra: $f' \ge 0$ with zeros only at isolated points still gives strictly increasing.)
:::

:::trap
**A function can be increasing on two intervals but not on their union.** $f(x) = -\dfrac{1}{x}$ has $f' = \dfrac{1}{x^2} > 0$ on $(-\infty, 0)$ and on $(0, \infty)$. But $f(-1) = 1 > f(1) = -1$. Write the answer as two separate intervals, not one union.
:::

- Always find the **domain** first. For $\log(1 + x)$, only $x > -1$ counts. For $\log \sin x$, only where $\sin x > 0$.
- For trigonometric functions on a given interval, keep only the roots of $f'(x) = 0$ that lie **inside** it.
- To make $f$ increasing on all of $\mathbb{R}$ when $f'$ is a quadratic $px^2 + qx + r$, you need $p > 0$ and discriminant $q^2 - 4pr \le 0$.
- $f(x) = x^2$ is decreasing on $(-\infty, 0)$ and increasing on $(0, \infty)$, so it is neither on $\mathbb{R}$.

:::remember
- $e^x$ (on $\mathbb{R}$) and $\log x$ (on $(0, \infty)$) are **strictly** increasing on open intervals, so they have no maximum or minimum values.
- $\sin x$ is increasing on $\left(0, \frac{\pi}{2}\right)$ and decreasing on $\left(\frac{\pi}{2}, \pi\right)$.
- $\cos x$ is decreasing on $(0, \pi)$ and increasing on $(\pi, 2\pi)$.
:::

## Critical points and local extrema

:::trap
**$f'(c) = 0$ does not mean a maximum or minimum.** For $x^3$, $f'(0) = 0$ but $f'$ does not change sign. Check the sign change or $f''(c)$.
:::

:::trap
**Critical points include points where $f'$ does not exist.** $|x|$, $3 + |x|$ and $x^{2/3}$ all have a minimum at 0, where $f'(0)$ does not exist. Never skip these points.
:::

:::trap
**$f''(c) = 0$ tells you nothing.** At $x = 0$: $x^4$ has a minimum, $-x^4$ has a maximum, and $x^3$ has neither. All three have $f'(0) = f''(0) = 0$. Use the first derivative test.
:::

- A **local** maximum value can be smaller than a local minimum value of the same function. "Local" only compares with nearby points.
- By NCERT's definition, a local maximum or minimum is at an **interior** point. End points of $[a, b]$ are checked only for **absolute** values.
- NCERT uses "point of inflexion" for a critical point where $f'$ keeps its sign (example: $x = 1$ for $2x^3 - 6x^2 + 6x + 5$). In wider maths, the term means a point where the curve changes from bending up to bending down (beyond the syllabus).

:::remember
- $f'$: $+$ to $-$ gives a maximum; $-$ to $+$ gives a minimum.
- With $f'(c) = 0$: $f''(c) < 0$ gives a maximum (curve bends down, like a hill); $f''(c) > 0$ gives a minimum (like a valley).
:::

:::tip
For $f(x) = (x - a)^m (x - b)^n$ with $a \ne b$ and whole-number powers: at $x = a$, the factor $(x - a)^{m-1}$ in $f'$ changes sign only when $m - 1$ is odd, that is when $m$ is even. So an **even** power gives an extremum there, and an **odd** power (3 or more) gives a point of inflexion. Example: $(x - 2)^4 (x + 1)^3$ has an extremum at 2 and inflexion at $-1$. Its third critical point, $\frac27$, comes from the other factor of $f'$.
:::

## Absolute maximum and minimum

:::trap
**Do not forget the end points.** On $[1, 5]$, $f(x) = 2x^3 - 15x^2 + 36x + 1$ has its local maximum 29 at $x = 2$, but its absolute maximum is 56, at the end point $x = 5$.
:::

:::trap
**Open intervals may have no maximum or minimum.** $f(x) = x + 2$ on $(0, 1)$ has neither, and no local ones either. Only a continuous function on a **closed** interval is sure to have both.
:::

- On all of $\mathbb{R}$ with only one critical point $c$, first check with the first or second derivative test that $c$ really is a maximum or a minimum. Comparing $f(c)$ with just one other value is not enough by itself: $x^3$ has $f(1) > f(0)$, but 0 is not a minimum.
- To minimise a distance $\sqrt{g(x)}$, minimise $g(x)$ instead. The square root is increasing, so the same $x$ works.

## Word problems

- Use the condition to write everything in **one** variable. Write its allowed range and reject roots outside it. In the open box from a 3 m by 8 m sheet, $x = 3$ is a root but impossible (it is more than half of 3 m), so $x = \frac23$.
- Answer exactly what is asked: the dimensions, the point, or the maximum value.

:::tip
Results worth remembering (from NCERT exercises):
- fixed sum: product largest when the numbers are equal;
- rectangle in a circle: square;
- closed can of fixed volume, least metal: height = diameter;
- cone in a sphere of radius $R$: height $\frac{4R}{3}$, volume $\frac{8}{27}$ of the sphere;
- box from a square sheet of side $a$: cut squares of side $\frac{a}{6}$.
:::
