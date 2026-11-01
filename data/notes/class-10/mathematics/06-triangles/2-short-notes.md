---
title: "Triangles: Short Notes"
type: short_notes
chapter: c10.mathematics.triangles
order: 2
---

## 1. Similar figures

- **Congruent** figures have the same shape **and** the same size.
- **Similar** figures have the same shape, but not always the same size.
- Every congruent pair is similar. A similar pair need not be congruent.
- These are **always** similar: all circles, all squares, all equilateral triangles.
- A photo and its enlargement are similar. The common ratio of lengths is the **scale factor**. Maps and building blueprints are drawn using a scale factor.

## 2. Similar polygons

Two polygons with the same number of sides are similar when **both** of these hold:

1. corresponding angles are equal;
2. corresponding sides are in the same ratio (proportional).

One condition alone is **not enough** for polygons:

| Pair | Angles equal? | Sides in same ratio? | Similar? |
|---|---|---|---|
| Square and rectangle | Yes | No | No |
| Square and rhombus | No | Yes | No |

If polygon 1 is similar to polygon 2, and polygon 2 is similar to polygon 3, then polygon 1 is similar to polygon 3.

## 3. Similar triangles

- A triangle is a polygon, so the same two conditions apply.
- Triangles with all three angles equal are called **equiangular**.
- Thales noticed that in two equiangular triangles, the ratio of any two corresponding sides is always the same.
- We write $\triangle ABC \sim \triangle DEF$ and read it "triangle ABC is similar to triangle DEF".
- The **order** of the letters matters. It tells you $A \leftrightarrow D$, $B \leftrightarrow E$, $C \leftrightarrow F$.

## 4. Basic Proportionality Theorem (BPT)

:::remember
**Theorem 6.1:** If a line is drawn parallel to one side of a triangle to cut the other two sides at distinct points, the other two sides are divided in the same ratio.
:::

In $\triangle ABC$, if $DE \parallel BC$ with D on AB and E on AC, then
$$\frac{AD}{DB} = \frac{AE}{EC}$$

**Idea of the book's proof (uses areas):**

- Join BE and CD. Draw $DM \perp AC$ and $EN \perp AB$.
- $\dfrac{ar(ADE)}{ar(BDE)} = \dfrac{AD}{DB}$, since both triangles have the same height EN.
- $\dfrac{ar(ADE)}{ar(DEC)} = \dfrac{AE}{EC}$, since both have the same height DM.
- $ar(BDE) = ar(DEC)$: same base DE, between the same parallels DE and BC.
- So the two ratios are equal.

From BPT you also get (Example 1):
$$\frac{AD}{AB} = \frac{AE}{AC}$$

## 5. Converse of BPT

:::remember
**Theorem 6.2:** If a line divides any two sides of a triangle in the same ratio, then the line is parallel to the third side.
:::

Use it to **prove** two lines are parallel, or to **check** whether they are.

:::example{title="Is EF parallel to QR?"}
In $\triangle PQR$: PE = 2 cm, EQ = 3 cm, PF = 3.2 cm, FR = 4.8 cm.

$\dfrac{PE}{EQ} = \dfrac{2}{3}$ and $\dfrac{PF}{FR} = \dfrac{3.2}{4.8} = \dfrac{2}{3}$. Equal, so $EF \parallel QR$.
:::

**Mid-point results** (Exercise 6.2, recalled from Class IX):

- A line through the mid-point of one side, parallel to another side, **bisects** the third side (by BPT).
- The line joining the mid-points of two sides is **parallel** to the third side (by the converse).

## 6. Criteria for similarity

You do not need to check all six parts. One of these is enough:

| Criterion | What you need |
|---|---|
| AAA | All three angles equal |
| AA | Two angles equal |
| SSS | All three side ratios equal |
| SAS | One angle equal, and the two sides around it proportional |

- **AA** works because the third angles are then equal by the angle sum property.
- For triangles (unlike other polygons), equal angles force proportional sides, and proportional sides force equal angles. So one condition is enough.
- The book proves AAA, SSS and SAS by cutting $DP = AB$ and $DQ = AC$ on the bigger triangle and using BPT or its converse.

**RHS criterion** (from "A Note to the Reader" in the book): in two right triangles, if the hypotenuse and one side are proportional to the hypotenuse and one side of the other, the triangles are similar.

## 7. Writing the correspondence

- Match vertices by **equal angles** (for AA) or by **matching side ratios** (for SSS).
- If $\triangle ABC \sim \triangle DEF$, you may also write $\triangle BAC \sim \triangle EDF$. You may **not** write $\triangle ABC \sim \triangle EDF$.

:::example{title="Matching sides for SSS"}
AB = 3.8, BC = 6, CA = $3\sqrt{3}$ and RQ = 7.6, QP = 12, PR = $6\sqrt{3}$.

Every ratio is $\frac12$, so $\triangle ABC \sim \triangle RQP$. Then $\angle C = \angle P$.
:::

## 8. Using similar triangles

**Heights and shadows.** Objects standing straight up on level ground, at the same time, make similar right triangles with their shadows.

:::example{title="Lamp-post (Example 7)"}
A lamp is 3.6 m high. A girl 0.9 m tall walks away at 1.2 m/s. After 4 s she is 4.8 m from the post. Let her shadow be $x$ m.

$\dfrac{4.8 + x}{x} = \dfrac{3.6}{0.9} = 4$, so $4.8 + x = 4x$ and $x = 1.6$ m.
:::

**Trapezium ABCD, $AB \parallel DC$:**

- Diagonals meet at O: $\triangle AOB \sim \triangle COD$, so $\dfrac{AO}{OC} = \dfrac{BO}{OD}$ (Exercises 6.2 and 6.3).
- Converse: if the diagonals of a quadrilateral cut each other so that $\dfrac{AO}{BO} = \dfrac{CO}{DO}$, it is a trapezium.
- A line EF parallel to AB, across the legs, gives $\dfrac{AE}{ED} = \dfrac{BF}{FC}$ (Example 2).

**Other parts of similar triangles.** In similar triangles, the ratio of corresponding **medians** (Example 8, Exercise 6.3 Q16) and of corresponding **angle bisectors** (Exercise 6.3 Q10) equals the ratio of corresponding sides.

**A useful product.** If D is on BC and $\angle ADC = \angle BAC$, then $\triangle ADC \sim \triangle BAC$ (common $\angle C$), so $CA^2 = CB \cdot CD$ (Exercise 6.3 Q13).
