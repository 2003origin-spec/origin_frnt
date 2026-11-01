---
title: "Trigonometric Functions: Quick Practice"
type: practice
chapter: c11.mathematics.trigonometric-functions
order: 4
---

Try each question first, then tap **Show answer**.

## Angles and values

:::question{title="1. Arc length" exam="JEE Main level"}
In a circle of radius 21 cm, an arc subtends an angle of $150^\circ$ at the centre. Find the length of the arc. (Use $\pi = \frac{22}{7}$.)

---

$\theta = 150 \times \dfrac{\pi}{180} = \dfrac{5\pi}{6}$ radian.

$l = r\theta = 21 \times \dfrac{5}{6} \times \dfrac{22}{7} =$ **55 cm**.
:::

:::question{title="2. Large angles" exam="JEE Main level"}
Find the value of $\sin(-1110^\circ) + \cos 1500^\circ$.

---

$-1110^\circ + 3 \times 360^\circ = -30^\circ$, so $\sin(-1110^\circ) = \sin(-30^\circ) = -\frac12$.

$1500^\circ - 4 \times 360^\circ = 60^\circ$, so $\cos 1500^\circ = \cos 60^\circ = \frac12$.

The sum is **0**.
:::

:::question{title="3. Using the quadrant" exam="JEE Main level"}
If $\tan x = -\dfrac{24}{7}$ and $x$ lies in the fourth quadrant, find $\sin x + \cos x$.

---

$\sec^2 x = 1 + \dfrac{576}{49} = \dfrac{625}{49}$. In quadrant IV, $\sec x > 0$, so $\sec x = \dfrac{25}{7}$ and $\cos x = \dfrac{7}{25}$.

$\sin x = \tan x\cos x = -\dfrac{24}{25}$. So $\sin x + \cos x =$ **$-\dfrac{17}{25}$**.
:::

## Sum and difference

:::question{title="4. cos (A + B)" exam="JEE Main level"}
$\sin A = \dfrac45$ with $A$ in quadrant I, and $\cos B = -\dfrac{5}{13}$ with $B$ in quadrant III. Find $\cos(A + B)$.

---

$\cos A = \dfrac35$. In quadrant III sine is negative, so $\sin B = -\dfrac{12}{13}$.

$\cos(A + B) = \dfrac35\left(-\dfrac{5}{13}\right) - \dfrac45\left(-\dfrac{12}{13}\right) = \dfrac{-15 + 48}{65} =$ **$\dfrac{33}{65}$**.
:::

:::question{title="5. A tan relation" exam="JEE Main level"}
Find the value of $\tan 65^\circ - \tan 25^\circ - 2\tan 40^\circ$.

---

$65^\circ = 40^\circ + 25^\circ$, so $\tan 65^\circ = \dfrac{\tan 40^\circ + \tan 25^\circ}{1 - \tan 40^\circ\tan 25^\circ}$.

Cross-multiply: $\tan 65^\circ - \tan 65^\circ\tan 40^\circ\tan 25^\circ = \tan 40^\circ + \tan 25^\circ$.

$\tan 65^\circ\tan 25^\circ = \tan 65^\circ\cot 65^\circ = 1$. So $\tan 65^\circ - \tan 40^\circ = \tan 40^\circ + \tan 25^\circ$, and the value is **0**.
:::

:::question{title="6. Finding an angle" exam="JEE Main level"}
$x$ and $y$ are acute angles with $\tan x = \dfrac17$ and $\tan y = \dfrac13$. Find $x + 2y$.

---

$\tan 2y = \dfrac{2/3}{1 - 1/9} = \dfrac34$.

$\tan(x + 2y) = \dfrac{\frac17 + \frac34}{1 - \frac17 \cdot \frac34} = \dfrac{25/28}{25/28} = 1$.

$\tan y < 1$ gives $y < \frac{\pi}{4}$; $\tan x < 1$ gives $x < \frac{\pi}{4}$. So $0 < x + 2y < \frac{3\pi}{4}$, and the only angle there with tangent 1 is $\frac{\pi}{4}$: $x + 2y =$ **$\dfrac{\pi}{4}$**.
:::

## Multiple angles

:::question{title="7. Half angle" exam="JEE Main level"}
If $\cos x = -\dfrac35$ and $\dfrac{\pi}{2} < x < \pi$, find $\tan\dfrac{x}{2}$.

---

In quadrant II, $\sin x = \dfrac45$.

$\tan\dfrac{x}{2} = \dfrac{\sin x}{1 + \cos x} = \dfrac{4/5}{2/5} =$ **2**.

Check: $\frac{\pi}{4} < \frac{x}{2} < \frac{\pi}{2}$, so $\tan\frac{x}{2}$ should be more than 1. It is.
:::

:::question{title="8. A product of cosines" exam="JEE Main level"}
Find the value of $\cos 20^\circ \cos 40^\circ \cos 80^\circ$.

---

Call it $P$. Multiply by $\sin 20^\circ$ and use $\sin\theta\cos\theta = \frac12\sin 2\theta$ three times:

$\sin 20^\circ \cdot P = \frac12\sin 40^\circ\cos 40^\circ\cos 80^\circ = \frac14\sin 80^\circ\cos 80^\circ = \frac18\sin 160^\circ$.

$\sin 160^\circ = \sin 20^\circ$, so $P =$ **$\dfrac18$**.
:::

## Sum to product

:::question{title="9. Simplify" exam="JEE Main level"}
Simplify $\dfrac{\sin 7x - \sin 3x}{\cos 7x + \cos 3x}$.

---

Numerator: $2\cos 5x\sin 2x$. Denominator: $2\cos 5x\cos 2x$.

The ratio is **$\tan 2x$** (where $\cos 5x\cos 2x \ne 0$).
:::

:::question{title="10. Sum of squares" exam="JEE Main level"}
Find the value of $\sin^2 10^\circ + \sin^2 50^\circ + \sin^2 70^\circ$.

---

Use $\sin^2\theta = \dfrac{1 - \cos 2\theta}{2}$. The sum is $\dfrac32 - \dfrac12\left(\cos 20^\circ + \cos 100^\circ + \cos 140^\circ\right)$.

$\cos 100^\circ + \cos 140^\circ = 2\cos 120^\circ\cos 20^\circ = -\cos 20^\circ$, so the bracket is 0.

The value is **$\dfrac32$**.
:::
