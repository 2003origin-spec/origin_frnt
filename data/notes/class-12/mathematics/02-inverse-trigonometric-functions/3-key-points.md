---
title: "Inverse Trigonometric Functions: Important Points and Traps"
type: key_points
chapter: c12.mathematics.inverse-trigonometric-functions
order: 3
---

## Principal ranges

:::remember
- $\sin^{-1}$: $[-\pi/2, \pi/2]$. $\tan^{-1}$: $(-\pi/2, \pi/2)$. $\operatorname{cosec}^{-1}$: $[-\pi/2, \pi/2] - \{0\}$.
- $\cos^{-1}$: $[0, \pi]$. $\cot^{-1}$: $(0, \pi)$. $\sec^{-1}$: $[0, \pi] - \{\pi/2\}$.
- When no branch is mentioned, NCERT means the principal value branch.
:::

:::tip
Two groups of three:
- **sin, tan, cosec**: range around 0, from $-\pi/2$ to $\pi/2$.
- **cos, cot, sec**: range from 0 to $\pi$.

sin, tan and cosec are odd functions, so a negative input needs a negative angle. That is why their range sits around 0.
:::

:::trap
**Negative inputs to $\cos^{-1}$, $\cot^{-1}$, $\sec^{-1}$ give angles in $(\pi/2, \pi]$, never negative angles.**

$\cos^{-1}\left(-\frac12\right) = \dfrac{2\pi}{3}$, not $-\dfrac{\pi}{3}$. $\cot^{-1}(-1) = \dfrac{3\pi}{4}$, not $-\dfrac{\pi}{4}$. $\sec^{-1}(-2) = \dfrac{2\pi}{3}$.
:::

:::trap
**$\sin^{-1}x$ is not $\dfrac{1}{\sin x}$.** The $-1$ means "inverse function". $(\sin x)^{-1} = \dfrac{1}{\sin x} = \operatorname{cosec}x$.
:::

## Domains

- $\sin^{-1}x$ and $\cos^{-1}x$ need $-1 \le x \le 1$. So $\sin^{-1}2$ does not exist.
- $\sec^{-1}x$ and $\operatorname{cosec}^{-1}x$ need $|x| \ge 1$. So $\sec^{-1}\frac12$ does not exist.
- $\tan^{-1}x$ and $\cot^{-1}x$ accept every real $x$.

:::trap
$\mathbf{R} - (-1, 1)$ (round brackets) removes the whole open interval, leaving $|x| \ge 1$. $\mathbf{R} - \{-1, 1\}$ (curly brackets) would remove only the two points $\pm 1$. One line on page 23 of NCERT prints the second form for the secant; it looks like a printing slip, since NCERT's table and summary give $\mathbf{R} - (-1, 1)$. Use $\mathbf{R} - (-1, 1)$.
:::

:::trap
For a domain question like $\sin^{-1}(f(x))$, solve $-1 \le f(x) \le 1$ **and** keep any condition $f(x)$ itself needs (a log needs a positive argument, a root a non-negative one).
:::

## f(f⁻¹(x)) and f⁻¹(f(x))

:::remember
- $\sin(\sin^{-1}x) = x$ for **all** $x \in [-1, 1]$.
- $\sin^{-1}(\sin x) = x$ **only** for $x \in [-\pi/2, \pi/2]$.
:::

:::trap
$\sin^{-1}\left(\sin\dfrac{2\pi}{3}\right)$ is **not** $\dfrac{2\pi}{3}$. Since $\sin\dfrac{2\pi}{3} = \sin\dfrac{\pi}{3}$, the answer is $\dfrac{\pi}{3}$.

$\cos^{-1}\left(\cos\dfrac{7\pi}{6}\right) = \dfrac{5\pi}{6}$ (use $\cos x = \cos(2\pi - x)$).

$\tan^{-1}\left(\tan\dfrac{3\pi}{4}\right) = -\dfrac{\pi}{4}$ (use $\tan x = \tan(x - \pi)$).
:::

:::tip
For $\sin^{-1}(\sin x)$ with $x$ in radians (like $\sin^{-1}(\sin 4)$), use $\pi \approx 3.14$ to see where $x$ is. Here $4 \in (\pi/2, 3\pi/2)$, so the answer is $\pi - 4$.
:::

## Substitutions

:::trap
After a substitution, **check the interval of $\theta$**. NCERT Example 3: $\sin^{-1}(2x\sqrt{1 - x^2})$ is $2\sin^{-1}x$ only for $|x| \le \frac{1}{\sqrt2}$. For $\frac{1}{\sqrt2} \le x \le 1$, it is $2\cos^{-1}x$, because $2\theta$ has left $[-\pi/2, \pi/2]$.
:::

- The given restriction on $x$ (like $0 < x < \pi$ or $|x| < a$) is a hint: it tells you which branch the answer is on.
- In a right triangle with angle $\theta = \tan^{-1}x$ ($x > 0$): opposite $= x$, adjacent $= 1$, hypotenuse $= \sqrt{1 + x^2}$. Read off any other ratio.

:::trap
The triangle gives the size; the **range gives the sign**. $\theta = \cos^{-1}\left(-\frac35\right)$ is in the 2nd quadrant, so $\sin\theta = \frac45$ but $\tan\theta = -\frac43$.
:::

## Exam extras (JEE Main syllabus, not stated in the current NCERT)

:::remember
- $\sin^{-1}x + \cos^{-1}x = \dfrac{\pi}{2}$ for $x \in [-1, 1]$.
- $\tan^{-1}x + \cot^{-1}x = \dfrac{\pi}{2}$ for all real $x$.
- $\sin^{-1}(-x) = -\sin^{-1}x$, but $\cos^{-1}(-x) = \pi - \cos^{-1}x$.
:::

:::trap
**$\tan^{-1}x + \tan^{-1}y = \tan^{-1}\dfrac{x + y}{1 - xy}$ needs $xy < 1$.**

$\tan^{-1}\sqrt3 + \tan^{-1}\sqrt3$: here $xy = 3 > 1$, and the formula gives $\tan^{-1}(-\sqrt3) = -\dfrac{\pi}{3}$, which is wrong. Both angles are positive, so add $\pi$: the answer is $\dfrac{2\pi}{3}$ (check: $\dfrac{\pi}{3} + \dfrac{\pi}{3}$).
:::

:::trap
$\tan^{-1}\dfrac1x = \cot^{-1}x$ only for $x > 0$. For $x < 0$, $\tan^{-1}\dfrac1x$ is negative but $\cot^{-1}x$ is in $(\pi/2, \pi)$; they differ by $\pi$.
:::

:::trap
When you solve an equation with inverse functions, the algebra can create extra roots. **Put every root back** into the original equation. Taking $\tan$ of $2\tan^{-1}x = \dfrac{\pi}{4}$ gives $x^2 + 2x - 1 = 0$, so $x = -1 \pm \sqrt2$. But at $x = -1 - \sqrt2$ the left side is negative, so only $x = \sqrt2 - 1$ works.
:::

:::tip
$\sin^{-1}x + \cos^{-1}x = \dfrac{\pi}{2}$ turns two unknown angles into one. If an equation has both, replace $\cos^{-1}x$ by $\dfrac{\pi}{2} - \sin^{-1}x$ first.
:::
