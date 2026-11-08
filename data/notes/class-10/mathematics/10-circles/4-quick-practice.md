---
title: "Circles: Quick Practice"
type: practice
chapter: c10.mathematics.circles
order: 4
---

Try each question first, then tap **Show answer**. O is the centre of the circle in every question.

## Tangent and radius

:::question{title="1. Length of a tangent" exam="Board level"}
A point P is 17 cm from the centre of a circle of radius 8 cm. Find the length of the tangent from P to the circle.

---

The radius to the point of contact T is perpendicular to the tangent, so $\triangle OTP$ has its right angle at T and OP is the hypotenuse.

$PT = \sqrt{17^2 - 8^2} = \sqrt{289 - 64} = \sqrt{225} =$ **15 cm**.
:::

:::question{title="2. Find the radius" exam="Board level"}
The tangent from a point Q to a circle is 20 cm long. Q is 29 cm from the centre. Find the radius.

---

$r^2 = 29^2 - 20^2 = 841 - 400 = 441$, so $r =$ **21 cm**.
:::

:::question{title="3. Concentric circles" exam="Board level"}
Two concentric circles have radii 13 cm and 5 cm. A chord of the bigger circle touches the smaller circle. Find the length of the chord.

---

The radius of the small circle to the point of contact M is perpendicular to the chord AB, so M is the mid-point of AB.

$AM = \sqrt{13^2 - 5^2} = 12$ cm, so $AB = 2 \times 12 =$ **24 cm**.
:::

## Two tangents from a point

:::question{title="4. Angle between tangents" exam="Board level"}
PA and PB are tangents from P to a circle. $\angle AOB = 125^\circ$. Find $\angle APB$.

---

In quadrilateral OAPB, $\angle OAP = \angle OBP = 90^\circ$. So $\angle APB = 360^\circ - 90^\circ - 90^\circ - 125^\circ =$ **55°**.
:::

:::question{title="5. Angle at the centre" exam="Board level"}
Tangents PA and PB from a point P are inclined to each other at $70^\circ$. Find $\angle POA$.

---

OP bisects $\angle APB$, so $\angle APO = 35^\circ$. In $\triangle OAP$, $\angle OAP = 90^\circ$.

$\angle POA = 180^\circ - 90^\circ - 35^\circ =$ **55°**.
:::

:::question{title="6. Tangents at the ends of a chord" exam="Board level"}
PQ is a chord of length 16 cm in a circle of radius 10 cm. The tangents at P and Q meet at T. Find TP.

---

OT is the perpendicular bisector of PQ. Let it meet PQ at R. Then $PR = 8$ and $OR = \sqrt{10^2 - 8^2} = 6$.

$\angle TPR = 90^\circ - \angle RPO = \angle POR$, so $\triangle TRP \sim \triangle PRO$ (AA). Then $\dfrac{TP}{PO} = \dfrac{RP}{RO}$:

$TP = \dfrac{10 \times 8}{6} =$ **$\dfrac{40}{3}$ cm** (about 13.33 cm).

Check: $OT = \dfrac{10^2}{6} = \dfrac{50}{3}$, and $TP^2 = OT^2 - 10^2 = \dfrac{1600}{9}$.
:::

:::question{title="7. Parallel tangents" exam="Board level"}
XY and X′Y′ are parallel tangents to a circle. A third tangent touches the circle at C and cuts XY at A and X′Y′ at B. If $\angle OAB = 40^\circ$, find $\angle OBA$.

---

For two parallel tangents cut by a third tangent, $\angle AOB = 90^\circ$. (OA bisects the angle at A and OB bisects the angle at B. These two angles are co-interior, so they add to $180^\circ$, and their halves add to $90^\circ$.)

In $\triangle AOB$: $\angle OBA = 180^\circ - 90^\circ - 40^\circ =$ **50°**.
:::

## Figures around a circle

:::question{title="8. Quadrilateral" exam="Board level"}
A quadrilateral ABCD is drawn around a circle, touching it on all four sides. AB = 7 cm, BC = 9 cm and CD = 8 cm. Find AD.

---

For a quadrilateral around a circle, $AB + CD = AD + BC$.

$7 + 8 = AD + 9$, so $AD =$ **6 cm**.
:::

:::question{title="9. Triangle: tangent pieces" exam="Board level"}
A circle touches the sides of $\triangle ABC$: BC at D, CA at E and AB at F. AB = 10 cm, BC = 12 cm and CA = 8 cm. Find BD.

---

Let the tangent lengths be AF = AE = $x$, BF = BD = $y$, CD = CE = $z$. Then $x + y = 10$, $y + z = 12$ and $z + x = 8$.

Adding, $2(x + y + z) = 30$, so $x + y + z = 15$. Then $y = 15 - (z + x) = 15 - 8 = 7$.

**BD = 7 cm.**
:::

:::question{title="10. Triangle with a given radius" exam="Board level"}
$\triangle ABC$ is drawn around a circle of radius 2 cm. The circle touches BC at D, with BD = 4 cm and DC = 6 cm. Find AB and AC.

---

Let the tangent length from A be $x$. Then $AB = x + 4$, $AC = x + 6$, $BC = 10$, and half the perimeter is $s = x + 10$.

Area by splitting into $\triangle OBC$, $\triangle OCA$, $\triangle OAB$ (each has height 2): $\text{Area} = \frac12 \times 2 \times 2s = 2(x + 10)$.

Area by Heron's formula: $\sqrt{(x + 10) \times x \times 6 \times 4}$.

Equate and square: $4(x + 10)^2 = 24x(x + 10)$, so $x + 10 = 6x$ and $x = 2$.

**AB = 6 cm, AC = 8 cm.** Check: $6^2 + 8^2 = 10^2$, area $= 24$ cm² both ways.
:::
