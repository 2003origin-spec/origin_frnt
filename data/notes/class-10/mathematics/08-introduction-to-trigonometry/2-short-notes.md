---
title: "Introduction to Trigonometry: Short Notes"
type: short_notes
chapter: c10.mathematics.introduction-to-trigonometry
order: 2
---

## 1. What is trigonometry?

- The word comes from Greek: *tri* (three), *gon* (sides), *metron* (measure).
- Trigonometry studies how the **sides and angles of a triangle** are linked.
- In this chapter we only use **right triangles** and **acute angles**. We also define the ratios for 0° and 90°.
- Using these ratios to find heights and distances is the next chapter (Some Applications of Trigonometry).

## 2. Naming the sides

Take triangle ABC, right-angled at B. Look at angle A:
- **Opposite side** BC: it faces angle A.
- **Adjacent side** AB: it is the side next to angle A (not the hypotenuse).
- **Hypotenuse** AC: it faces the right angle. It is the longest side.

:::remember
The names depend on the angle you look at. For angle C, the opposite side is AB and the adjacent side is BC. The hypotenuse stays AC.
:::

## 3. The six trigonometric ratios

| Ratio | Short name | Sides for angle A |
|---|---|---|
| sine | sin A | opposite / hypotenuse |
| cosine | cos A | adjacent / hypotenuse |
| tangent | tan A | opposite / adjacent |
| cosecant | cosec A | hypotenuse / opposite |
| secant | sec A | hypotenuse / adjacent |
| cotangent | cot A | adjacent / opposite |

- cosec, sec and cot are the **reciprocals** of sin, cos and tan.
- Also $\tan A = \dfrac{\sin A}{\cos A}$ and $\cot A = \dfrac{\cos A}{\sin A}$.
- "sin A" is one symbol: the sine of angle A. It is **not** sin × A. "sin" alone means nothing.
- $\sin^2 A$ means $(\sin A)^2$. But $\sin^{-1} A$ is **not** $\dfrac{1}{\sin A}$. It means something else (Class 12).
- The Greek letter $\theta$ (theta) is often used for an angle.

## 4. The ratios do not depend on the size of the triangle

- Take a point P on AC and drop a perpendicular PM to AB. Triangles PAM and CAB are **similar** (AA criterion).
- So their sides are in proportion, and $\dfrac{MP}{AP} = \dfrac{BC}{AC} = \sin A$.
- **Key fact:** the value of a trigonometric ratio depends **only on the angle**, not on the lengths of the sides.

## 5. One ratio gives all the others

Steps:
1. Write the given ratio as a fraction of two sides. Take the sides as $k$ times the numbers ($k > 0$).
2. Find the third side with the Pythagoras theorem. Take the positive root (a length cannot be negative).
3. Write the other five ratios from their definitions.

:::example{title="Given tan A = 4/3 (NCERT Example 1)"}
Opposite $BC = 4k$, adjacent $AB = 3k$. Then $AC = \sqrt{16k^2 + 9k^2} = 5k$.

$\sin A = \dfrac45$, $\cos A = \dfrac35$, $\cot A = \dfrac34$, $\operatorname{cosec} A = \dfrac54$, $\sec A = \dfrac53$.
:::

- If $\sin B = \sin Q$ for acute angles B and Q, then $\angle B = \angle Q$ (NCERT Example 2). The same is true for cos.

## 6. Ratios of 45°

- In a right triangle with one angle 45°, the other acute angle is also 45°. So the two shorter sides are equal: take both as $a$.
- Hypotenuse $= a\sqrt2$.
- So $\sin 45^\circ = \cos 45^\circ = \dfrac{1}{\sqrt2}$ and $\tan 45^\circ = 1$.

## 7. Ratios of 30° and 60°

- Take an equilateral triangle ABC with side $2a$. Draw AD perpendicular to BC.
- Then $BD = a$, $\angle BAD = 30^\circ$ and $\angle ABD = 60^\circ$.
- By Pythagoras, $AD = a\sqrt3$.
- For 30° (at A): opposite $= a$, adjacent $= a\sqrt3$, hypotenuse $= 2a$.
- For 60° (at B): opposite $= a\sqrt3$, adjacent $= a$, hypotenuse $= 2a$.
- So $\sin 30^\circ = \dfrac12$, $\cos 30^\circ = \dfrac{\sqrt3}{2}$, $\tan 30^\circ = \dfrac{1}{\sqrt3}$.
- And $\sin 60^\circ = \dfrac{\sqrt3}{2}$, $\cos 60^\circ = \dfrac12$, $\tan 60^\circ = \sqrt3$.

## 8. Ratios of 0° and 90°

- As angle A shrinks to 0°, the opposite side shrinks to 0 and the hypotenuse becomes almost the adjacent side. So NCERT **defines** $\sin 0^\circ = 0$ and $\cos 0^\circ = 1$.
- As angle A grows to 90°, the adjacent side shrinks to 0. So $\sin 90^\circ = 1$ and $\cos 90^\circ = 0$.
- Then $\tan 0^\circ = 0$ and $\sec 0^\circ = 1$. But $\cot 0^\circ$ and $\operatorname{cosec} 0^\circ$ are **not defined** (division by 0).
- At 90°: $\cot 90^\circ = 0$, $\operatorname{cosec} 90^\circ = 1$. $\tan 90^\circ$ and $\sec 90^\circ$ are **not defined**.
- As A goes from 0° to 90°, $\sin A$ **increases** from 0 to 1 and $\cos A$ **decreases** from 1 to 0.

## 9. Using the values

- **Find a side:** pick the ratio that links the side you know and the side you want.
- **Find an angle:** work out a ratio from two sides, then match it with the table.
- If you know one side and one more part (an acute angle or another side) of a right triangle, you can find all its sides and angles.

:::example{title="Find the sides (NCERT Example 6)"}
Right-angled at B, $AB = 5$ cm, $\angle C = 30^\circ$.

$\tan 30^\circ = \dfrac{AB}{BC}$ gives $BC = 5\sqrt3$ cm. $\sin 30^\circ = \dfrac{AB}{AC}$ gives $AC = 10$ cm.
:::

:::example{title="Find two angles (NCERT Example 8)"}
Given $0^\circ < A + B \le 90^\circ$ and $A > B$. So $A + B$ and $A - B$ both lie between 0° and 90°.

$\sin(A - B) = \dfrac12$ gives $A - B = 30^\circ$. $\cos(A + B) = \dfrac12$ gives $A + B = 60^\circ$.

Solving: $A = 45^\circ$, $B = 15^\circ$.
:::

## 10. Trigonometric identities

- An **identity** is an equation that is true for **all** values of the angle for which both sides are defined.
- Start from Pythagoras: $AB^2 + BC^2 = AC^2$.
  - Divide by $AC^2$: $\cos^2 A + \sin^2 A = 1$, for $0^\circ \le A \le 90^\circ$.
  - Divide by $AB^2$: $1 + \tan^2 A = \sec^2 A$, for $0^\circ \le A < 90^\circ$.
  - Divide by $BC^2$: $\cot^2 A + 1 = \operatorname{cosec}^2 A$, for $0^\circ < A \le 90^\circ$.
- With these, any one ratio gives all the others **without drawing a triangle**.

:::example{title="Other ratios in terms of sin A (NCERT Example 9)"}
$\cos A = \sqrt{1 - \sin^2 A}$ (positive root, since A is acute).

$\tan A = \dfrac{\sin A}{\sqrt{1 - \sin^2 A}}$ and $\sec A = \dfrac{1}{\sqrt{1 - \sin^2 A}}$.
:::

## 11. How to prove an identity

- Start from the **more complicated side** and simplify it until it becomes the other side.
- If stuck, write everything in **sin and cos**.
- Look for $1 - \sin^2 A = \cos^2 A$, $\sec^2 A - \tan^2 A = 1$ and $\operatorname{cosec}^2 A - \cot^2 A = 1$.
- Use $(a - b)(a + b) = a^2 - b^2$. Multiplying the top and bottom by a "partner" like $(1 + \sin A)$ often helps.
- Sometimes simplify the LHS and the RHS **separately** until both give the same expression.
- Do not start by assuming the result is true and changing both sides like an equation. You are proving it, not solving it.

## 12. Not in the current book

- The current (rationalised) NCERT book has **removed** the section "Trigonometric ratios of complementary angles", with results like $\sin(90^\circ - A) = \cos A$. Older guides still have it. It is not in this book or its exercises.
- Inside one right triangle you can still read ratios of both acute angles from the sides. For triangle ABC right-angled at B, $\sin C = \dfrac{AB}{AC} = \cos A$, straight from the definitions.
