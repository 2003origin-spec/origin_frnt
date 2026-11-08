---
title: "Inverse Trigonometric Functions: Short Notes"
type: short_notes
chapter: c12.mathematics.inverse-trigonometric-functions
order: 2
---

## 1. Why we need branches

- A function has an inverse only if it is **one-one and onto** (Chapter 1).
- Trigonometric functions are periodic, so they are **not** one-one on all of $\mathbf{R}$. Many angles have the same sine.
- Fix: **restrict the domain** to an interval where the function is one-one and still takes every value in its range. Then it has an inverse.
- Each such interval gives a **branch** of the inverse function. For $\sin^{-1}$ the range could be $[-\pi/2, \pi/2]$, or $[\pi/2, 3\pi/2]$, or $[-3\pi/2, -\pi/2]$, and so on.
- The branch NCERT picks is the **principal value branch**. If no branch is named, use it.
- A value of an inverse trigonometric function that lies in the principal range is its **principal value**.

## 2. The six principal branches

| Function | Domain | Principal range |
|---|---|---|
| $\sin^{-1}$ | $[-1, 1]$ | $[-\pi/2, \pi/2]$ |
| $\cos^{-1}$ | $[-1, 1]$ | $[0, \pi]$ |
| $\operatorname{cosec}^{-1}$ | $\mathbf{R} - (-1, 1)$ | $[-\pi/2, \pi/2] - \{0\}$ |
| $\sec^{-1}$ | $\mathbf{R} - (-1, 1)$ | $[0, \pi] - \{\pi/2\}$ |
| $\tan^{-1}$ | $\mathbf{R}$ | $(-\pi/2, \pi/2)$ |
| $\cot^{-1}$ | $\mathbf{R}$ | $(0, \pi)$ |

How to remember:
- $\sin^{-1}$, $\tan^{-1}$, $\operatorname{cosec}^{-1}$ live **around 0** (4th and 1st quadrants).
- $\cos^{-1}$, $\cot^{-1}$, $\sec^{-1}$ live **from 0 to $\pi$** (1st and 2nd quadrants).
- Remove the points where the original function is undefined: $\operatorname{cosec}$ at 0, $\sec$ at $\pi/2$. For $\tan^{-1}$ and $\cot^{-1}$ the end points are open.
- The domain of each inverse is the **range** of the original function: $[-1, 1]$ for sine and cosine, $\mathbf{R} - (-1, 1)$ for sec and cosec, all of $\mathbf{R}$ for tan and cot.

## 3. Graphs

- The graph of $y = \sin^{-1}x$ comes from $y = \sin x$ by swapping the $x$ and $y$ axes: a point $(a, b)$ on $\sin$ becomes $(b, a)$ on $\sin^{-1}$.
- Equivalently, it is the **mirror image of the original graph in the line $y = x$** (using only the principal part).
- Shapes to know:
  - $\sin^{-1}$ rises from $(-1, -\pi/2)$ to $(1, \pi/2)$.
  - $\cos^{-1}$ falls from $(-1, \pi)$ to $(1, 0)$.
  - $\tan^{-1}$ rises across all of $\mathbf{R}$, between the lines $y = -\pi/2$ and $y = \pi/2$, never touching them.
  - $\cot^{-1}$ falls across all of $\mathbf{R}$, between $y = \pi$ and $y = 0$.

## 4. Finding a principal value

1. Write $\theta = \sin^{-1}x$ (say), so $\sin\theta = x$.
2. Find an angle with that sine **inside the principal range**.
3. For a negative value, use the quadrant the range allows.

:::example{title="NCERT Example 2"}
$\cot^{-1}\left(-\dfrac{1}{\sqrt3}\right)$: we need $\cot y = -\dfrac{1}{\sqrt3}$ with $y \in (0, \pi)$.

$\cot\dfrac{\pi}{3} = \dfrac{1}{\sqrt3}$, so $\cot\left(\pi - \dfrac{\pi}{3}\right) = -\dfrac{1}{\sqrt3}$. The answer is $\dfrac{2\pi}{3}$, not $-\dfrac{\pi}{3}$.
:::

## 5. Function and inverse together

- $\sin(\sin^{-1}x) = x$ for every $x \in [-1, 1]$. Always true inside the domain.
- $\sin^{-1}(\sin x) = x$ **only** for $x \in [-\pi/2, \pi/2]$. Similar results hold for the other five "for suitable values" (NCERT).
- For an angle outside the range, find the angle inside the range with the same sine.

:::example{title="NCERT Example 6"}
$\sin^{-1}\left(\sin\dfrac{3\pi}{5}\right)$: $\dfrac{3\pi}{5}$ is not in $[-\pi/2, \pi/2]$.

$\sin\dfrac{3\pi}{5} = \sin\left(\pi - \dfrac{3\pi}{5}\right) = \sin\dfrac{2\pi}{5}$, and $\dfrac{2\pi}{5}$ is in the range. So the answer is $\dfrac{2\pi}{5}$.
:::

- Same idea for the others: for $\cos^{-1}(\cos x)$ use $\cos x = \cos(2\pi - x) = \cos(-x)$; for $\tan^{-1}(\tan x)$ use $\tan x = \tan(x - \pi)$.

## 6. Simplifying by substitution

Put $x$ = a trigonometric function so that the root disappears. Then use the restriction on $x$ to check which branch you land in.

| Expression has | Put |
|---|---|
| $\sqrt{1 - x^2}$ | $x = \sin\theta$ or $\cos\theta$ |
| $\sqrt{a^2 - x^2}$ | $x = a\sin\theta$ |
| $\sqrt{1 + x^2}$ | $x = \tan\theta$ |
| $\sqrt{x^2 - 1}$ | $x = \sec\theta$ |

:::example{title="NCERT Example 5"}
For $x > 1$, put $x = \sec\theta$ with $\theta \in (0, \pi/2)$. Then $\sqrt{x^2 - 1} = \tan\theta$, so
$\cot^{-1}\dfrac{1}{\sqrt{x^2 - 1}} = \cot^{-1}(\cot\theta) = \theta = \sec^{-1}x$.
:::

:::example{title="Half-angle form (NCERT Example 4)"}
For $-\dfrac{3\pi}{2} < x < \dfrac{\pi}{2}$:
$\dfrac{\cos x}{1 - \sin x} = \dfrac{1 + \tan(x/2)}{1 - \tan(x/2)} = \tan\left(\dfrac{\pi}{4} + \dfrac{x}{2}\right)$.

$\dfrac{\pi}{4} + \dfrac{x}{2}$ lies in $(-\pi/2, \pi/2)$, so $\tan^{-1}\dfrac{\cos x}{1 - \sin x} = \dfrac{\pi}{4} + \dfrac{x}{2}$.
:::

- **Triangle method** for a trig function of an inverse: for $\sin(\tan^{-1}x)$ with $x > 0$, draw a right triangle with opposite side $x$ and adjacent side 1. The hypotenuse is $\sqrt{1 + x^2}$, so the answer is $\dfrac{x}{\sqrt{1 + x^2}}$. Then fix the sign from the range (it holds for all real $x$).
- **Sums of inverse functions** (NCERT Miscellaneous Exercise): turn each term into $\tan^{-1}$ by the triangle method, or take $\sin$/$\cos$/$\tan$ of both sides and use the compound-angle formulas from Class 11. Equal tangents do not prove equal angles: also check that both sides lie in the same principal range.

:::example{title="2 sin⁻¹(3/5) = tan⁻¹(24/7)"}
Let $\theta = \sin^{-1}\frac35$, so $\tan\theta = \frac34$. Then $\tan 2\theta = \dfrac{2 \cdot \frac34}{1 - \frac{9}{16}} = \dfrac{24}{7}$.

$\theta < \pi/4$ (since $\frac35 < \frac{1}{\sqrt2}$), so $2\theta \in (0, \pi/2)$ and $2\theta = \tan^{-1}\frac{24}{7}$.
:::

## 7. Identities (exam extra: in the JEE Main syllabus, not in the current NCERT)

The rationalised NCERT book dropped these identities. Its section 2.3 is still called "Properties", but it now covers only results like $\sin(\sin^{-1}x) = x$ and the worked examples. JEE Main still lists "inverse trigonometric functions and their properties". A few NCERT exercises (Ex. 2.2 Q9, Misc. Ex. Q8) are also quickest with the $2\tan^{-1}x$ forms below.

- **Negatives:** $\sin^{-1}$, $\tan^{-1}$, $\operatorname{cosec}^{-1}$ are odd: $f(-x) = -f(x)$. For $\cos^{-1}$, $\sec^{-1}$, $\cot^{-1}$: $f(-x) = \pi - f(x)$.
- **Reciprocals:** $\sin^{-1}\frac1x = \operatorname{cosec}^{-1}x$ and $\cos^{-1}\frac1x = \sec^{-1}x$ for $|x| \ge 1$. $\tan^{-1}\frac1x = \cot^{-1}x$ only for $x > 0$.
- **Complementary pairs** add up to $\dfrac{\pi}{2}$: $\sin^{-1}x + \cos^{-1}x$, $\tan^{-1}x + \cot^{-1}x$, $\sec^{-1}x + \operatorname{cosec}^{-1}x$.
- **Sum of two $\tan^{-1}$:** $\tan^{-1}\dfrac{x + y}{1 - xy}$ when $xy < 1$. When $xy > 1$ the sum is outside $(-\pi/2, \pi/2)$, so add $\pi$ (both positive) or subtract $\pi$ (both negative). When $xy = 1$ the sum is $\pm\frac{\pi}{2}$, with the sign of $x$.
- **Double:** $2\tan^{-1}x$ equals $\sin^{-1}\dfrac{2x}{1 + x^2}$ for $|x| \le 1$, $\cos^{-1}\dfrac{1 - x^2}{1 + x^2}$ for $x \ge 0$, and $\tan^{-1}\dfrac{2x}{1 - x^2}$ for $|x| < 1$.

:::example{title="Using a pair"}
If $\sin^{-1}x = \dfrac{\pi}{5}$, then $\cos^{-1}x = \dfrac{\pi}{2} - \dfrac{\pi}{5} = \dfrac{3\pi}{10}$.
:::
