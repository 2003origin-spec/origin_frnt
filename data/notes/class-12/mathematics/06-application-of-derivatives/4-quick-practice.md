---
title: "Application of Derivatives: Quick Practice"
type: practice
chapter: c12.mathematics.application-of-derivatives
order: 4
---

Try each question first, then tap **Show answer**.

## Rate of change

:::question{title="1. Balloon surface" exam="JEE Main level"}
The radius of a spherical balloon increases at 0.5 cm/s. How fast is its surface area increasing when the radius is 6 cm?

---

$S = 4\pi r^2$, so $\dfrac{dS}{dt} = 8\pi r\,\dfrac{dr}{dt} = 8\pi(6)(0.5) =$ **$24\pi$ cm²/s**.
:::

:::question{title="2. Filling a cone" exam="JEE Main level"}
Water flows at $8\pi$ cm³/s into a conical tank, vertex down, axis vertical, with semi-vertical angle 45°. How fast is the water level rising when the depth is 4 cm?

---

At 45°, the water surface radius equals the depth: $r = h$. So $V = \dfrac13\pi h^3$ and $\dfrac{dV}{dt} = \pi h^2\,\dfrac{dh}{dt}$.

$8\pi = \pi(16)\,\dfrac{dh}{dt}$, so $\dfrac{dh}{dt} =$ **0.5 cm/s**.
:::

:::question{title="3. Sliding ladder" exam="JEE Main level"}
A 13 m ladder leans against a vertical wall. Its foot is pulled away from the wall at 0.5 m/s. How fast is the top sliding down when the foot is 5 m from the wall?

---

$x^2 + y^2 = 169$. At $x = 5$, $y = 12$. Differentiating: $x\,\dfrac{dx}{dt} + y\,\dfrac{dy}{dt} = 0$.

$\dfrac{dy}{dt} = -\dfrac{5 \times 0.5}{12} = -\dfrac{5}{24}$. The top slides down at **$\dfrac{5}{24}$ m/s** (about 0.21 m/s).
:::

:::question{title="4. Marginal cost" exam="JEE Main level"}
The total cost of producing $x$ units is $C(x) = 0.01x^3 - 0.3x^2 + 15x + 1000$ rupees. Find the marginal cost when 20 units are produced.

---

$MC = C'(x) = 0.03x^2 - 0.6x + 15$.

At $x = 20$: $0.03(400) - 0.6(20) + 15 = 12 - 12 + 15 =$ **₹15**.
:::

## Increasing and decreasing

:::question{title="5. Intervals" exam="JEE Main level"}
Find the intervals on which $f(x) = x^3 - 6x^2 + 9x + 2$ is strictly increasing and strictly decreasing.

---

$f'(x) = 3x^2 - 12x + 9 = 3(x - 1)(x - 3)$.

$f' > 0$ for $x < 1$ and $x > 3$; $f' < 0$ for $1 < x < 3$.

**Strictly increasing on $(-\infty, 1)$ and $(3, \infty)$; strictly decreasing on $(1, 3)$.** (The end points 1 and 3 may also be included.)
:::

:::question{title="6. Increasing everywhere" exam="JEE Main level"}
Find all real $a$ for which $f(x) = x^3 + ax^2 + 3x + 5$ is increasing on $\mathbb{R}$.

---

$f'(x) = 3x^2 + 2ax + 3$. This must be $\ge 0$ for all $x$. The leading coefficient 3 is positive, so we need discriminant $\le 0$:

$4a^2 - 36 \le 0$, so $a^2 \le 9$.

**$-3 \le a \le 3$.** At $a = \pm 3$, $f'(x) = 3(x \pm 1)^2$ is zero at only one point, so $f$ is still (strictly) increasing.
:::

:::question{title="7. A trigonometric function" exam="JEE Main level"}
On $[0, 2\pi]$, where is $f(x) = x - 2\sin x$ increasing?

---

$f'(x) = 1 - 2\cos x > 0$ when $\cos x < \dfrac12$.

In $[0, 2\pi]$ that is $\dfrac{\pi}{3} < x < \dfrac{5\pi}{3}$. So $f$ is **increasing on $\left(\dfrac{\pi}{3}, \dfrac{5\pi}{3}\right)$** and decreasing on $\left[0, \dfrac{\pi}{3}\right)$ and $\left(\dfrac{5\pi}{3}, 2\pi\right]$. (Since $f$ is continuous, the end points $\dfrac{\pi}{3}$ and $\dfrac{5\pi}{3}$ may also be included.)
:::

## Maxima and minima

:::question{title="8. Local extremes" exam="JEE Main level"}
Find the local maximum and local minimum values of $f(x) = x^4 - 8x^2 + 3$.

---

$f'(x) = 4x^3 - 16x = 4x(x - 2)(x + 2)$, so $x = 0, \pm 2$. Also $f''(x) = 12x^2 - 16$.

$f''(0) = -16 < 0$: local maximum $f(0) = 3$. $f''(\pm 2) = 32 > 0$: local minimum $f(\pm 2) = 16 - 32 + 3 = -13$.

**Local maximum value 3; local minimum value −13** (at $x = 2$ and $x = -2$).
:::

:::question{title="9. Closed interval" exam="JEE Main level"}
Find the absolute maximum and minimum values of $f(x) = x^3 - 3x^2 - 9x + 5$ on $[-2, 4]$.

---

$f'(x) = 3(x - 3)(x + 1)$, so the critical points are $x = -1$ and $x = 3$.

$f(-2) = 3$, $f(-1) = 10$, $f(3) = -22$, $f(4) = -15$.

**Absolute maximum 10 at $x = -1$; absolute minimum −22 at $x = 3$.**
:::

:::question{title="10. Open box" exam="JEE Main level"}
Equal squares of side $x$ cm are cut from the corners of a 16 cm by 10 cm sheet, and the sides are folded up to make an open box. Find the largest possible volume.

---

$V = x(16 - 2x)(10 - 2x) = 4x^3 - 52x^2 + 160x$, with $0 < x < 5$.

$V'(x) = 12x^2 - 104x + 160 = 4(3x - 20)(x - 2)$. $x = \dfrac{20}{3}$ is more than 5, so reject it. Take $x = 2$.

$V''(x) = 24x - 104$, and $V''(2) = -56 < 0$, so it is a maximum. $V(2) = 2 \times 12 \times 6 =$ **144 cm³**.
:::
