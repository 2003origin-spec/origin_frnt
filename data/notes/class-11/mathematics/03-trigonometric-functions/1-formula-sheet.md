---
title: "Trigonometric Functions: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.trigonometric-functions
order: 1
---

Notation as in NCERT: $\theta^\circ$ means degrees; an angle written with no degree sign (like $x$ or $\frac{\pi}{4}$) is in **radians**. $n$ is any integer.

## Measuring angles

:::formula{title="Degree units"}
$$1^\circ = 60'$$
$$1' = 60''$$
One degree is $\frac{1}{360}$ of a full revolution.
:::

:::formula{title="Degrees and radians"}
$$\pi \text{ radian} = 180^\circ$$
$$\text{radians} = \frac{\pi}{180} \times \text{degrees}$$
$$\text{degrees} = \frac{180}{\pi} \times \text{radians}$$
$1$ radian $\approx 57^\circ 16'$ and $1^\circ \approx 0.01746$ radian (using $\pi = \frac{22}{7}$).
:::

:::formula{title="Arc length"}
$$l = r\,\theta$$
$l$ = arc length, $r$ = radius ($l$ and $r$ in the same unit), $\theta$ = angle at the centre **in radians**.
:::

## Basic identities

:::formula{title="Reciprocal and quotient relations"}
$$\operatorname{cosec} x = \frac{1}{\sin x}$$
$$\sec x = \frac{1}{\cos x}$$
$$\tan x = \frac{\sin x}{\cos x}$$
$$\cot x = \frac{\cos x}{\sin x}$$
cosec and cot need $x \ne n\pi$. sec and tan need $x \ne (2n+1)\frac{\pi}{2}$.
:::

:::formula{title="Pythagorean identities"}
$$\sin^2 x + \cos^2 x = 1$$
$$1 + \tan^2 x = \sec^2 x$$
$$1 + \cot^2 x = \operatorname{cosec}^2 x$$
The first holds for all real $x$; the other two wherever $\tan x$ (or $\cot x$) is defined.
:::

:::formula{title="Zeros of sine and cosine"}
$$\sin x = 0 \iff x = n\pi$$
$$\cos x = 0 \iff x = (2n+1)\frac{\pi}{2}$$
:::

:::formula{title="Negative angles"}
$$\sin(-x) = -\sin x$$
$$\cos(-x) = \cos x$$
$$\tan(-x) = -\tan x$$
:::

:::formula{title="Periodicity"}
$$\sin(2n\pi + x) = \sin x$$
$$\cos(2n\pi + x) = \cos x$$
$$\tan(n\pi + x) = \tan x$$
Period $2\pi$: sin, cos, cosec, sec. Period $\pi$: tan, cot.
:::

## Allied angles

| Angle | sin | cos | tan |
|---|---|---|---|
| $\frac{\pi}{2} - x$ | $\cos x$ | $\sin x$ | $\cot x$ |
| $\frac{\pi}{2} + x$ | $\cos x$ | $-\sin x$ | $-\cot x$ |
| $\pi - x$ | $\sin x$ | $-\cos x$ | $-\tan x$ |
| $\pi + x$ | $-\sin x$ | $-\cos x$ | $\tan x$ |
| $\frac{3\pi}{2} - x$ | $-\cos x$ | $-\sin x$ | $\cot x$ |
| $\frac{3\pi}{2} + x$ | $-\cos x$ | $\sin x$ | $-\cot x$ |
| $2\pi - x$ | $-\sin x$ | $\cos x$ | $-\tan x$ |

These hold for every $x$ where both sides are defined.

## Sum and difference

:::formula{title="Sine and cosine"}
$$\sin(x + y) = \sin x\cos y + \cos x\sin y$$
$$\sin(x - y) = \sin x\cos y - \cos x\sin y$$
$$\cos(x + y) = \cos x\cos y - \sin x\sin y$$
$$\cos(x - y) = \cos x\cos y + \sin x\sin y$$
True for all real $x$, $y$.
:::

:::formula{title="Tangent"}
$$\tan(x + y) = \frac{\tan x + \tan y}{1 - \tan x\tan y}$$
$$\tan(x - y) = \frac{\tan x - \tan y}{1 + \tan x\tan y}$$
Only when none of $x$, $y$, $x \pm y$ is an odd multiple of $\frac{\pi}{2}$.
:::

:::formula{title="Cotangent"}
$$\cot(x + y) = \frac{\cot x\cot y - 1}{\cot y + \cot x}$$
$$\cot(x - y) = \frac{\cot x\cot y + 1}{\cot y - \cot x}$$
Only when none of $x$, $y$, $x \pm y$ is a multiple of $\pi$.
:::

## Multiple angles

:::formula{title="sin 2x"}
$$\sin 2x = 2\sin x\cos x$$
$$\sin 2x = \frac{2\tan x}{1 + \tan^2 x}$$
The $\tan$ form needs $x \ne n\pi + \frac{\pi}{2}$.
:::

:::formula{title="cos 2x"}
$$\cos 2x = \cos^2 x - \sin^2 x$$
$$\cos 2x = 2\cos^2 x - 1$$
$$\cos 2x = 1 - 2\sin^2 x$$
$$\cos 2x = \frac{1 - \tan^2 x}{1 + \tan^2 x}$$
The $\tan$ form needs $x \ne n\pi + \frac{\pi}{2}$.
:::

:::formula{title="tan 2x"}
$$\tan 2x = \frac{2\tan x}{1 - \tan^2 x}$$
Needs $x$ and $2x$ both not odd multiples of $\frac{\pi}{2}$.
:::

:::formula{title="Half-angle forms (from cos 2x)"}
$$2\sin^2\frac{x}{2} = 1 - \cos x$$
$$2\cos^2\frac{x}{2} = 1 + \cos x$$
$$\tan\frac{x}{2} = \frac{\sin x}{1 + \cos x}$$
Take the sign of $\sin\frac{x}{2}$ or $\cos\frac{x}{2}$ from the quadrant of $\frac{x}{2}$, not of $x$. The $\tan$ form is not printed in NCERT; it follows from $\sin x = 2\sin\frac{x}{2}\cos\frac{x}{2}$ and the second line, and needs $\cos x \ne -1$.
:::

:::formula{title="Triple angles"}
$$\sin 3x = 3\sin x - 4\sin^3 x$$
$$\cos 3x = 4\cos^3 x - 3\cos x$$
$$\tan 3x = \frac{3\tan x - \tan^3 x}{1 - 3\tan^2 x}$$
The $\tan$ form needs $3x \ne n\pi + \frac{\pi}{2}$.
:::

## Sum to product

:::formula{title="Sums and differences into products"}
$$\cos x + \cos y = 2\cos\frac{x+y}{2}\cos\frac{x-y}{2}$$
$$\cos x - \cos y = -2\sin\frac{x+y}{2}\sin\frac{x-y}{2}$$
$$\sin x + \sin y = 2\sin\frac{x+y}{2}\cos\frac{x-y}{2}$$
$$\sin x - \sin y = 2\cos\frac{x+y}{2}\sin\frac{x-y}{2}$$
:::

## Product to sum

:::formula{title="Products into sums"}
$$2\cos x\cos y = \cos(x+y) + \cos(x-y)$$
$$-2\sin x\sin y = \cos(x+y) - \cos(x-y)$$
$$2\sin x\cos y = \sin(x+y) + \sin(x-y)$$
$$2\cos x\sin y = \sin(x+y) - \sin(x-y)$$
:::

## Exam extras (in the JEE Main syllabus, not in NCERT)

:::formula{title="Range of a sin x + b cos x"}
$$\lvert a\sin x + b\cos x\rvert \le \sqrt{a^2+b^2}$$
For real $a$, $b$ (not both zero). Both $\sqrt{a^2+b^2}$ (maximum) and $-\sqrt{a^2+b^2}$ (minimum) are reached.
:::

:::formula{title="Useful products"}
$$\sin(x+y)\sin(x-y) = \sin^2 x - \sin^2 y$$
$$\cos(x+y)\cos(x-y) = \cos^2 x - \sin^2 y$$
:::

## Beyond the syllabus

Solving trigonometric equations was removed from the current NCERT book, and the JEE Main 2026 syllabus does not name it. These three lines are kept only as a small aid for counting angles.

:::formula{title="General solutions"}
$\sin x = \sin\alpha$ exactly when
$$x = n\pi + (-1)^n\alpha$$
$\cos x = \cos\alpha$ exactly when
$$x = 2n\pi \pm \alpha$$
$\tan x = \tan\alpha$ exactly when
$$x = n\pi + \alpha$$
$n$ is any integer. For $\tan$, $\alpha$ must not be an odd multiple of $\frac{\pi}{2}$.
:::
