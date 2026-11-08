---
title: "Application of Derivatives: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.application-of-derivatives
order: 1
---

The current NCERT chapter has three parts: rate of change, increasing and decreasing functions, and maxima and minima. Tangents, normals and approximations were removed from the book and are not in the JEE Main 2026 syllabus.

## Rate of change

:::formula{title="Rate of change at a point"}
$$\left.\frac{dy}{dx}\right|_{x = x_0} = f'(x_0)$$
The rate of change of $y = f(x)$ with respect to $x$, at $x = x_0$. Its unit is (unit of $y$) per (unit of $x$).
:::

:::formula{title="Both quantities depend on t"}
If $x = f(t)$ and $y = g(t)$:
$$\frac{dy}{dx} = \frac{dy/dt}{dx/dt}$$
Only when $\dfrac{dx}{dt} \ne 0$.
:::

:::formula{title="Related rates (chain rule)"}
$$\frac{dA}{dt} = \frac{dA}{dr} \cdot \frac{dr}{dt}$$
Write the relation between the quantities first, then differentiate with respect to time $t$. Put in the numbers only **after** differentiating.
:::

:::formula{title="Common shapes"}
Circle, radius $r$:
$$\frac{dA}{dt} = 2\pi r\,\frac{dr}{dt}$$
Sphere, volume $V = \frac43\pi r^3$:
$$\frac{dV}{dt} = 4\pi r^2\,\frac{dr}{dt}$$
Sphere, surface $S = 4\pi r^2$:
$$\frac{dS}{dt} = 8\pi r\,\frac{dr}{dt}$$
Cube, edge $x$, $V = x^3$, $S = 6x^2$:
$$\frac{dV}{dt} = 3x^2\,\frac{dx}{dt}$$
$$\frac{dS}{dt} = 12x\,\frac{dx}{dt}$$
Cone: $V = \frac13\pi r^2 h$. Link $r$ and $h$ (similar triangles) **before** differentiating.
:::

:::formula{title="Marginal cost and marginal revenue"}
$$MC = \frac{dC}{dx}$$
$$MR = \frac{dR}{dx}$$
$C(x)$ = total cost and $R(x)$ = total revenue (in rupees) for $x$ units. Profit $P(x) = R(x) - C(x)$.
:::

## Increasing and decreasing functions

:::formula{title="Derivative test (NCERT Theorem 1)"}
Let $f$ be continuous on $[a, b]$ and differentiable on $(a, b)$.
- $f'(x) \ge 0$ for each $x \in (a, b)$: $f$ is **increasing** on $[a, b]$.
- $f'(x) \le 0$ for each $x \in (a, b)$: $f$ is **decreasing** on $[a, b]$.
- $f'(x) = 0$ for each $x \in (a, b)$: $f$ is **constant** on $[a, b]$.

$f'(x) > 0$ on $(a, b)$ gives **strictly** increasing; $f'(x) < 0$ gives strictly decreasing.
:::

:::formula{title="Definitions NCERT uses"}
For all $x_1 < x_2$ in the interval I:
- increasing: $f(x_1) \le f(x_2)$
- strictly increasing: $f(x_1) < f(x_2)$
- decreasing: $f(x_1) \ge f(x_2)$
- strictly decreasing: $f(x_1) > f(x_2)$
:::

## Maxima and minima

:::formula{title="Critical point"}
$c$ is a critical point of $f$ if
$$f'(c) = 0$$
**or** $f$ is not differentiable at $c$ ($c$ in the domain of $f$). A local maximum or minimum inside an open interval can only happen at a critical point.
:::

:::formula{title="First derivative test"}
$f$ continuous at a critical point $c$. As $x$ increases through $c$:
- $f'$ changes from $+$ to $-$: **local maximum** at $c$.
- $f'$ changes from $-$ to $+$: **local minimum** at $c$.
- $f'$ does not change sign: neither. NCERT calls $c$ a **point of inflexion**.

Works even where $f$ is not differentiable at $c$ (for example $|x|$ at 0).
:::

:::formula{title="Second derivative test"}
$f$ twice differentiable at $c$, and $f'(c) = 0$:
- $f''(c) < 0$: local maximum, value $f(c)$.
- $f''(c) > 0$: local minimum, value $f(c)$.
- $f''(c) = 0$: the test **fails**. Go back to the first derivative test.
:::

:::formula{title="Absolute max and min on [a, b]"}
For $f$ continuous on $[a, b]$:
1. Find all critical points in $(a, b)$.
2. Add the end points $a$ and $b$.
3. Find $f$ at all these points.
4. The largest value is the absolute maximum; the smallest is the absolute minimum.

A continuous function on a **closed** interval always has both. On an open interval it may have neither.
:::

## Standard results (NCERT examples and exercises)

:::formula{title="Fixed sum"}
Two positive numbers with sum $k$: their sum of squares is least, and their product is largest, when both equal $\dfrac{k}{2}$.
:::

:::formula{title="Open box from a square sheet"}
Square sheet of side $a$, equal squares of side $x$ cut from the corners:
$$V = x\,(a - 2x)^2$$
Maximum at $x = \dfrac{a}{6}$, with $V_{max} = \dfrac{2a^3}{27}$. Here $0 < x < \dfrac{a}{2}$.
:::

:::formula{title="Shapes inside a circle or sphere"}
- Rectangle in a fixed circle: largest area for a **square**.
- Cone in a sphere of radius $R$: largest volume when the height is $\dfrac{4R}{3}$; that volume is $\dfrac{8}{27}$ of the sphere's volume.
- Cylinder in a sphere of radius $R$: largest volume when the height is $\dfrac{2R}{\sqrt3}$.
:::

:::formula{title="Cylinders and cones"}
- Closed cylinder, fixed volume, least total surface: $h = 2r$ (height = diameter). The same shape gives the largest volume for a fixed total surface.
- Cylinder in a cone of height $h$: largest volume when its height is $\dfrac{h}{3}$. Largest curved surface when its radius is half the cone's radius.
- Cone of fixed slant height, largest volume: semi-vertical angle $\tan^{-1}\sqrt2$.
- Cone of fixed volume, least curved surface: height $= \sqrt2 \times$ radius.
- Cone of fixed total surface, largest volume: semi-vertical angle $\sin^{-1}\dfrac13$.
:::

## Exam extras

:::formula{title="Isolated zeros of f′ (exam extra)"}
If $f'(x) \ge 0$ on an interval and $f'(x) = 0$ only at isolated points, $f$ is still **strictly** increasing there. Example: $x^3$ on $\mathbb{R}$. Not stated in NCERT.
:::

:::formula{title="Range of a sin x + b cos x (exam extra)"}
$$-\sqrt{a^2 + b^2} \le a\sin x + b\cos x$$
$$a\sin x + b\cos x \le \sqrt{a^2 + b^2}$$
For real $a, b$ and all real $x$. NCERT's exercises use only $\sin x + \cos x$ and $\sin x - \cos x$, whose maximum is $\sqrt2$.
:::
