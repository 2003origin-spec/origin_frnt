---
title: "Inverse Trigonometric Functions: Quick Practice"
type: practice
chapter: c12.mathematics.inverse-trigonometric-functions
order: 4
---

Try each question first, then tap **Show answer**. Inverse functions take their principal values, and all angles are in radians.

## Principal values and domains

:::question{title="1. Two principal values" exam="JEE Main level"}
Find $\cos^{-1}\left(-\dfrac{\sqrt3}{2}\right) + \sin^{-1}\left(-\dfrac12\right)$.

---

$\cos^{-1}\left(-\frac{\sqrt3}{2}\right)$ must lie in $[0, \pi]$: it is $\pi - \frac{\pi}{6} = \frac{5\pi}{6}$.

$\sin^{-1}\left(-\frac12\right)$ must lie in $[-\frac{\pi}{2}, \frac{\pi}{2}]$: it is $-\frac{\pi}{6}$.

Sum $= \dfrac{5\pi}{6} - \dfrac{\pi}{6} =$ **$\dfrac{2\pi}{3}$**.
:::

:::question{title="2. sec and cot" exam="JEE Main level"}
Find $\sec^{-1}(-2) + \cot^{-1}(-\sqrt3)$.

---

$\sec y = -2$ means $\cos y = -\frac12$ with $y \in [0, \pi]$, so $y = \frac{2\pi}{3}$.

$\cot y = -\sqrt3$ with $y \in (0, \pi)$: $\cot\frac{\pi}{6} = \sqrt3$, so $y = \pi - \frac{\pi}{6} = \frac{5\pi}{6}$.

Sum $= \dfrac{2\pi}{3} + \dfrac{5\pi}{6} =$ **$\dfrac{3\pi}{2}$**.
:::

:::question{title="3. Domain" exam="JEE Main level"}
Find the domain of $f(x) = \cos^{-1}(\log_2 x)$.

---

Need $x > 0$ for the log, and $-1 \le \log_2 x \le 1$, so $2^{-1} \le x \le 2^1$.

Domain: **$\left[\dfrac12, 2\right]$**.
:::

## Function of its inverse

:::question{title="4. Outside the range" exam="JEE Main level"}
Find $\tan^{-1}\left(\tan\dfrac{2\pi}{3}\right)$.

---

$\dfrac{2\pi}{3}$ is not in $(-\frac{\pi}{2}, \frac{\pi}{2})$. Since $\tan x = \tan(x - \pi)$:

$\tan\dfrac{2\pi}{3} = \tan\left(-\dfrac{\pi}{3}\right)$, and $-\dfrac{\pi}{3}$ is in the range. Answer: **$-\dfrac{\pi}{3}$**.
:::

:::question{title="5. Radians, not degrees" exam="JEE Main level"}
Find $\sin^{-1}(\sin 10)$, where 10 is in radians.

---

$3\pi \approx 9.42$, so $10 = 3\pi + 0.58$ (roughly).

$\sin(3\pi + t) = -\sin t$, so $\sin 10 = -\sin(10 - 3\pi) = \sin(3\pi - 10)$.

$3\pi - 10 \approx -0.58$ lies in $[-\frac{\pi}{2}, \frac{\pi}{2}]$. Answer: **$3\pi - 10$**.
:::

:::question{title="6. Sign from the range" exam="JEE Main level"}
Find $\tan\left(\cos^{-1}\left(-\dfrac35\right)\right)$.

---

Let $\theta = \cos^{-1}\left(-\frac35\right)$. Then $\theta \in (\frac{\pi}{2}, \pi)$, the 2nd quadrant.

$\sin\theta = +\sqrt{1 - \frac{9}{25}} = \frac45$, so $\tan\theta = \dfrac{4/5}{-3/5} =$ **$-\dfrac43$**.
:::

## Simplifying

:::question{title="7. Half angle" exam="JEE Main level"}
Write $\tan^{-1}\left(\dfrac{1 - \cos x}{\sin x}\right)$, $0 < x < \pi$, in the simplest form.

---

$\dfrac{1 - \cos x}{\sin x} = \dfrac{2\sin^2\frac{x}{2}}{2\sin\frac{x}{2}\cos\frac{x}{2}} = \tan\dfrac{x}{2}$.

For $0 < x < \pi$, $\frac{x}{2} \in (0, \frac{\pi}{2})$, inside the principal range. Answer: **$\dfrac{x}{2}$**.
:::

## Properties (exam extra)

:::question{title="8. Complementary pair" exam="JEE Main level"}
Solve $\sin^{-1}x - \cos^{-1}x = \dfrac{\pi}{6}$.

---

Put $\cos^{-1}x = \dfrac{\pi}{2} - \sin^{-1}x$: then $2\sin^{-1}x - \dfrac{\pi}{2} = \dfrac{\pi}{6}$, so $\sin^{-1}x = \dfrac{\pi}{3}$.

$x =$ **$\dfrac{\sqrt3}{2}$**. Check: $\dfrac{\pi}{3} - \dfrac{\pi}{6} = \dfrac{\pi}{6}$.
:::

:::question{title="9. When xy > 1" exam="JEE Main level"}
Find $\tan^{-1}2 + \tan^{-1}3$.

---

$xy = 6 > 1$, so the plain formula does not apply. $\dfrac{x + y}{1 - xy} = \dfrac{5}{-5} = -1$, and $\tan^{-1}(-1) = -\dfrac{\pi}{4}$.

Here $xy > 1$ with $x, y > 0$, so add $\pi$: the sum is **$\dfrac{3\pi}{4}$**. (Each angle is between $\frac{\pi}{4}$ and $\frac{\pi}{2}$, so the sum is between $\frac{\pi}{2}$ and $\pi$.)
:::

:::question{title="10. Check the roots" exam="JEE Main level"}
Solve $\tan^{-1}(2x) + \tan^{-1}(3x) = \dfrac{\pi}{4}$.

---

Take $\tan$ of both sides: $\dfrac{2x + 3x}{1 - 6x^2} = 1$, so $6x^2 + 5x - 1 = 0$, that is $(6x - 1)(x + 1) = 0$.

$x = -1$ gives $\tan^{-1}(-2) + \tan^{-1}(-3) = -\dfrac{3\pi}{4}$, not $\dfrac{\pi}{4}$. Reject it.

$x = \dfrac16$: the product $\dfrac13 \cdot \dfrac12 = \dfrac16$ is less than 1, and $\tan^{-1}\dfrac13 + \tan^{-1}\dfrac12 = \tan^{-1}1 = \dfrac{\pi}{4}$. So **$x = \dfrac16$** only.
:::
