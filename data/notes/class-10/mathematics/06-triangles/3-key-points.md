---
title: "Triangles: Important Points and Traps"
type: key_points
chapter: c10.mathematics.triangles
order: 3
---

## What is in the current book

:::remember
The current (rationalised) NCERT chapter covers: similar figures, similar polygons, BPT and its converse, and the AAA/AA, SSS and SAS criteria (plus a note on RHS).

The theorem on **areas of similar triangles**, the **Pythagoras Theorem** proof and its converse are **no longer in this chapter**. Older guides still teach them. The chapter's opening lines still mention Pythagoras, but that section was removed.
:::

## Similar figures

:::remember
- All circles, all squares and all equilateral triangles are similar.
- All congruent figures are similar, but similar figures need not be congruent.
- Two polygons are similar only if **both** the angles match **and** the sides are proportional.
:::

:::trap
"All isosceles triangles are similar" and "all rectangles are similar" are **false**. Their angles or side ratios can differ.
:::

:::trap
For polygons, one condition alone is not enough. A square and a rectangle have equal angles but are not similar. A square and a rhombus have proportional sides but are not similar. Only for **triangles** does one condition give the other.
:::

## BPT and its converse

:::trap
BPT gives $\dfrac{AD}{DB} = \dfrac{AE}{EC}$ (part to part). For the parallel segment, use the **whole** side:
$$\frac{DE}{BC} = \frac{AD}{AB}$$
Writing $\dfrac{DE}{BC} = \dfrac{AD}{DB}$ is a very common mistake.
:::

:::trap
BPT needs $DE \parallel BC$. If the line is not parallel, the ratios are not equal. To **prove** parallel lines, use the converse: show the ratios are equal first.
:::

- The ratios can be flipped or combined. From $\dfrac{AD}{DB} = \dfrac{AE}{EC}$, flip both sides to get $\dfrac{DB}{AD} = \dfrac{EC}{AE}$. Add 1 to both sides: $\dfrac{AB}{AD} = \dfrac{AC}{AE}$ (the book's Example 1).
- Keep the same order on both sides: top part over bottom part on **both** sides.

:::tip
Before using any ratio, mark the small triangle and the big triangle. Then write "small over big" for every pair of sides.
:::

## Criteria for similarity

:::remember
- **AA** is enough: two equal angles force the third to be equal.
- **SSS:** all three ratios must be equal, not just two.
- **SAS:** the equal angle must be the angle **between** the two proportional sides.
:::

:::trap
**In SAS, the equal angle must be the included angle.** If it is not between the two proportional sides, the triangles may not be similar. (Some books call this case "SSA"; that name is beyond the Class 10 book.)

The one exception in the book is **RHS**: if the equal angle is a right angle, the hypotenuse and one side in the same ratio are enough.
:::

:::trap
Do not mix up similarity with congruence. Similar triangles have **equal angles** but sides only **in the same ratio**. Congruence needs equal sides as well.
:::

## Writing the similarity

:::trap
The order of letters must match the equal angles. If $\angle A = \angle Q$, $\angle B = \angle R$ and $\angle C = \angle P$, write $\triangle ABC \sim \triangle QRP$, **not** $\triangle ABC \sim \triangle PQR$.

A wrong order gives wrong side ratios and wrong angles later.
:::

:::tip
For SSS, sort both triangles' sides from shortest to longest. The shortest matches the shortest, and so on. Then the vertex **between** two matched sides matches the vertex between their partners.
:::

## Common figures

- **Vertically opposite angles** (two lines crossing at O) plus a pair of alternate angles give AA similarity: if $PQ \parallel RS$, then $\triangle POQ \sim \triangle SOR$.
- In a **trapezium**, the two triangles made by the diagonals with the parallel sides are similar.
- A **common angle** is often the second angle you need (for example $\angle C$ in $\triangle ADC$ and $\triangle BAC$).
- Two right triangles with one more pair of equal angles are similar by AA.

## Word problems

:::trap
In shadow and lamp-post problems, change all lengths to the **same unit** first (the book changes 90 cm to 0.9 m). For a lamp-post, the big triangle's base is **distance from the post + shadow**, not the shadow alone.
:::

:::tip
(Beyond the Class 10 book, but it follows from equal ratios.) The perimeters of two similar triangles are in the same ratio as their corresponding sides.
:::
