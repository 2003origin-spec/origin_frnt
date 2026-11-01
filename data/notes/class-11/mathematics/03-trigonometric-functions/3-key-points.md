---
title: "Trigonometric Functions: Important Points and Traps"
type: key_points
chapter: c11.mathematics.trigonometric-functions
order: 3
---

## Radians and degrees

:::trap
No degree sign means **radians**. $\sin 1$ is the sine of 1 radian (about $57^\circ$), so $\sin 1 \approx 0.84$, not $\sin 1^\circ \approx 0.017$.
:::

:::trap
$l = r\theta$ only works with $\theta$ in **radians**. Convert degrees first: $60^\circ = \frac{\pi}{3}$.
:::

- $1$ radian $\approx 57^\circ 16'$, a little less than $60^\circ$. So $\sin 1 > \sin 1^\circ$, and $\cos 1 < \cos 1^\circ$.
- A clock's minute hand turns $6^\circ$ per minute; the hour hand turns $\frac12^\circ$ per minute.

## Signs and quadrants

:::tip
**"All Silver Tea Cups"** (a memory aid, not in NCERT): **A**ll positive in I, **S**in in II, **T**an in III, **C**os in IV. Each function's reciprocal has the same sign.
:::

:::trap
After a square root, you get $\pm$. Always choose the sign from the **quadrant**. Writing $\sin x = \frac45$ when $x$ is in quadrant III is a very common slip.
:::

:::trap
For half angles, the sign comes from the quadrant of $\frac{x}{2}$, **not** of $x$. If $\pi < x < \frac{3\pi}{2}$, then $\frac{\pi}{2} < \frac{x}{2} < \frac{3\pi}{4}$: $\sin\frac{x}{2} > 0$ but $\cos\frac{x}{2} < 0$.
:::

## Allied angles

:::remember
- $\frac{\pi}{2}$ or $\frac{3\pi}{2}$ in the angle: the function **changes** (sin ↔ cos, tan ↔ cot, sec ↔ cosec).
- $\pi$ or $2\pi$ in the angle: the function **stays**.
- Sign: the sign of the **original** function in the quadrant of the angle, with $x$ treated as acute.
:::

- To reduce a big angle, first remove whole turns: subtract (or add) multiples of $360^\circ$ for sin and cos, or multiples of $180^\circ$ for tan and cot.
- $\cos(-x) = \cos x$, but $\sin(-x) = -\sin x$ and $\tan(-x) = -\tan x$.

## Domain, range and period

:::remember
- $-1 \le \sin x \le 1$ and $-1 \le \cos x \le 1$ for all real $x$.
- $\sec x$ and $\operatorname{cosec} x$ are never strictly between $-1$ and $1$.
- $\tan x$ and $\cot x$ take every real value.
- Periods: $2\pi$ for sin, cos, sec, cosec; $\pi$ for tan, cot.
:::

:::trap
$\tan x$ is not defined at odd multiples of $\frac{\pi}{2}$, and $\cot x$ is not defined at multiples of $\pi$. Check this before using any $\tan$ or $\cot$ identity.
:::

- (Exam extra) $\sin^2 x$, $\cos^2 x$, $\lvert\sin x\rvert$ and $\lvert\cos x\rvert$ all have period $\pi$, not $2\pi$.

## Sum, difference and multiple angles

:::trap
$\sin(x + y) \ne \sin x + \sin y$, and $\sin 2x \ne 2\sin x$. Check with $x = y = \frac{\pi}{2}$: $\sin\pi = 0$, but $\sin\frac{\pi}{2} + \sin\frac{\pi}{2} = 2$.
:::

:::trap
Watch the signs: $\cos(x + y)$ has a **minus** in the middle, and $\cos(x - y)$ has a **plus**. Sine keeps the same sign as the angle.
:::

- $\tan(x + y)$ needs none of $x$, $y$, $x + y$ to be an odd multiple of $\frac{\pi}{2}$. $\cot(x + y)$ needs none of them to be a multiple of $\pi$.
- (Exam extra) If $x + y = \frac{\pi}{4}$ and $\tan x$, $\tan y$ are defined, then $(1 + \tan x)(1 + \tan y) = 2$. (Expand $\tan(x + y) = 1$.)
- $\tan x\tan y = 1$ when $x + y = \frac{\pi}{2}$ (both defined), because $\tan y = \cot x$.

:::tip
Pick the $\cos 2x$ form that fits:
- Know $\cos x$: use $2\cos^2 x - 1$.
- Know $\sin x$: use $1 - 2\sin^2 x$.
- Know $\tan x$: use $\dfrac{1 - \tan^2 x}{1 + \tan^2 x}$.
:::

## Sum to product

:::trap
$\cos x - \cos y = -2\sin\frac{x+y}{2}\sin\frac{x-y}{2}$. The **minus sign** is easy to forget.

$\sin x - \sin y = 2\cos\frac{x+y}{2}\sin\frac{x-y}{2}$: here **cos comes first**.
:::

:::tip
Pair the terms so the half-sums match. In $\sin 5x - 2\sin 3x + \sin x$, pair $\sin 5x + \sin x = 2\sin 3x\cos 2x$, so the whole thing becomes $2\sin 3x(\cos 2x - 1)$.
:::

## Standard values worth knowing

:::remember
- $\sin 15^\circ = \dfrac{\sqrt3 - 1}{2\sqrt2}$ and $\cos 15^\circ = \dfrac{\sqrt3 + 1}{2\sqrt2}$
- $\tan 15^\circ = 2 - \sqrt3$ and $\tan 75^\circ = 2 + \sqrt3$
- $\tan 22\tfrac12^\circ = \sqrt2 - 1$ (NCERT Example 20)
- (Exam extra) $\sin 18^\circ = \dfrac{\sqrt5 - 1}{4}$ and $\cos 36^\circ = \dfrac{\sqrt5 + 1}{4}$
:::

## Exam extras (not in NCERT)

- $a\sin x + b\cos x$ lies between $-\sqrt{a^2 + b^2}$ and $\sqrt{a^2 + b^2}$. So $3\sin x + 4\cos x$ ranges over $[-5, 5]$.
- If $A + B + C = \pi$ (none of them an odd multiple of $\frac{\pi}{2}$), then $\tan A + \tan B + \tan C = \tan A\tan B\tan C$.
- $\cos x\cos 2x\cos 4x = \dfrac{\sin 8x}{8\sin x}$ when $\sin x \ne 0$. Multiply and divide by $2\sin x$ and use $\sin 2\theta$ again and again.
- $\sin x\sin(60^\circ - x)\sin(60^\circ + x) = \frac14\sin 3x$, and $\cos x\cos(60^\circ - x)\cos(60^\circ + x) = \frac14\cos 3x$.
