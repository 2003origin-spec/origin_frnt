---
title: "Trigonometric Functions: Short Notes"
type: short_notes
chapter: c11.mathematics.trigonometric-functions
order: 2
---

## 1. Angles

- An **angle** is the amount a ray turns about its starting point. The starting position is the **initial side**, the final position is the **terminal side**, and the turning point is the **vertex**.
- Anticlockwise turning gives a **positive** angle; clockwise gives a **negative** angle.
- An angle can be more than $360^\circ$. For example, $420^\circ$ is one full turn plus $60^\circ$.

## 2. Degree and radian measure

- **Degree:** $\frac{1}{360}$ of a full turn. $1^\circ = 60'$ (minutes) and $1' = 60''$ (seconds).
- **Radian:** the angle at the centre made by an arc whose length equals the radius. A full turn is $2\pi$ radian.
- So $\pi$ radian $= 180^\circ$. Multiply degrees by $\frac{\pi}{180}$ to get radians; multiply radians by $\frac{180}{\pi}$ to get degrees.
- **Arc length:** $l = r\theta$, with $\theta$ in radians.
- When no unit is written, the angle is in radians. $\frac{\pi}{4}$ means $45^\circ$, but "$\sin 2$" means the sine of 2 radians (about $114.6^\circ$).

| Degrees | Radians |
|---|---|
| 30° | $\frac{\pi}{6}$ |
| 45° | $\frac{\pi}{4}$ |
| 60° | $\frac{\pi}{3}$ |
| 90° | $\frac{\pi}{2}$ |
| 180° | $\pi$ |
| 270° | $\frac{3\pi}{2}$ |
| 360° | $2\pi$ |

:::example{title="Degrees to radians"}
$40^\circ 20' = 40\tfrac13$ degree $= \dfrac{121}{3} \times \dfrac{\pi}{180} = \dfrac{121\pi}{540}$ radian.
:::

## 3. Trigonometric functions of any angle

- Take the **unit circle** (radius 1, centre at the origin). Turn through an angle $x$ from the point $(1, 0)$ to reach the point $P(a, b)$.
- NCERT defines $\cos x = a$ and $\sin x = b$. So $\cos x$ is the $x$-coordinate and $\sin x$ is the $y$-coordinate of $P$.
- Since $a^2 + b^2 = 1$, we get $\sin^2 x + \cos^2 x = 1$ for **every** real $x$.
- The other four are built from these: $\tan x = \dfrac{\sin x}{\cos x}$, $\cot x = \dfrac{\cos x}{\sin x}$, $\sec x = \dfrac{1}{\cos x}$, $\operatorname{cosec} x = \dfrac{1}{\sin x}$.
- **Quadrantal angles** are multiples of $\frac{\pi}{2}$. At $0, \frac{\pi}{2}, \pi, \frac{3\pi}{2}$ the point $P$ is $(1, 0), (0, 1), (-1, 0), (0, -1)$.
- $\sin x = 0$ exactly when $x = n\pi$. $\cos x = 0$ exactly when $x$ is an odd multiple of $\frac{\pi}{2}$.

| $x$ | sin | cos | tan |
|---|---|---|---|
| $0$ | $0$ | $1$ | $0$ |
| $\frac{\pi}{6}$ | $\frac12$ | $\frac{\sqrt3}{2}$ | $\frac{1}{\sqrt3}$ |
| $\frac{\pi}{4}$ | $\frac{1}{\sqrt2}$ | $\frac{1}{\sqrt2}$ | $1$ |
| $\frac{\pi}{3}$ | $\frac{\sqrt3}{2}$ | $\frac12$ | $\sqrt3$ |
| $\frac{\pi}{2}$ | $1$ | $0$ | not defined |
| $\pi$ | $0$ | $-1$ | $0$ |
| $\frac{3\pi}{2}$ | $-1$ | $0$ | not defined |
| $2\pi$ | $0$ | $1$ | $0$ |

## 4. Signs in the four quadrants

| Quadrant | Angle $x$ | Positive |
|---|---|---|
| I | $0$ to $\frac{\pi}{2}$ | all six |
| II | $\frac{\pi}{2}$ to $\pi$ | sin, cosec |
| III | $\pi$ to $\frac{3\pi}{2}$ | tan, cot |
| IV | $\frac{3\pi}{2}$ to $2\pi$ | cos, sec |

- $\cos(-x) = \cos x$ (even) and $\sin(-x) = -\sin x$ (odd), because the point for $-x$ is the mirror image $(a, -b)$.

## 5. Domain and range

| Function | Not defined at | Range |
|---|---|---|
| sin, cos | (defined for all $x$) | $[-1, 1]$ |
| tan, sec | $x = (2n+1)\frac{\pi}{2}$ | tan: $\mathbb{R}$; sec: $\lvert y\rvert \ge 1$ |
| cot, cosec | $x = n\pi$ | cot: $\mathbb{R}$; cosec: $\lvert y\rvert \ge 1$ |

- $\sec x$ and $\operatorname{cosec} x$ never take values strictly between $-1$ and $1$.

## 6. Behaviour and graphs

- In quadrant I, as $x$ goes from $0$ to $\frac{\pi}{2}$: $\sin x$ rises from 0 to 1, $\cos x$ falls from 1 to 0, and $\tan x$ rises from 0 without limit.
- $\sin x$ rises in quadrants I and IV and falls in II and III. $\cos x$ falls in I and II and rises in III and IV.
- $\tan x$ **increases** in every quadrant; $\cot x$ **decreases** in every quadrant.
- **Graphs:** $y = \sin x$ and $y = \cos x$ are waves between $-1$ and $1$ that repeat every $2\pi$. The cosine wave is the sine wave moved left by $\frac{\pi}{2}$.
- $y = \tan x$ repeats every $\pi$. Its graph has vertical asymptotes (lines it never touches) at the odd multiples of $\frac{\pi}{2}$.
- **Periods:** sin, cos, sec, cosec repeat after $2\pi$; tan and cot repeat after $\pi$.

:::example{title="Using the period"}
$\cos(-1710^\circ) = \cos(-1710^\circ + 5 \times 360^\circ) = \cos 90^\circ = 0$
:::

## 7. Finding all six from one

1. Use a Pythagorean identity to get a second function, with a $\pm$ sign.
2. Choose the sign from the quadrant.
3. Get the rest from the reciprocal and quotient relations.

:::example{title="cos x = −3/5, x in quadrant III"}
$\sin^2 x = 1 - \frac{9}{25} = \frac{16}{25}$. In quadrant III sine is negative, so $\sin x = -\frac45$.

Then $\tan x = \frac43$, $\cot x = \frac34$, $\sec x = -\frac53$, $\operatorname{cosec} x = -\frac54$.
:::

## 8. Sum and difference formulas

- NCERT first proves $\cos(x + y) = \cos x\cos y - \sin x\sin y$ using the unit circle (two congruent triangles give equal chord lengths). With $\sin(-x) = -\sin x$, $\cos(-x) = \cos x$ and $\sin^2 x + \cos^2 x = 1$, every other identity in the chapter follows from it.
- Replace $y$ by $-y$ for the "minus" versions. In $\cos(x - y)$, put $\frac{\pi}{2}$ in place of $x$ and $x$ in place of $y$: this gives $\cos(\frac{\pi}{2} - x) = \sin x$, and from it $\sin(\frac{\pi}{2} - x) = \cos x$.
- $\tan(x \pm y)$ comes from dividing $\sin$ by $\cos$ and then dividing top and bottom by $\cos x\cos y$. It needs $x$, $y$, $x \pm y$ not to be odd multiples of $\frac{\pi}{2}$.

:::example{title="sin 15°"}
$\sin(45^\circ - 30^\circ) = \dfrac{1}{\sqrt2}\cdot\dfrac{\sqrt3}{2} - \dfrac{1}{\sqrt2}\cdot\dfrac12 = \dfrac{\sqrt3 - 1}{2\sqrt2}$
:::

## 9. Allied angles

Angles like $\frac{\pi}{2} \pm x$, $\pi \pm x$, $\frac{3\pi}{2} \pm x$, $2\pi - x$ reduce to functions of $x$. The rule:

- With $\frac{\pi}{2}$ or $\frac{3\pi}{2}$, the function **changes** (sin ↔ cos, tan ↔ cot, sec ↔ cosec).
- With $\pi$ or $2\pi$, the function **stays** the same.
- The **sign** is the sign of the original function in the quadrant where the angle falls, treating $x$ as a small acute angle.

:::example{title="tan 13π/12"}
$\tan\left(\pi + \frac{\pi}{12}\right) = \tan\frac{\pi}{12} = \tan\left(\frac{\pi}{4} - \frac{\pi}{6}\right) = 2 - \sqrt3$
:::

## 10. Multiple angles

- Put $y = x$ in the sum formulas: $\sin 2x = 2\sin x\cos x$, $\cos 2x = \cos^2 x - \sin^2 x$, $\tan 2x = \dfrac{2\tan x}{1 - \tan^2 x}$.
- Using $\sin^2 x + \cos^2 x = 1$, $\cos 2x$ also equals $2\cos^2 x - 1$ and $1 - 2\sin^2 x$. Pick the form that uses what you know.
- Rearranged, these give $1 - \cos x = 2\sin^2\frac{x}{2}$ and $1 + \cos x = 2\cos^2\frac{x}{2}$ (used in NCERT's half-angle examples).
- **Triple angles:** $\sin 3x = 3\sin x - 4\sin^3 x$ and $\cos 3x = 4\cos^3 x - 3\cos x$, from $3x = 2x + x$.

:::example{title="tan(π/8)"}
Let $t = \tan\frac{\pi}{8}$. Then $\tan\frac{\pi}{4} = 1 = \dfrac{2t}{1 - t^2}$, so $t^2 + 2t - 1 = 0$ and $t = -1 \pm \sqrt2$.

$\frac{\pi}{8}$ is in quadrant I, so $t > 0$: $\tan\frac{\pi}{8} = \sqrt2 - 1$.
:::

## 11. Sum to product and product to sum

- Add and subtract the sum and difference formulas: $\cos(x+y) + \cos(x-y) = 2\cos x\cos y$, and so on. These are the **product-to-sum** results.
- Put $x + y = \theta$ and $x - y = \phi$ to get the **sum-to-product** results, like $\cos\theta + \cos\phi = 2\cos\frac{\theta+\phi}{2}\cos\frac{\theta-\phi}{2}$.
- Use sum-to-product when a question has sums like $\sin 7x + \sin 5x$. Use product-to-sum when it has products like $2\cos 2x\cos\frac{x}{2}$.

:::example{title="A quick simplification"}
$\dfrac{\cos 7x + \cos 5x}{\sin 7x - \sin 5x} = \dfrac{2\cos 6x\cos x}{2\cos 6x\sin x} = \cot x$
:::

## 12. Trigonometric equations (beyond the syllabus)

Solving trigonometric equations was removed from the current NCERT book. The JEE Main 2026 syllabus (Unit 14) names only identities, trigonometric functions and inverse trigonometric functions, so equations are not in it either. NCERT keeps only $\sin x = 0 \iff x = n\pi$ and $\cos x = 0 \iff x = (2n+1)\frac{\pi}{2}$. The general solutions are on the Formula Sheet as a small, clearly marked aid.
