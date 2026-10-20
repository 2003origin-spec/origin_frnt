---
title: "Introduction to Trigonometry: Important Points and Traps"
type: key_points
chapter: c10.mathematics.introduction-to-trigonometry
order: 3
---

## NCERT one-liners

:::remember
- The value of a trigonometric ratio depends **only on the angle**, not on the size of the triangle.
- sin A or cos A is never more than 1. sec A ($0^\circ \le A < 90^\circ$) and cosec A ($0^\circ < A \le 90^\circ$) are always $\ge 1$.
- As A increases from 0° to 90°, sin A increases from 0 to 1 and cos A decreases from 1 to 0.
- If one side and one more part (an acute angle or a side) of a right triangle are known, the rest can be found.
- If one ratio of an acute angle is known, all the others can be found.
:::

## Naming sides

:::trap
"Opposite" and "adjacent" change with the angle. For angle A the opposite side is BC. For angle C it is AB. Always mark the angle first, then name the sides.
:::

:::trap
Take the positive root when you find a side with Pythagoras. A length is never negative. In NCERT's words: why is AB not $-2\sqrt2\,k$?
:::

## Notation

:::trap
- $\sin^2 A = (\sin A)^2$, not $\sin(A^2)$.
- $\sin^{-1} A$ is **not** $\dfrac{1}{\sin A}$. The reciprocal of sin A is cosec A.
- cot A is **not** "cot × A". sin, cos, tan on their own mean nothing.
- cos A is short for cosine, not cosecant. Cosecant is cosec A.
:::

## Which values are possible?

:::trap
tan A is **not** always less than 1. $\tan 60^\circ = \sqrt3 \approx 1.73$, and tan A grows without limit as A gets close to 90°.
:::

- $\sec A = \dfrac{12}{5}$ is possible: it is more than 1 (hypotenuse 12, adjacent side 5).
- $\sin\theta = \dfrac43$ is **impossible**: the opposite side cannot be longer than the hypotenuse.
- $\cos A = \dfrac{\sqrt5}{2}$ is impossible too ($\sqrt5 > 2$).

## Not defined

:::remember
- At 0°: cot and cosec are **not defined** (sin 0° = 0 is in the denominator).
- At 90°: tan and sec are **not defined** (cos 90° = 0 is in the denominator).
- So $1 + \tan^2 A = \sec^2 A$ needs $A < 90^\circ$, and $1 + \cot^2 A = \operatorname{cosec}^2 A$ needs $A > 0^\circ$.
:::

## Ratios do not split over sums

:::trap
$\sin(A + B) \ne \sin A + \sin B$. Check with $A = B = 30^\circ$: $\sin 60^\circ = \dfrac{\sqrt3}{2} \approx 0.87$, but $\sin 30^\circ + \sin 30^\circ = 1$.
:::

:::trap
$\sin 2A \ne 2\sin A$ in general. At $A = 30^\circ$: $\sin 60^\circ \approx 0.87$, but $2\sin 30^\circ = 1$. Of NCERT's choices (0°, 30°, 45°, 60°), only $A = 0^\circ$ works: both sides are 0.
:::

- $\sin\theta = \cos\theta$ is **not** true for all $\theta$. Between 0° and 90° it holds only at $\theta = 45^\circ$.
- When you solve $\sin(A - B) = \dfrac12$, the step "so $A - B = 30^\circ$" works because the angle is acute. Read the given range, such as $0^\circ < A + B \le 90^\circ$.

## Memory aids

:::tip
**sin row trick:** $\sin$ of $0^\circ, 30^\circ, 45^\circ, 60^\circ, 90^\circ$ is $\sqrt{\dfrac{n}{4}}$ for $n = 0, 1, 2, 3, 4$. That gives $0, \dfrac12, \dfrac{1}{\sqrt2}, \dfrac{\sqrt3}{2}, 1$.

The cos row is the same list read **backwards**. Then $\tan = \dfrac{\sin}{\cos}$. (This trick is beyond the Class 10 book, but it gives the same values.)
:::

:::tip
To remember the three basic ratios, use "**SOH CAH TOA**": Sine = Opposite/Hypotenuse, Cosine = Adjacent/Hypotenuse, Tangent = Opposite/Adjacent.
:::

:::tip
Useful facts that come from the identities:
- $(\sec A - \tan A)(\sec A + \tan A) = 1$
- $(\operatorname{cosec} A - \cot A)(\operatorname{cosec} A + \cot A) = 1$

So if $\sec A + \tan A = p$, then $\sec A - \tan A = \dfrac1p$.
:::

## Proving identities

:::trap
Do not start by assuming the result and then "cross-multiply" or move terms across "=". Start from one side and reach the other, or simplify both sides separately to the same thing.
:::

- First try writing everything in sin and cos.
- Watch for $1 - \sin^2 A$ ($= \cos^2 A$) and $1 - \cos^2 A$ ($= \sin^2 A$).
- When a question says "use the identity ...", first change to those ratios. NCERT Example 12 (sec and tan): divide the top and bottom by $\cos\theta$. Exercise 8.3 Q4(v) (cosec and cot): divide the top and bottom by $\sin A$.

## Removed topic

:::remember
"Trigonometric ratios of complementary angles", such as $\sin(90^\circ - A) = \cos A$, is **not** in the current NCERT book. Older guides and old papers use it. Do not expect it in this chapter's exercises.
:::
