---
title: "Inverse Trigonometric Functions: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.inverse-trigonometric-functions
order: 1
---

## Principal value branches (NCERT table)

| Function | Domain | Range (principal branch) |
|---|---|---|
| $\sin^{-1}x$ | $[-1, 1]$ | $[-\pi/2, \pi/2]$ |
| $\cos^{-1}x$ | $[-1, 1]$ | $[0, \pi]$ |
| $\operatorname{cosec}^{-1}x$ | $\mathbf{R} - (-1, 1)$ | $[-\pi/2, \pi/2] - \{0\}$ |
| $\sec^{-1}x$ | $\mathbf{R} - (-1, 1)$ | $[0, \pi] - \{\pi/2\}$ |
| $\tan^{-1}x$ | $\mathbf{R}$ | $(-\pi/2, \pi/2)$ |
| $\cot^{-1}x$ | $\mathbf{R}$ | $(0, \pi)$ |

All angles are in radians. When no branch is named, the principal branch is meant.

:::remember
$\mathbf{R} - (-1, 1)$ means every real number except those strictly between $-1$ and $1$, so $|x| \ge 1$ ($\pm 1$ are included). On page 23, one line of the NCERT text prints this set as $\mathbf{R} - \{-1, 1\}$. That looks like a small printing slip: NCERT's own table and summary use $\mathbf{R} - (-1, 1)$, which is the correct set.
:::

## Definition

:::formula{title="Inverse of sine"}
$$y = \sin^{-1}x \iff x = \sin y$$
Here $x \in [-1, 1]$ and $y \in [-\pi/2, \pi/2]$. The same holds for the other five functions with their own domain and range from the table.

$\sin^{-1}x$ is **not** $(\sin x)^{-1}$:
$$(\sin x)^{-1} = \frac{1}{\sin x}$$
:::

## Function of its inverse, inverse of its function

:::formula{title="f(f⁻¹(x)) = x"}
$$\sin(\sin^{-1}x) = x$$
Holds for **every** $x$ in the domain: $\sin(\sin^{-1}x) = x$ and $\cos(\cos^{-1}x) = x$ for $x \in [-1, 1]$, and $\tan(\tan^{-1}x) = x$ for all real $x$.
:::

:::formula{title="f⁻¹(f(x)) = x"}
$$\sin^{-1}(\sin x) = x$$
Only when $x$ lies in the principal range:
- $\sin^{-1}(\sin x) = x$ for $x \in [-\pi/2, \pi/2]$
- $\cos^{-1}(\cos x) = x$ for $x \in [0, \pi]$
- $\tan^{-1}(\tan x) = x$ for $x \in (-\pi/2, \pi/2)$

Outside these, first change the angle to one in the range with the same sine (or cosine, tangent).
:::

:::formula{title="Outside the principal range"}
$$\sin^{-1}(\sin x) = \pi - x$$
for $x \in [\pi/2, 3\pi/2]$.
$$\cos^{-1}(\cos x) = 2\pi - x$$
for $x \in [\pi, 2\pi]$.
$$\tan^{-1}(\tan x) = x - \pi$$
for $x \in (\pi/2, 3\pi/2)$. These follow from NCERT's method in Example 6; NCERT does not print these general forms, so work them out rather than memorising.
:::

## Standard simplifications (NCERT examples and exercises)

:::formula{title="Double angle inside sin⁻¹"}
$$\sin^{-1}\!\left(2x\sqrt{1 - x^2}\right) = 2\sin^{-1}x$$
for $-\dfrac{1}{\sqrt2} \le x \le \dfrac{1}{\sqrt2}$.
$$\sin^{-1}\!\left(2x\sqrt{1 - x^2}\right) = 2\cos^{-1}x$$
for $\dfrac{1}{\sqrt2} \le x \le 1$.
:::

:::formula{title="Triple angle"}
$$3\sin^{-1}x = \sin^{-1}(3x - 4x^3)$$
for $x \in [-\tfrac12, \tfrac12]$.
$$3\cos^{-1}x = \cos^{-1}(4x^3 - 3x)$$
for $x \in [\tfrac12, 1]$.
$$3\tan^{-1}x = \tan^{-1}\frac{3x - x^3}{1 - 3x^2}$$
for $|x| < \dfrac{1}{\sqrt3}$.
:::

:::formula{title="Useful substitutions"}
| Expression has | Put |
|---|---|
| $\sqrt{a^2 - x^2}$ | $x = a\sin\theta$ |
| $\sqrt{a^2 + x^2}$ | $x = a\tan\theta$ |
| $\sqrt{x^2 - a^2}$ | $x = a\sec\theta$ |
| $\sqrt{1 \pm x}$ together | $x = \cos 2\theta$ |

Then check that $\theta$ (or $2\theta$, $3\theta$) lies in the principal range.
:::

:::formula{title="Converting between functions"}
$$\cos(\sin^{-1}x) = \sqrt{1 - x^2}$$
$$\sin(\tan^{-1}x) = \frac{x}{\sqrt{1 + x^2}}$$
$$\tan^{-1}\frac{x}{\sqrt{1 - x^2}} = \sin^{-1}x$$
for $|x| < 1$.
$$\cot^{-1}\frac{1}{\sqrt{x^2 - 1}} = \sec^{-1}x$$
for $x > 1$ (NCERT Example 5). The first two hold for every $x$ in the domain. Draw a right triangle to get any such result.
:::

## Exam extras: identities (in the JEE Main syllabus, not stated in the current NCERT)

:::formula{title="Negative argument"}
$$\sin^{-1}(-x) = -\sin^{-1}x$$
$$\cos^{-1}(-x) = \pi - \cos^{-1}x$$
Each holds for every $x$ in the domain ($|x| \le 1$ here). Same pattern: $\tan^{-1}$ and $\operatorname{cosec}^{-1}$ are odd like $\sin^{-1}$. $\sec^{-1}$ and $\cot^{-1}$ follow $\cos^{-1}$: $\sec^{-1}(-x) = \pi - \sec^{-1}x$, $\cot^{-1}(-x) = \pi - \cot^{-1}x$.
:::

:::formula{title="Reciprocal argument"}
$$\sin^{-1}\frac1x = \operatorname{cosec}^{-1}x$$
$$\cos^{-1}\frac1x = \sec^{-1}x$$
These two hold for $|x| \ge 1$.
$$\tan^{-1}\frac1x = \cot^{-1}x$$
Only for $x > 0$. For $x < 0$: $\tan^{-1}\dfrac1x = \cot^{-1}x - \pi$.
:::

:::formula{title="Complementary pairs"}
$$\sin^{-1}x + \cos^{-1}x = \frac{\pi}{2}$$
$$\tan^{-1}x + \cot^{-1}x = \frac{\pi}{2}$$
$$\sec^{-1}x + \operatorname{cosec}^{-1}x = \frac{\pi}{2}$$
For $x \in [-1, 1]$, all real $x$, and $|x| \ge 1$ respectively.
:::

:::formula{title="Sum and difference of tan⁻¹"}
$$\tan^{-1}x + \tan^{-1}y = \tan^{-1}\frac{x + y}{1 - xy}$$
Only for $xy < 1$. If $xy > 1$, add $\pi$ when $x, y > 0$, and subtract $\pi$ when $x, y < 0$. If $xy = 1$, the sum is $\frac{\pi}{2}$ (for $x > 0$) or $-\frac{\pi}{2}$ (for $x < 0$).
$$\tan^{-1}x - \tan^{-1}y = \tan^{-1}\frac{x - y}{1 + xy}$$
For $xy > -1$.
:::

:::formula{title="2 tan⁻¹ x"}
$$2\tan^{-1}x = \sin^{-1}\frac{2x}{1 + x^2}$$
for $|x| \le 1$.
$$2\tan^{-1}x = \cos^{-1}\frac{1 - x^2}{1 + x^2}$$
for $x \ge 0$.
$$2\tan^{-1}x = \tan^{-1}\frac{2x}{1 - x^2}$$
for $|x| < 1$.
:::
