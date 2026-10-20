---
title: "Applications of Trigonometry: Short Notes"
type: short_notes
chapter: c10.mathematics.some-applications-of-trigonometry
order: 2
---

## 1. Why this chapter

- We can find the height of a tower, a tree or a building **without climbing it**.
- We can find the distance between two far-away objects without walking it.
- All we need is one length we can measure, an angle, and a trigonometric ratio from Chapter 8.

## 2. Line of sight

- The **line of sight** is the line from the observer's **eye** to the point being looked at.

## 3. Angle of elevation

- You look **up** at something (you raise your head).
- The **angle of elevation** is the angle between the line of sight and the **horizontal**.
- Example: a student looks at the top of a minar. The angle at the eye, between the horizontal and the line to the top, is the angle of elevation.

## 4. Angle of depression

- You look **down** at something (you lower your head).
- The **angle of depression** is the angle between the line of sight and the **horizontal** through your eye.
- Example: a girl on a balcony looks down at a flower pot on a temple stair.

:::remember
Both angles are measured from the **horizontal**, never from the vertical.
:::

- The horizontal at the eye and the ground are parallel. So the angle of depression of $B$ from $A$ equals the angle of elevation of $A$ from $B$ (alternate angles).
- In a figure, mark the angle of depression's equal angle at the point being viewed (often a point on the ground). That angle is inside the right triangle.

## 5. Which ratio to use

Look at what you **know** and what you **need**, then pick the ratio that links them.

| Known and needed | Use |
|---|---|
| height and ground distance | tan (or cot) |
| height and slant length | sin |
| ground distance and slant length | cos |

- Towers, buildings, shadows, ships: mostly **tan**.
- Ladders, ropes, kite strings, slides: **sin** or **cos**.

## 6. Steps for every problem

1. Draw a simple figure. Make the object vertical and the ground horizontal.
2. Mark the right angle at the foot of the object.
3. Mark the given angle and the given length.
4. Call the unknown $h$ or $x$.
5. Write one ratio for each right triangle.
6. Solve. Rationalise if needed. Use the decimal value of $\sqrt{3}$ only at the end.

:::example{title="A tower (NCERT type)"}
From a point 15 m from the foot of a tower, the angle of elevation of the top is 60°.

$\tan 60^\circ = \dfrac{h}{15}$, so $h = 15\sqrt{3}$ m.
:::

## 7. Slant lengths

:::example{title="A ladder"}
A ladder makes 60° with the ground and reaches 3.7 m up a pole.

$\sin 60^\circ = \dfrac{3.7}{l}$, so $l = \dfrac{7.4}{\sqrt{3}}$.

Its foot is at $3.7 \cot 60^\circ = \dfrac{3.7}{\sqrt{3}}$ from the pole.

With $\sqrt{3} = 1.73$ (as NCERT takes here): ladder $\approx 4.28$ m, foot $\approx 2.14$ m from the pole.
:::

- In Exercise 9.1, the rope, the slide and the kite string are all slant lengths. Use sin.

## 8. The observer's height

- The angle of elevation is measured at the **eye**, not at the feet.
- So the right triangle gives only the part **above eye level**.
- Height of the object = (part above eye level) + (height of the eye).

:::example{title="A chimney"}
An observer 1.5 m tall stands 28.5 m from a chimney. The elevation of its top from her eyes is 45°.

Part above eye level $= 28.5 \tan 45^\circ = 28.5$ m. Chimney $= 28.5 + 1.5 = 30$ m.
:::

## 9. Two right triangles

Many problems have **two** right triangles that share a side. Write one equation for each, then solve them together.

**(a) Same side, walking closer.** The angle of elevation **grows** as you walk towards the object. The shared side is the height.

:::example{title="Shadows (NCERT type)"}
A tower's shadow is 40 m longer when the Sun's altitude is 30° than when it is 60°.

Let the shorter shadow be $x$. Then $h = x\sqrt{3}$ and $\sqrt{3}\,h = x + 40$.

So $3x = x + 40$, $x = 20$, and $h = 20\sqrt{3}$ m.
:::

**(b) One object on top of another.** A flagstaff on a building, a statue on a pedestal, a tower on a building. The shared side is the ground distance. If the height of the lower part is known, find the distance from it first. If only the top part is known (a 1.6 m statue on a pedestal), write one equation for each triangle and solve them together.

**(c) Opposite sides.** Two banks of a river, two ships on either side, a road between two poles. Add the two ground distances.

:::example{title="Width of a river (NCERT type)"}
From a bridge 3 m above the banks, the depressions of the two opposite banks are 30° and 45°.

Width $= 3\cot 30^\circ + 3\cot 45^\circ = 3\sqrt{3} + 3 = 3(\sqrt{3} + 1)$ m.
:::

**(d) From the top of a building.** Look **down** to the foot of another building or tower (depression), and **up** to its top (elevation). The distance between them is the shared side. The horizontal line from your eye cuts the other object at your height.

## 10. Exact answers and decimals

- Keep answers like $20\sqrt{3}$ m exact unless a decimal is asked.
- Rationalise: $\dfrac{8}{\sqrt{3} - 1} = \dfrac{8(\sqrt{3} + 1)}{2} = 4(\sqrt{3} + 1)$.
- With $\sqrt{3} = 1.732$: $20\sqrt{3} = 34.64$, $10(\sqrt{3} - 1) = 7.32$.
